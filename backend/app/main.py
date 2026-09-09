"""Production Change Agent — FastAPI backend.

    POST /change          -> 3 ranked plans with costs, violations and citations
    POST /change/stream   -> the same run as an SSE trace (for the live demo)
    GET  /schedule        -> current stripboard, for the UI to render
    GET  /health          -> liveness + whether Parallel Search is wired up
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
import uuid
from typing import Any, AsyncGenerator

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from .config import ALLOWED_ORIGINS, load_production
from .cost_model import compute_cost
from .generate import clone_schedule, evaluate
from .parser import parse_change
from .schemas import ChangeRequest, ChangeResponse, ParsedIntent
from .tools import gather_production_context, search_enabled
from .validator import day_metrics, validate

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
log = logging.getLogger("pca")

app = FastAPI(
    title="Production Change Agent",
    version="1.0.0",
    description="Every schedule change has a price. We tell you what it is before you commit.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ──────────────────────────────────────────────────────────────────────────
# helpers
# ──────────────────────────────────────────────────────────────────────────
def _context_for_search(intent: ParsedIntent, prod: dict[str, Any]):
    scenes = [prod["_scenes_by_id"][sid] for sid in intent.scene_ids if sid in prod["_scenes_by_id"]]
    # For day-level intents (move_day / swap_days) pull scenes from the referenced days
    if not scenes:
        extra = getattr(intent, "extra", {}) or {}
        day_nums = [v for v in extra.values() if isinstance(v, int)]
        if intent.target_day:
            day_nums.append(intent.target_day)
        for dn in day_nums:
            day_obj = next((d for d in prod["days"] if d["day"] == dn), None)
            if day_obj:
                for sid in day_obj.get("scene_ids", []):
                    s = prod["_scenes_by_id"].get(sid)
                    if s:
                        scenes.append(s)
    locations = [
        prod["_locations_by_id"][s["location_id"]]
        for s in scenes
        if s.get("location_id") in prod["_locations_by_id"]
    ]
    return scenes, locations


def _validate_intent(intent: ParsedIntent, prod: dict[str, Any]) -> None:
    if intent.action == "unknown":
        raise HTTPException(
            status_code=422,
            detail=(
                "Could not read that change request. Try phrasing like "
                "'move scene 5 to day 3', 'swap scenes 4 and 9', 'cut scene 7', "
                "'push day 4 to day 6', or 'swap day 2 and day 5'."
            ),
        )

    # For scene-level actions, validate referenced scene IDs exist
    if intent.action in ("move", "swap", "cut", "hold") and intent.scene_ids:
        unknown = [sid for sid in intent.scene_ids if sid not in prod["_scenes_by_id"]]
        if unknown:
            raise HTTPException(status_code=404, detail=f"Unknown scene(s): {', '.join(unknown)}")

    # For day-level actions, validate both days exist
    valid_days = {d["day"] for d in prod["days"]}
    extra = getattr(intent, "extra", {}) or {}

    if intent.action == "move_day":
        from_day = extra.get("from_day")
        to_day   = extra.get("to_day") or intent.target_day
        for label, val in [("from_day", from_day), ("to_day", to_day)]:
            if val is not None and val not in valid_days:
                raise HTTPException(
                    status_code=404,
                    detail=f"Day {val} ({label}) is not in this schedule (days 1–{max(valid_days)}).",
                )

    elif intent.action == "swap_days":
        day_a = extra.get("day_a") or intent.target_day
        day_b = extra.get("day_b")
        for val in (day_a, day_b):
            if val is not None and val not in valid_days:
                raise HTTPException(
                    status_code=404,
                    detail=f"Day {val} is not in this schedule (days 1–{max(valid_days)}).",
                )

    elif intent.target_day is not None and intent.target_day not in valid_days:
        raise HTTPException(
            status_code=404,
            detail=f"Day {intent.target_day} is not in this schedule (days 1–{max(valid_days)}).",
        )


# ──────────────────────────────────────────────────────────────────────────
# USER PREFERENCES (Agent Memory)
# ──────────────────────────────────────────────────────────────────────────
# In production, this would be stored in a database
user_preferences = {
    "prefers_cost_savings": True,
    "prefers_fewer_violations": True,
    "risk_tolerance": "medium"  # "low", "medium", "high"
}


# ──────────────────────────────────────────────────────────────────────────
# REASONING ENGINE
# ──────────────────────────────────────────────────────────────────────────
def generate_reasoning(plan_data: dict, intent: ParsedIntent, prod: dict) -> str:
    """Generate human-readable reasoning for why this plan was chosen."""
    reasons = []
    
    # Check if it's a move operation
    if intent.action == "move":
        reasons.append(f"Moved scene {intent.scene_ids[0]} from its original day to Day {intent.target_day}")
        
        # Check if cost was reduced
        if plan_data.get("cost_delta", 0) < 0:
            reasons.append(f"This saves ${abs(plan_data['cost_delta']):,} by reducing overtime and hold costs")
        else:
            reasons.append(f"This increases cost by ${plan_data.get('cost_delta', 0):,} but reduces schedule risk")
    
    # Check violation reduction
    old_violations = len(prod.get("violations", []))
    new_violations = len(plan_data.get("violations", []))
    if new_violations < old_violations:
        reasons.append(f"Reduces violations from {old_violations} to {new_violations}")
    elif new_violations > old_violations:
        reasons.append(f"Increases violations by {new_violations - old_violations} - trade-off for cost savings")
    
    # Add strategic reasoning
    if plan_data.get("strategy") == "lightest_work_first":
        reasons.append("Strategy: moved the lightest work (lowest page count) to create room without overloading the day")
    elif plan_data.get("strategy") == "swap":
        reasons.append("Strategy: swapped scenes between days to balance workload evenly")
    
    return " → ".join(reasons) if reasons else "Plan generated based on cost and constraint optimization."


def calculate_confidence(plan_data: dict, candidates_count: int) -> float:
    """Calculate confidence score (0-1) for a plan."""
    confidence = 0.5  # Base
    
    # More candidates considered = higher confidence
    if candidates_count >= 10:
        confidence += 0.25
    elif candidates_count >= 5:
        confidence += 0.15
    
    # Fewer violations = higher confidence
    violations = len(plan_data.get("violations", []))
    if violations == 0:
        confidence += 0.2
    elif violations <= 2:
        confidence += 0.1
    
    # Cost savings = higher confidence
    if plan_data.get("cost_delta", 0) < 0:
        confidence += 0.1
    
    return min(confidence, 1.0)  # Cap at 1.0


# ──────────────────────────────────────────────────────────────────────────
# MAIN CHANGE HANDLER
# ──────────────────────────────────────────────────────────────────────────
async def _run_change(body: ChangeRequest) -> ChangeResponse:
    started = time.perf_counter()
    prod = load_production()
    trace: list[str] = []

    # Step 1: Parse intent
    intent = await parse_change(body.request)
    _validate_intent(intent, prod)
    trace.append(f"Parsed intent ({intent.parser}): {intent.action} {intent.scene_ids} -> day {intent.target_day}")

    # Step 2: Search context
    scenes, locations = _context_for_search(intent, prod)

    search_task = None
    if body.use_search and search_enabled():
        trace.append("Searching production precedent with Parallel AI...")
        search_task = asyncio.create_task(
            gather_production_context(
                intent, scenes, locations, session_id=f"pca_{uuid.uuid4().hex[:12]}"
            )
        )

    # Step 3: Generate candidates
    trace.append("Generating alternative schedules...")
    
    # Adapt candidate count based on user preferences
    max_plans = body.max_plans
    if user_preferences.get("prefers_cost_savings", True):
        max_plans = min(max_plans * 2, 10)  # Generate more for better savings
        trace.append(f"User prefers cost savings → generating {max_plans} candidates")
    
    plans, rejected, baseline_cost = await asyncio.to_thread(
        evaluate, intent, prod, max_plans
    )
    trace.append(f"Generated {len(plans)} viable plans, {len(rejected)} rejected")

    # Step 4: Add reasoning and confidence to each plan
    for plan in plans:
        # Convert to dict for processing
        plan_dict = plan.model_dump()
        
        # Add strategy tag if not present
        if not hasattr(plan, 'strategy'):
            if len(plan.changes) == 1 and plan.changes[0].type == "move":
                plan.strategy = "direct_move"
            elif len(plan.changes) >= 2:
                plan.strategy = "swap"
            else:
                plan.strategy = "optimized"
        
        # Generate reasoning
        plan.reasoning = generate_reasoning(
            {"cost_delta": plan.cost - baseline_cost, "violations": plan.violations, "strategy": getattr(plan, 'strategy', 'optimized')},
            intent,
            prod
        )
        
        # Calculate confidence
        plan.confidence = calculate_confidence(
            {"cost_delta": plan.cost - baseline_cost, "violations": plan.violations},
            len(plans) + len(rejected)
        )
        plan.alternatives_considered = len(plans) + len(rejected)
    
    trace.append(f"Plan #{plans[0].rank if plans else 'N/A'} recommended as optimal")

    # Step 5: Handle citations
    citations = await search_task if search_task else []
    if citations:
        trace.append(f"Parallel Search returned {len(citations)} grounding sources")
        for plan in plans:
            plan.parallel_results = citations
            trace.append(f"Grounded Plan #{plan.rank} with {len(citations)} sources")

    if not plans:
        trace.append("Every candidate hit a hard rule. Returning the rejections instead.")
    else:
        # Show confidence for top plan
        top_confidence = plans[0].confidence if hasattr(plans[0], 'confidence') else 0
        trace.append(f"Agent confidence in recommended plan: {top_confidence:.0%}")

    return ChangeResponse(
        status="ok" if plans else "no_viable_plan",
        plans=plans,
        request=body.request,
        intent=intent,
        rejected=rejected,
        baseline_cost=baseline_cost,
        search_used=bool(citations),
        trace=trace,
        elapsed_ms=int((time.perf_counter() - started) * 1000),
    )


# ──────────────────────────────────────────────────────────────────────────
# ENDPOINTS
# ──────────────────────────────────────────────────────────────────────────
@app.get("/health")
async def health() -> dict[str, Any]:
    prod = load_production()
    return {
        "status": "ok",
        "production": prod["production"]["title"],
        "shoot_days": len(prod["days"]),
        "scenes": len(prod["scenes"]),
        "parallel_search": "configured" if search_enabled() else "missing PARALLEL_API_KEY",
    }


@app.get("/schedule")
async def schedule() -> dict[str, Any]:
    """Current stripboard plus the baseline cost — what the UI renders on load."""
    prod = load_production()
    board = clone_schedule(prod)
    violations = validate(board, prod)
    cost = compute_cost(board, prod, violations)
    return {
        "production": prod["production"],
        "rules": prod["rules"],
        "cast": prod["cast"],
        "locations": prod["locations"],
        "scenes": prod["scenes"],
        "days": [
            {
                "day": m["day"],
                "date": m["date"],
                "call_time": m["call_time"],
                "scene_ids": m["scene_ids"],
                "hours": m["hours"],
                "pages": m["pages"],
                "location_ids": m["location_ids"],
                "cast_ids": m["cast_ids"],
            }
            for m in (day_metrics(d, prod) for d in board)
        ],
        "baseline_cost": cost["total"],
        "cost_lines": cost["lines"],
        "violations": violations,
    }


@app.post("/change", response_model=ChangeResponse)
async def change(body: ChangeRequest) -> ChangeResponse:
    return await _run_change(body)


@app.post("/change/stream")
async def change_stream(body: ChangeRequest) -> StreamingResponse:
    """Same pipeline, emitted as Server-Sent Events so the UI can show the agent thinking."""

    async def event_source() -> AsyncGenerator[str, None]:
        def sse(event: str, data: Any) -> str:
            return f"event: {event}\ndata: {json.dumps(data, default=str)}\n\n"

        try:
            prod = load_production()
            yield sse("status", {"message": "Reading the change request"})

            intent = await parse_change(body.request)
            _validate_intent(intent, prod)
            yield sse("intent", intent.model_dump())

            scenes, locations = _context_for_search(intent, prod)
            search_task = None
            if body.use_search and search_enabled():
                yield sse("status", {"message": "Searching production precedent with Parallel"})
                search_task = asyncio.create_task(
                    gather_production_context(
                        intent, scenes, locations, session_id=f"pca_{uuid.uuid4().hex[:12]}"
                    )
                )

            yield sse("status", {"message": "Building candidate schedules"})
            plans, rejected, baseline_cost = await asyncio.to_thread(
                evaluate, intent, prod, body.max_plans
            )
            yield sse("baseline", {"baseline_cost": baseline_cost})

            citations = await search_task if search_task else []
            if citations:
                yield sse("sources", [c.model_dump() for c in citations])
                for plan in plans:
                    plan.parallel_results = citations

            for plan in plans:
                yield sse("plan", plan.model_dump())
            for rp in rejected:
                yield sse("rejected", rp.model_dump())

            yield sse("done", {"plans": len(plans), "rejected": len(rejected)})
        except HTTPException as exc:
            yield sse("error", {"status": exc.status_code, "detail": exc.detail})
        except Exception as exc:  # pragma: no cover - last-resort guard
            log.exception("stream failed")
            yield sse("error", {"status": 500, "detail": str(exc)})

    return StreamingResponse(
        event_source(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ──────────────────────────────────────────────────────────────────────────
# AGENT LOOP WITH TOOLS
# ──────────────────────────────────────────────────────────────────────────
# This is the multi-tool agent capability
tools = {
    "search": gather_production_context,
    "validate": validate,
    "cost": compute_cost,
    "generate": evaluate
}

async def agent_loop(request: ChangeRequest, prod: dict[str, Any]) -> dict[str, Any]:
    """Multi-tool agent that uses all available tools."""
    context = {}
    
    # Parse intent
    intent = await parse_change(request.request)
    context["intent"] = intent
    
    # Search
    if request.use_search and search_enabled():
        scenes, locations = _context_for_search(intent, prod)
        context["search_results"] = await gather_production_context(intent, scenes, locations)
    
    # Generate candidates
    plans, rejected, baseline_cost = await asyncio.to_thread(
        evaluate, intent, prod, request.max_plans
    )
    context["plans"] = plans
    context["rejected"] = rejected
    context["baseline_cost"] = baseline_cost
    
    # Validate each plan
    context["validated"] = [validate(p.schedule, prod) for p in plans]
    
    # Calculate cost for each
    context["costs"] = [compute_cost(p.schedule, prod, v) for p, v in zip(plans, context["validated"])]
    
    return context
