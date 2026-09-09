"""Plan generation.

Given a parsed intent, build several *different strategies* for absorbing the
change, score each one against the cost model and the rule validator, then
rank. Plans with a hard violation are never ranked — they go to `rejected`
with the reason, because "here is what I refused and why" is the part a
production manager actually trusts.
"""

from __future__ import annotations

import copy
from dataclasses import dataclass, field
from typing import Any, Optional

from .cost_model import compute_cost, diff_costs
from .schemas import ParsedIntent, Plan, RejectedPlan, SceneChange
from .validator import (
    day_hours,
    find_scene_day,
    hard_violations,
    mark_preexisting,
    risk_delta,
    risk_score,
    validate,
)

# Dollars of budget the ranker is willing to spend to remove one risk point.
RISK_PRICE = 450.0


@dataclass
class Candidate:
    strategy: str
    summary: str
    changes: list[SceneChange] = field(default_factory=list)
    schedule: list[dict[str, Any]] = field(default_factory=list)


# --------------------------------------------------------------------------
# schedule helpers
# --------------------------------------------------------------------------
def clone_schedule(prod: dict[str, Any]) -> list[dict[str, Any]]:
    return copy.deepcopy(prod["days"])


def _sort_day(day: dict[str, Any], prod: dict[str, Any]) -> None:
    def key(sid: str) -> tuple[Any, ...]:
        s = prod["_scenes_by_id"][sid]
        return (s["location_id"], s["day_night"] == "NIGHT", int(s["id"]) if s["id"].isdigit() else 0)

    day["scene_ids"] = sorted(day["scene_ids"], key=key)


def get_day(schedule: list[dict[str, Any]], day_no: int) -> Optional[dict[str, Any]]:
    for d in schedule:
        if d["day"] == day_no:
            return d
    return None


def move_scene(
    schedule: list[dict[str, Any]], prod: dict[str, Any], scene_id: str, to_day: int
) -> Optional[SceneChange]:
    src = find_scene_day(schedule, scene_id)
    dst = get_day(schedule, to_day)
    if src is None or dst is None or src == to_day:
        return None
    get_day(schedule, src)["scene_ids"].remove(scene_id)
    dst["scene_ids"].append(scene_id)
    _sort_day(dst, prod)
    return SceneChange(
        scene_id=scene_id,
        action="move",
        from_day=src,
        to_day=to_day,
        reason=f"Scene {scene_id} moved from Day {src} to Day {to_day}.",
    )


def swap_scenes(
    schedule: list[dict[str, Any]], prod: dict[str, Any], a: str, b: str
) -> list[SceneChange]:
    da, db = find_scene_day(schedule, a), find_scene_day(schedule, b)
    if da is None or db is None or da == db:
        return []
    get_day(schedule, da)["scene_ids"].remove(a)
    get_day(schedule, db)["scene_ids"].remove(b)
    get_day(schedule, db)["scene_ids"].append(a)
    get_day(schedule, da)["scene_ids"].append(b)
    _sort_day(get_day(schedule, da), prod)
    _sort_day(get_day(schedule, db), prod)
    return [
        SceneChange(scene_id=a, action="swap", from_day=da, to_day=db,
                    reason=f"Scene {a} traded into Day {db}."),
        SceneChange(scene_id=b, action="swap", from_day=db, to_day=da,
                    reason=f"Scene {b} traded back into Day {da}."),
    ]


def cut_scene(schedule: list[dict[str, Any]], scene_id: str) -> Optional[SceneChange]:
    src = find_scene_day(schedule, scene_id)
    if src is None:
        return None
    get_day(schedule, src)["scene_ids"].remove(scene_id)
    return SceneChange(
        scene_id=scene_id, action="cut", from_day=src,
        reason=f"Scene {scene_id} cut from Day {src}.",
    )


