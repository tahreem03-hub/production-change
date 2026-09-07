"""Cost model.

Everything the agent claims about money comes from here, so the numbers are
deterministic and auditable — the LLM never invents a figure. Rates live in
`data/production.json`; Parallel Search supplies the citations that justify
those rates and the union rules behind the penalties.
"""

from __future__ import annotations

import math
from typing import Any

from .schemas import CostBreakdown, CostLine, Violation
from .validator import day_metrics


def compute_cost(
    schedule: list[dict[str, Any]],
    prod: dict[str, Any],
    violations: list[Violation] | None = None,
) -> dict[str, Any]:
    """Total cost of a schedule, broken into labelled lines."""
    rules, rates = prod["rules"], prod["rates"]
    loc_by_id = prod["_locations_by_id"]
    cast_by_id = prod["_cast_by_id"]
    violations = violations or []

    metrics = [day_metrics(d, prod) for d in schedule]
    active = [m for m in metrics if not m["empty"]]

    standard = float(rules["standard_shoot_hours"])
    crew_size = int(rates["crew_size"])

    crew_base = len(active) * float(rates["crew_base_day"])

    location_fees = 0.0
    for m in active:
        location_fees += sum(float(loc_by_id[lid]["day_rate"]) for lid in m["location_ids"])

    moves = sum(m["company_moves"] for m in active)
    move_cost = moves * float(rates["company_move_cost"])

    ot_hours = sum(max(0.0, m["hours"] - standard) for m in active)
    overtime = ot_hours * float(rates["crew_overtime_hourly"])

    # Meal penalties accrue per half hour past the second meal (12h mark).
    meal_units = sum(math.ceil(max(0.0, m["hours"] - 12.0) * 2) for m in active)
    meals = meal_units * crew_size * float(rates["meal_penalty_per_head"])

    night_days = sum(1 for m in active if m["has_night"])
    night_premium = night_days * float(rates["night_premium_per_day"])

    # --- cast: work days and hold days ---------------------------------
    cast_work = 0.0
    cast_hold = 0.0
    hold_detail: list[str] = []
    for cid, member in cast_by_id.items():
        idx = [i for i, m in enumerate(active) if cid in m["cast_ids"]]
        if not idx:
            continue
        span = idx[-1] - idx[0] + 1
        worked = len(idx)
        held = span - worked
        rate = float(member["day_rate"])
        if member.get("deal") == "weekly":
            cast_work += span * rate  # weekly players are paid across the span
        else:
            cast_work += worked * rate
            cast_hold += held * float(member.get("hold_rate", rate / 2))
        if held:
            hold_detail.append(f"{member['name']} x{held}")

    penalties = sum(v.penalty for v in violations)
    penalty_notes = ", ".join(
        sorted({v.code for v in violations if v.penalty > 0})
    )

    lines = [
        CostLine(label="Crew base days", amount=crew_base, note=f"{len(active)} shoot days"),
        CostLine(label="Location fees", amount=location_fees),
        CostLine(label="Company moves", amount=move_cost, note=f"{moves} moves"),
        CostLine(label="Crew overtime", amount=overtime, note=f"{round(ot_hours, 1)} OT hours"),
        CostLine(label="Meal penalties", amount=meals, note=f"{meal_units} half-hour units"),
        CostLine(label="Night premium", amount=night_premium, note=f"{night_days} night days"),
        CostLine(label="Cast work days", amount=cast_work),
        CostLine(
            label="Cast hold days",
            amount=cast_hold,
            note="; ".join(hold_detail) or "none",
        ),
        CostLine(label="Rule penalties", amount=penalties, note=penalty_notes or "none"),
    ]

    total = sum(line.amount for line in lines)
    return {"total": round(total, 2), "lines": lines, "metrics": metrics}


def diff_costs(baseline: dict[str, Any], plan: dict[str, Any]) -> CostBreakdown:
    """Per-label delta between the current schedule and a candidate plan."""
    base_lines = {line.label: line for line in baseline["lines"]}
    delta_lines: list[CostLine] = []
    for line in plan["lines"]:
        base = base_lines.get(line.label)
        delta = line.amount - (base.amount if base else 0.0)
        if abs(delta) >= 0.01:
            delta_lines.append(
                CostLine(label=line.label, amount=round(delta, 2), note=line.note)
            )
    return CostBreakdown(
        baseline_total=baseline["total"],
        plan_total=plan["total"],
        delta=round(plan["total"] - baseline["total"], 2),
        lines=sorted(delta_lines, key=lambda l: -abs(l.amount)),
    )