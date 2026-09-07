"""Schedule rule validation.

Two classes of finding:

* **hard**  - the plan cannot be shot. Cast is unavailable, the location is
  dark that date, the day is physically too long. A plan with any hard
  violation is rejected and never ranked.
* **soft**  - the plan is shootable but it costs money or burns goodwill:
  short turnaround, overtime, mixed day/night, permit rush, page overload.
  Each soft violation carries a penalty the cost model charges and a weight
  that feeds the risk score.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Optional

from .schemas import Violation

# risk weight per soft violation code (risk score is capped at 100)
RISK_WEIGHTS = {
    "TURNAROUND": 22,
    "OVERTIME": 12,
    "LONG_DAY": 18,
    "MIXED_DAY_NIGHT": 10,
    "PAGE_OVERLOAD": 8,
    "PERMIT_RUSH": 15,
    "MULTI_MOVE": 9,
    "IDLE_DAY": 6,
    "SPLIT_LOCATION": 7,
}


def _dt(date_str: str, call_time: str) -> datetime:
    return datetime.strptime(f"{date_str} {call_time}", "%Y-%m-%d %H:%M")


def existing_permits(prod: dict[str, Any]) -> set[tuple[str, str]]:
    """(location_id, date) pairs already permitted on the current board.

    Permits are pulled against a specific location *and* date, so a plan only
    triggers permit work when it puts a location on a date it was not booked
    for. Keeping the location where it already is is free.
    """
    pairs: set[tuple[str, str]] = set()
    for day in prod["days"]:
        for sid in day["scene_ids"]:
            pairs.add((prod["_scenes_by_id"][sid]["location_id"], day["date"]))
    return pairs


def day_hours(day: dict[str, Any], prod: dict[str, Any]) -> float:
    """Estimated hours on the floor: scene time + company moves + wrap buffer."""
    scenes = [prod["_scenes_by_id"][sid] for sid in day["scene_ids"]]
    if not scenes:
        return 0.0
    hours = sum(float(s["est_hours"]) for s in scenes)
    moves = max(0, len({s["location_id"] for s in scenes}) - 1)
    hours += moves * 1.5
    hours += float(prod["rules"].get("wrap_buffer_hours", 1.0))
    return round(hours, 2)


def day_metrics(day: dict[str, Any], prod: dict[str, Any]) -> dict[str, Any]:
    scenes = [prod["_scenes_by_id"][sid] for sid in day["scene_ids"]]
    locations = {s["location_id"] for s in scenes}
    cast = sorted({c for s in scenes for c in s["cast_ids"]})
    hours = day_hours(day, prod)
    call = _dt(day["date"], day.get("call_time", "07:00"))
    return {
        "day": day["day"],
        "date": day["date"],
        "call_time": day.get("call_time", "07:00"),
        "scene_ids": list(day["scene_ids"]),
        "hours": hours,
        "pages": round(sum(float(s["pages"]) for s in scenes), 2),
        "location_ids": sorted(locations),
        "company_moves": max(0, len(locations) - 1),
        "cast_ids": cast,
        "call_dt": call,
        "wrap_dt": call + timedelta(hours=hours),
        "has_night": any(s["day_night"] == "NIGHT" for s in scenes),
        "has_day": any(s["day_night"] == "DAY" for s in scenes),
        "empty": not scenes,
    }


def validate(schedule: list[dict[str, Any]], prod: dict[str, Any]) -> list[Violation]:
    rules = prod["rules"]
    rates = prod["rates"]
    cast_by_id = prod["_cast_by_id"]
    loc_by_id = prod["_locations_by_id"]
    reference = datetime.strptime(
        prod["production"].get("current_date", prod["production"]["start_date"]),
        "%Y-%m-%d",
    )
    already_permitted = existing_permits(prod)

    metrics = [day_metrics(d, prod) for d in schedule]
    out: list[Violation] = []

    for m in metrics:
        if m["empty"]:
            out.append(
                Violation(
                    code="IDLE_DAY",
                    severity="soft",
                    day=m["day"],
                    message=f"Day {m['day']} has no scenes. Crew is either wrapped early or idle.",
                )
            )
            continue

        # --- cast availability (hard) ---------------------------------
        for cid in m["cast_ids"]:
            member = cast_by_id[cid]
            if m["date"] in member.get("unavailable", []):
                out.append(
                    Violation(
                        code="CAST_UNAVAILABLE",
                        severity="hard",
                        day=m["day"],
                        message=(
                            f"{member['name']} ({member['role']}) is unavailable on "
                            f"{m['date']} but is called for Day {m['day']}."
                        ),
                    )
                )

        # --- location availability (hard) -----------------------------
        for lid in m["location_ids"]:
            loc = loc_by_id[lid]
            if m["date"] in loc.get("blackout_dates", []):
                out.append(
                    Violation(
                        code="LOCATION_BLACKOUT",
                        severity="hard",
                        day=m["day"],
                        message=f"{loc['name']} is unavailable on {m['date']}.",
                    )
                )

        # --- day length ------------------------------------------------
        if m["hours"] > float(rules["max_shoot_hours"]):
            out.append(
                Violation(
                    code="DAY_TOO_LONG",
                    severity="hard",
                    day=m["day"],
                    message=(
                        f"Day {m['day']} runs {m['hours']}h, over the "
                        f"{rules['max_shoot_hours']}h hard cap."
                    ),
                )
            )
        elif m["hours"] > float(rules["standard_shoot_hours"]) + 2:
            out.append(
                Violation(
                    code="LONG_DAY",
                    severity="soft",
                    day=m["day"],
                    message=f"Day {m['day']} runs {m['hours']}h — a heavy day.",
                )
            )
        elif m["hours"] > float(rules["standard_shoot_hours"]):
            out.append(
                Violation(
                    code="OVERTIME",
                    severity="soft",
                    day=m["day"],
                    message=(
                        f"Day {m['day']} runs {m['hours']}h, "
                        f"{round(m['hours'] - float(rules['standard_shoot_hours']), 1)}h into overtime."
                    ),
                )
            )

        # --- pages -----------------------------------------------------
        if m["pages"] > float(rules["max_pages_per_day"]):
            out.append(
                Violation(
                    code="PAGE_OVERLOAD",
                    severity="soft",
                    day=m["day"],
                    message=(
                        f"Day {m['day']} carries {m['pages']} pages against a "
                        f"{rules['max_pages_per_day']} page target."
                    ),
                )
            )

        # --- mixed day/night -------------------------------------------
        if m["has_day"] and m["has_night"]:
            out.append(
                Violation(
                    code="MIXED_DAY_NIGHT",
                    severity="soft",
                    day=m["day"],
                    message=(
                        f"Day {m['day']} mixes day and night scenes — needs a relight "
                        f"and stretches the day."
                    ),
                    penalty=float(rates["night_premium_per_day"]),
                )
            )

        # --- company moves ----------------------------------------------
        if m["company_moves"] >= 2:
            out.append(
                Violation(
                    code="MULTI_MOVE",
                    severity="soft",
                    day=m["day"],
                    message=f"Day {m['day']} requires {m['company_moves']} company moves.",
                )
            )
        elif m["company_moves"] == 1:
            out.append(
                Violation(
                    code="SPLIT_LOCATION",
                    severity="soft",
                    day=m["day"],
                    message=f"Day {m['day']} splits across two locations.",
                )
            )

        # --- permits -----------------------------------------------------
        days_out = (datetime.strptime(m["date"], "%Y-%m-%d") - reference).days
        for lid in m["location_ids"]:
            loc = loc_by_id[lid]
            lead = int(loc.get("permit_lead_days", 0))
            if lead <= 0 or (lid, m["date"]) in already_permitted:
                continue
            if days_out < 1:
                out.append(
                    Violation(
                        code="PERMIT_IMPOSSIBLE",
                        severity="hard",
                        day=m["day"],
                        message=(
                            f"{loc['name']} needs {lead} days of permit lead time and "
                            f"there is no time left to file."
                        ),
                    )
                )
            elif days_out < lead:
                out.append(
                    Violation(
                        code="PERMIT_RUSH",
                        severity="soft",
                        day=m["day"],
                        message=(
                            f"{loc['name']} on Day {m['day']} is {days_out} days out but "
                            f"needs {lead}. Rush filing required."
                        ),
                        penalty=float(rates["permit_rush_fee"]),
                    )
                )

    # --- turnaround between consecutive shoot days -----------------------
    active = [m for m in metrics if not m["empty"]]
    for prev, nxt in zip(active, active[1:]):
        gap = (nxt["call_dt"] - prev["wrap_dt"]).total_seconds() / 3600.0
        if gap < float(rules["turnaround_hours"]):
            shared = sorted(set(prev["cast_ids"]) & set(nxt["cast_ids"]))
            penalty = len(shared) * float(rates["forced_call_penalty_per_cast"])
            names = ", ".join(cast_by_id[c]["name"] for c in shared) or "crew only"
            out.append(
                Violation(
                    code="TURNAROUND",
                    severity="soft",
                    day=nxt["day"],
                    message=(
                        f"Only {round(gap, 1)}h turnaround into Day {nxt['day']} "
                        f"(minimum {rules['turnaround_hours']}h). Forced call for: {names}."
                    ),
                    penalty=penalty,
                )
            )

    return out


def risk_score(violations: list[Violation]) -> float:
    score = sum(RISK_WEIGHTS.get(v.code, 5) for v in violations if v.severity == "soft")
    return float(min(100, score))


def _keys(violations: list[Violation]) -> set[tuple[str, Optional[int]]]:
    return {(v.code, v.day) for v in violations if v.severity == "soft"}


def mark_preexisting(
    violations: list[Violation], baseline: list[Violation]
) -> list[Violation]:
    """Flag the problems the current schedule already had, so the UI can show
    what this plan actually introduced."""
    known = _keys(baseline)
    for v in violations:
        v.preexisting = (v.code, v.day) in known
    return violations


def risk_delta(violations: list[Violation], baseline: list[Violation]) -> float:
    """Risk added minus risk removed, relative to the current schedule."""
    now, before = _keys(violations), _keys(baseline)
    added = sum(RISK_WEIGHTS.get(code, 5) for code, _ in now - before)
    removed = sum(RISK_WEIGHTS.get(code, 5) for code, _ in before - now)
    return float(added - removed)


def hard_violations(violations: list[Violation]) -> list[Violation]:
    return [v for v in violations if v.severity == "hard"]


def find_scene_day(schedule: list[dict[str, Any]], scene_id: str) -> Optional[int]:
    for day in schedule:
        if scene_id in day["scene_ids"]:
            return day["day"]
    return None