# --------------------------------------------------------------------------
# strategies
# --------------------------------------------------------------------------
def _relieve_overflow(
    schedule: list[dict[str, Any]], prod: dict[str, Any], day_no: int
) -> list[SceneChange]:
    """Push the lightest scenes off an overloaded day until it fits the standard day."""
    standard = float(prod["rules"]["standard_shoot_hours"])
    changes: list[SceneChange] = []
    target = get_day(schedule, day_no)
    guard = 0
    while target and day_hours(target, prod) > standard and len(target["scene_ids"]) > 1 and guard < 6:
        guard += 1
        movable = sorted(
            target["scene_ids"],
            key=lambda sid: float(prod["_scenes_by_id"][sid]["est_hours"]),
        )
        # find the emptiest other day
        others = sorted(
            (d for d in schedule if d["day"] != day_no),
            key=lambda d: day_hours(d, prod),
        )
        if not others:
            break
        sid = movable[0]
        ch = move_scene(schedule, prod, sid, others[0]["day"])
        if not ch:
            break
        ch.reason = f"Scene {sid} pushed to Day {others[0]['day']} to keep Day {day_no} inside a standard day."
        changes.append(ch)
    return changes


def build_candidates(intent: ParsedIntent, prod: dict[str, Any]) -> list[Candidate]:  # noqa: PLR0912
    cands: list[Candidate] = []

    # ── move_day: "push day 4 to day 6" — move every scene on day X to day Y ──
    if intent.action == "move_day":
        extra = getattr(intent, "extra", {}) or {}
        from_day = extra.get("from_day")
        to_day   = extra.get("to_day") or intent.target_day
        if from_day and to_day:
            src_day_obj = get_day(prod["days"], from_day)
            if src_day_obj:
                scene_ids = list(src_day_obj["scene_ids"])

                # 1. move all scenes from source day to target day
                sched = clone_schedule(prod)
                changes = [c for sid in scene_ids if (c := move_scene(sched, prod, sid, to_day))]
                if changes:
                    cands.append(Candidate(
                        "move_day_direct",
                        f"Move all {len(changes)} scene(s) from Day {from_day} to Day {to_day}.",
                        changes, sched,
                    ))

                # 2. move + cascade overflow off target day
                sched = clone_schedule(prod)
                changes = [c for sid in scene_ids if (c := move_scene(sched, prod, sid, to_day))]
                if changes:
                    cascade = _relieve_overflow(sched, prod, to_day)
                    if cascade:
                        cands.append(Candidate(
                            "move_day_cascade",
                            f"Move Day {from_day} scenes to Day {to_day} and cascade overflow off Day {to_day}.",
                            changes + cascade, sched,
                        ))

                # 3. distribute scenes across neighbouring days instead
                neighbours = [d["day"] for d in prod["days"] if d["day"] != from_day]
                if len(neighbours) >= 2:
                    sched = clone_schedule(prod)
                    changes_all: list[SceneChange] = []
                    for i, sid in enumerate(scene_ids):
                        dest = neighbours[i % len(neighbours)]
                        ch = move_scene(sched, prod, sid, dest)
                        if ch:
                            changes_all.append(ch)
                    if changes_all:
                        cands.append(Candidate(
                            "move_day_distribute",
                            f"Distribute Day {from_day} scenes across neighbouring days to keep each day light.",
                            changes_all, sched,
                        ))

    # ── swap_days: "swap day 2 and day 5" — swap ALL scenes between two days ──
    elif intent.action == "swap_days":
        extra = getattr(intent, "extra", {}) or {}
        day_a = extra.get("day_a") or intent.target_day
        day_b = extra.get("day_b")
        if day_a and day_b:
            obj_a = get_day(prod["days"], day_a)
            obj_b = get_day(prod["days"], day_b)
            if obj_a and obj_b:
                sched = clone_schedule(prod)
                da = get_day(sched, day_a)
                db = get_day(sched, day_b)
                da["scene_ids"], db["scene_ids"] = (
                    list(db["scene_ids"]),
                    list(da["scene_ids"]),
                )
                changes = (
                    [SceneChange(scene_id=sid, action="swap", from_day=day_a, to_day=day_b,
                                 reason=f"Scene {sid} moved from Day {day_a} to Day {day_b}.")
                     for sid in obj_a["scene_ids"]]
                    + [SceneChange(scene_id=sid, action="swap", from_day=day_b, to_day=day_a,
                                   reason=f"Scene {sid} moved from Day {day_b} to Day {day_a}.")
                       for sid in obj_b["scene_ids"]]
                )
                cands.append(Candidate(
                    "swap_days_direct",
                    f"Swap all scenes between Day {day_a} and Day {day_b}.",
                    changes, sched,
                ))

    # ── hold: mark scene as not shooting (treated as cut for cost purposes) ──
    elif intent.action == "hold" and intent.scene_ids:
        for sid in intent.scene_ids:
            sched = clone_schedule(prod)
            src = find_scene_day(sched, sid)
            if src is None:
                continue
            get_day(sched, src)["scene_ids"].remove(sid)
            changes = [SceneChange(
                scene_id=sid, action="hold", from_day=src,
                reason=f"Scene {sid} held (removed from Day {src}, not cut permanently).",
            )]
            cands.append(Candidate(
                f"hold_{sid}",
                f"Hold scene {sid} — pull it from Day {src} without cutting it from the script.",
                changes, sched,
            ))

    elif intent.action == "move" and intent.target_day is not None:
        scene_ids = intent.scene_ids
        target = intent.target_day

        # 1. straight move
        sched = clone_schedule(prod)
        changes = [c for sid in scene_ids if (c := move_scene(sched, prod, sid, target))]
        if changes:
            cands.append(
                Candidate(
                    "direct_move",
                    f"Move {_scenes_label(scene_ids)} straight onto Day {target} and absorb the longer day.",
                    changes,
                    sched,
                )
            )

        # 2. move + cascade the overflow off the target day
        sched = clone_schedule(prod)
        changes = [c for sid in scene_ids if (c := move_scene(sched, prod, sid, target))]
        if changes:
            cascade = _relieve_overflow(sched, prod, target)
            if cascade:
                cands.append(
                    Candidate(
                        "move_and_cascade",
                        f"Move {_scenes_label(scene_ids)} to Day {target} and push the lightest work off that day to protect the hours.",
                        changes + cascade,
                        sched,
                    )
                )

        # 3. swap with each scene already on the target day (closest in length first)
        primary = scene_ids[0]
        origin = find_scene_day(prod["days"], primary)
        target_day = get_day(prod["days"], target)
        if target_day and origin is not None:
            primary_hours = float(prod["_scenes_by_id"][primary]["est_hours"])
            partners = sorted(
                target_day["scene_ids"],
                key=lambda sid: abs(float(prod["_scenes_by_id"][sid]["est_hours"]) - primary_hours),
            )
            for partner in partners[:2]:
                sched = clone_schedule(prod)
                changes = swap_scenes(sched, prod, primary, partner)
                if changes:
                    cands.append(
                        Candidate(
                            f"swap_{primary}_{partner}",
                            f"Trade scene {primary} with scene {partner} so both days keep their length.",
                            changes,
                            sched,
                        )
                    )

        # 4. neighbouring days, when the requested day is a bad fit
        for offset in (-1, 1, 2):
            alt = target + offset
            if alt < 1 or alt == target or not get_day(prod["days"], alt):
                continue
            sched = clone_schedule(prod)
            changes = [c for sid in scene_ids if (c := move_scene(sched, prod, sid, alt))]
            if changes:
                cands.append(
                    Candidate(
                        f"alternative_day_{alt}",
                        f"Land {_scenes_label(scene_ids)} on Day {alt} instead — closest day that holds the change.",
                        changes,
                        sched,
                    )
                )

    elif intent.action == "swap" and len(intent.scene_ids) >= 2:
        a, b = intent.scene_ids[0], intent.scene_ids[1]
        sched = clone_schedule(prod)
        changes = swap_scenes(sched, prod, a, b)
        if changes:
            cands.append(Candidate("direct_swap", f"Trade scenes {a} and {b} as asked.", changes, sched))

        for first, second in ((a, b), (b, a)):
            dst = find_scene_day(prod["days"], second)
            if dst is None:
                continue
            sched = clone_schedule(prod)
            ch = move_scene(sched, prod, first, dst)
            if ch:
                cascade = _relieve_overflow(sched, prod, dst)
                cands.append(
                    Candidate(
                        f"one_way_{first}",
                        f"Move scene {first} only and leave scene {second} where it is.",
                        [ch] + cascade,
                        sched,
                    )
                )

    elif intent.action == "cut" and intent.scene_ids:
        sid = intent.scene_ids[0]
        sched = clone_schedule(prod)
        ch = cut_scene(sched, sid)
        if ch:
            cands.append(Candidate("direct_cut", f"Cut scene {sid} and leave the rest of the board alone.", [ch], sched))

        # cut + consolidate: pull work forward into the freed space
        src_day = find_scene_day(prod["days"], sid)
        sched = clone_schedule(prod)
        ch = cut_scene(sched, sid)
        if ch and src_day is not None:
            donors = sorted(
                (d for d in sched if d["day"] != src_day and d["scene_ids"]),
                key=lambda d: -day_hours(d, prod),
            )
            extra: list[SceneChange] = []
            if donors:
                heaviest = donors[0]
                lightest = min(
                    heaviest["scene_ids"],
                    key=lambda s: float(prod["_scenes_by_id"][s]["est_hours"]),
                )
                mv = move_scene(sched, prod, lightest, src_day)
                if mv:
                    mv.reason = f"Scene {lightest} pulled into the space freed on Day {src_day}."
                    extra.append(mv)
            if extra:
                cands.append(
                    Candidate(
                        "cut_and_consolidate",
                        f"Cut scene {sid} and pull work forward into the gap so no day goes half empty.",
                        [ch] + extra,
                        sched,
                    )
                )

    # dedupe identical resulting boards
    seen: set[str] = set()
    unique: list[Candidate] = []
    for c in cands:
        key = "|".join(f"{d['day']}:{','.join(sorted(d['scene_ids']))}" for d in c.schedule)
        if key in seen:
            continue
        seen.add(key)
        unique.append(c)
    return unique


