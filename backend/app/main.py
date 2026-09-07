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


# --------------------------------------------------------------------------
# helpers
# --------------------------------------------------------------------------
def _context_for_search(intent: ParsedIntent, prod: dict[str, Any]):
    scenes = [prod["_scenes_by_id"][sid] for sid in intent.scene_ids if sid in prod["_scenes_by_id"]]
    locations = [prod["_locations_by_id"][s["location_id"]] for s in scenes]
    return scenes, locations


def _validate_intent(intent: ParsedIntent, prod: dict[str, Any]) -> None:
    if intent.action == "unknown":
        raise HTTPException(
            status_code=422,
            detail=(
                "Could not read that change request. Try phrasing like "
                "'move scene 5 to day 3', 'swap scene 4 and scene 9', or 'cut scene 7'."
            ),
        )
    unknown = [sid for sid in intent.scene_ids if sid not in prod["_scenes_by_id"]]
    if unknown:
        raise HTTPException(status_code=404, detail=f"Unknown scene(s): {', '.join(unknown)}")
    valid_days = {d["day"] for d in prod["days"]}
    if intent.target_day is not None and intent.target_day not in valid_days:
        raise HTTPException(
            status_code=404,
            detail=f"Day {intent.target_day} is not in this schedule (days 1–{max(valid_days)}).",
        )


async def _run_change(body: ChangeRequest) -> ChangeResponse:
    started = time.perf_counter()
    prod = load_production()
    trace: list[str] = []

    intent = await parse_change(body.request)
    _validate_intent(intent, prod)
    trace.append(f"Parsed intent ({intent.parser}): {intent.action} {intent.scene_ids} -> day {intent.target_day}")

    scenes, locations = _context_for_search(intent, prod)

    search_task = None
    if body.use_search and search_enabled():
        search_task = asyncio.create_task(
            gather_production_context(
                intent, scenes, locations, session_id=f"pca_{uuid.uuid4().hex[:12]}"
            )
        )

    plans, rejected, baseline_cost = await asyncio.to_thread(
        evaluate, intent, prod, body.max_plans
    )
    trace.append(f"Generated and scored candidates: {len(plans)} viable, {len(rejected)} rejected")

    citations = await search_task if search_task else []
    if citations:
        trace.append(f"Parallel Search returned {len(citations)} grounding sources")
        for plan in plans:
            plan.parallel_results = citations

    if not plans:
        trace.append("Every candidate hit a hard rule. Returning the rejections instead.")

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


# --------------------------------------------------------------------------
# endpoints
# --------------------------------------------------------------------------
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