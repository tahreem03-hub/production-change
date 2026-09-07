"""Pydantic models for the Production Change Agent API.

The response contract the frontend depends on:

    {
      "plans": [
        {"rank": 1, "changes": [...], "cost": 123, "parallel_results": [...]},
        {"rank": 2, "changes": [...], "cost": 145},
        {"rank": 3, "changes": [...], "cost": 167}
      ]
    }

Everything beyond `rank`, `changes` and `cost` is additive, so a client that
only reads those three fields keeps working.
"""

from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


# --------------------------------------------------------------------------
# Request
# --------------------------------------------------------------------------
class ChangeRequest(BaseModel):
    request: str = Field(
        ...,
        description="Natural language change request, e.g. 'move scene 5 to day 3'.",
        examples=["move scene 5 to day 3"],
    )
    production_id: Optional[str] = Field(
        default=None,
        description="Reserved for multi-production support. Ignored today.",
    )
    max_plans: int = Field(default=3, ge=1, le=6)
    use_search: bool = Field(
        default=True,
        description="Set false to skip the Parallel Search call (faster demos / offline).",
    )


# --------------------------------------------------------------------------
# Parallel Search
# --------------------------------------------------------------------------
class ParallelResult(BaseModel):
    url: str
    title: Optional[str] = None
    publish_date: Optional[str] = None
    excerpts: list[str] = Field(default_factory=list)
    relevance: Optional[str] = Field(
        default=None,
        description="Which part of the analysis this source was retrieved for.",
    )


# --------------------------------------------------------------------------
# Plans
# --------------------------------------------------------------------------
class SceneChange(BaseModel):
    """One atomic edit to the stripboard."""

    scene_id: str
    action: Literal["move", "swap", "cut", "hold"]
    from_day: Optional[int] = None
    to_day: Optional[int] = None
    reason: str = ""


class CostLine(BaseModel):
    label: str
    amount: float
    note: str = ""


class CostBreakdown(BaseModel):
    baseline_total: float
    plan_total: float
    delta: float
    lines: list[CostLine] = Field(default_factory=list)


class Violation(BaseModel):
    code: str
    severity: Literal["hard", "soft"]
    message: str
    scene_id: Optional[str] = None
    day: Optional[int] = None
    penalty: float = 0.0
    preexisting: bool = Field(
        default=False,
        description="True when the current schedule already has this problem — the plan did not cause it.",
    )


class Plan(BaseModel):
    rank: int
    changes: list[SceneChange]
    cost: float = Field(..., description="Incremental cost vs. the current schedule, in whole currency units.")
    strategy: str = ""
    summary: str = ""
    risk_score: float = 0.0
    risk_delta: float = Field(
        default=0.0,
        description="Risk this plan adds (positive) or removes (negative) versus the current schedule.",
    )
    honors_request: bool = Field(
        default=True, description="False when the plan deviates from the literal request."
    )
    feasible: bool = True
    cost_breakdown: Optional[CostBreakdown] = None
    violations: list[Violation] = Field(default_factory=list)
    schedule: list[dict[str, Any]] = Field(
        default_factory=list, description="Resulting stripboard: one entry per shoot day."
    )
    parallel_results: list[ParallelResult] = Field(default_factory=list)


class RejectedPlan(BaseModel):
    strategy: str
    changes: list[SceneChange]
    cost: Optional[float] = None
    reasons: list[str]


class ParsedIntent(BaseModel):
    action: Literal["move", "swap", "cut", "unknown"]
    scene_ids: list[str] = Field(default_factory=list)
    target_day: Optional[int] = None
    raw: str = ""
    parser: str = "rules"
    confidence: float = 1.0


class ChangeResponse(BaseModel):
    status: Literal["ok", "no_viable_plan"] = "ok"
    plans: list[Plan]
    request: str = ""
    intent: Optional[ParsedIntent] = None
    rejected: list[RejectedPlan] = Field(default_factory=list)
    baseline_cost: float = 0.0
    search_used: bool = False
    trace: list[str] = Field(default_factory=list)
    elapsed_ms: int = 0