def _scenes_label(scene_ids: list[str]) -> str:
    if len(scene_ids) == 1:
        return f"scene {scene_ids[0]}"
    return "scenes " + ", ".join(scene_ids)


# --------------------------------------------------------------------------
# scoring
# --------------------------------------------------------------------------
def evaluate(
    intent: ParsedIntent, prod: dict[str, Any], max_plans: int = 3
) -> tuple[list[Plan], list[RejectedPlan], float]:
    baseline_schedule = clone_schedule(prod)
    baseline_violations = validate(baseline_schedule, prod)
    baseline = compute_cost(baseline_schedule, prod, baseline_violations)

    scored: list[tuple[float, Plan]] = []
    rejected: list[RejectedPlan] = []

    for cand in build_candidates(intent, prod):
        violations = mark_preexisting(validate(cand.schedule, prod), baseline_violations)
        hard = hard_violations(violations)
        cost = compute_cost(cand.schedule, prod, violations)
        breakdown = diff_costs(baseline, cost)

        if hard:
            rejected.append(
                RejectedPlan(
                    strategy=cand.strategy,
                    changes=cand.changes,
                    cost=breakdown.delta,
                    reasons=[v.message for v in hard],
                )
            )
            continue

        risk = risk_score(violations)
        delta_risk = risk_delta(violations, baseline_violations)
        plan = Plan(
            rank=0,
            changes=cand.changes,
            cost=round(breakdown.delta),
            strategy=cand.strategy,
            summary=cand.summary,
            risk_score=risk,
            risk_delta=delta_risk,
            honors_request=not cand.strategy.startswith("alternative_day"),
            feasible=True,
            cost_breakdown=breakdown,
            violations=violations,
            schedule=[
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
                for m in cost["metrics"]
            ],
        )
        # Rank on risk-adjusted cost, with a nudge against plans that ignore the
        # literal request when a compliant option exists.
        penalty = 0.0 if plan.honors_request else 5_000.0
        scored.append((breakdown.delta + delta_risk * RISK_PRICE + penalty, plan))

    scored.sort(key=lambda pair: pair[0])
    plans: list[Plan] = []
    for i, (_, plan) in enumerate(scored[:max_plans], start=1):
        plan.rank = i
        plans.append(plan)

    return plans, rejected, baseline["total"]
