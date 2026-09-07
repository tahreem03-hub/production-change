"""Parallel Search API integration.

Endpoint: POST https://api.parallel.ai/v1/search
Auth:     x-api-key header
Body:     {"objective": str, "search_queries": [str, ...], "mode": "fast", ...}
Response: {"search_id": ..., "results": [{"url", "title", "publish_date", "excerpts"}], ...}

Search is used as *evidence*, not as a source of truth for the numbers: it
grounds the union rules, permit lead times, and rate assumptions that the cost
model applies, and every plan ships the citations back to the UI.

Search failures never fail a request. If the key is missing, the network is
down, or Parallel returns a non-200, we log it and return an empty list so the
deterministic scheduling core still answers.
"""

from __future__ import annotations

import asyncio
import hashlib
import logging
import time
from typing import Any, Optional

import httpx

from .config import (
    PARALLEL_API_KEY,
    PARALLEL_BASE_URL,
    PARALLEL_MAX_CHARS_PER_RESULT,
    PARALLEL_MAX_RESULTS,
    PARALLEL_SEARCH_MODE,
    PARALLEL_TIMEOUT,
)
from .schemas import ParallelResult

log = logging.getLogger("pca.tools")

_CACHE: dict[str, tuple[float, list[dict[str, Any]]]] = {}
_CACHE_TTL = 900  # seconds


def search_enabled() -> bool:
    return bool(PARALLEL_API_KEY)


def _cache_key(objective: str, queries: list[str]) -> str:
    return hashlib.sha256((objective + "|" + "|".join(queries)).encode()).hexdigest()


async def parallel_search(
    objective: str,
    search_queries: list[str],
    *,
    client: Optional[httpx.AsyncClient] = None,
    max_results: int = PARALLEL_MAX_RESULTS,
    session_id: Optional[str] = None,
) -> list[dict[str, Any]]:
    """Single call to Parallel Search. Returns raw result dicts (possibly empty)."""
    if not PARALLEL_API_KEY:
        log.warning("PARALLEL_API_KEY is not set; skipping search.")
        return []

    key = _cache_key(objective, search_queries)
    hit = _CACHE.get(key)
    if hit and time.time() - hit[0] < _CACHE_TTL:
        return hit[1]

    payload: dict[str, Any] = {
        "objective": objective,
        "search_queries": search_queries,
        "mode": PARALLEL_SEARCH_MODE,
        "advanced_settings": {
            "max_results": max_results,
            "excerpt_settings": {"max_chars_per_result": PARALLEL_MAX_CHARS_PER_RESULT},
        },
    }
    if session_id:
        payload["session_id"] = session_id

    headers = {"x-api-key": PARALLEL_API_KEY, "Content-Type": "application/json"}
    owns_client = client is None
    client = client or httpx.AsyncClient(timeout=PARALLEL_TIMEOUT)

    try:
        resp = await client.post(
            f"{PARALLEL_BASE_URL}/v1/search", json=payload, headers=headers
        )
        if resp.status_code != 200:
            log.error("Parallel Search %s: %s", resp.status_code, resp.text[:400])
            return []
        results = resp.json().get("results", []) or []
        _CACHE[key] = (time.time(), results)
        return results
    except (httpx.HTTPError, ValueError) as exc:
        log.error("Parallel Search failed: %s", exc)
        return []
    finally:
        if owns_client:
            await client.aclose()


def _build_queries(
    intent: Any, scenes: list[dict[str, Any]], locations: list[dict[str, Any]]
) -> list[tuple[str, str, list[str]]]:
    """(relevance_tag, objective, search_queries) tuples for this change request."""
    scene_desc = ", ".join(f"scene {s['id']} ({s['slug']})" for s in scenes) or "the scene"
    loc_names = ", ".join(sorted({loc["name"] for loc in locations})) or "the location"
    loc_types = sorted({loc.get("type", "practical") for loc in locations})
    night = any(s.get("day_night") == "NIGHT" for s in scenes)

    jobs: list[tuple[str, str, list[str]]] = [
        (
            "union_rules",
            (
                "Find the current union rules and penalty costs that apply when a film "
                "production reschedules a shoot day: minimum cast and crew turnaround "
                "between wrap and next call, forced-call penalties, meal penalties, and "
                "overtime multipliers. Focus on SAG-AFTRA and IATSE agreements."
            ),
            [
                "SAG-AFTRA turnaround forced call penalty",
                "IATSE meal penalty overtime rules",
                "film crew overtime multiplier rate card",
            ],
        ),
        (
            "rescheduling_cost",
            (
                f"Find real-world guidance and reported figures on what it costs a film "
                f"production to move a scene between shoot days — company move costs, "
                f"cast hold and drop/pickup rules, and idle crew days. Context: moving "
                f"{scene_desc}."
            ),
            [
                "film production company move cost",
                "cast hold day drop pickup rules",
                "shooting schedule change cost overrun",
            ],
        ),
    ]

    if any(t == "practical" for t in loc_types):
        jobs.append(
            (
                "permits",
                (
                    f"Find the permit lead time, application window, and rush-fee rules for "
                    f"filming at practical exterior locations similar to {loc_names}, "
                    f"including how quickly a permitted shoot date can be changed."
                ),
                [
                    "film permit lead time change date",
                    "location filming permit rush fee",
                    "street closure film permit requirements",
                ],
            )
        )

    if night:
        jobs.append(
            (
                "night_work",
                (
                    "Find how night shoots affect scheduling constraints and cost: night "
                    "premiums, split-day turnaround, and the risks of scheduling a night "
                    "scene adjacent to a day scene."
                ),
                [
                    "night shoot premium film budget",
                    "day to night turnaround scheduling",
                ],
            )
        )

    return jobs


async def gather_production_context(
    intent: Any,
    scenes: list[dict[str, Any]],
    locations: list[dict[str, Any]],
    *,
    session_id: Optional[str] = None,
) -> list[ParallelResult]:
    """Run all searches for a change request concurrently and dedupe by URL."""
    jobs = _build_queries(intent, scenes, locations)
    if not search_enabled():
        return []

    async with httpx.AsyncClient(timeout=PARALLEL_TIMEOUT) as client:
        raw = await asyncio.gather(
            *[
                parallel_search(obj, qs, client=client, session_id=session_id)
                for _, obj, qs in jobs
            ],
            return_exceptions=True,
        )

    seen: set[str] = set()
    out: list[ParallelResult] = []
    for (tag, _, _), results in zip(jobs, raw):
        if isinstance(results, BaseException):
            log.error("search job %s raised: %s", tag, results)
            continue
        for r in results:
            url = r.get("url")
            if not url or url in seen:
                continue
            seen.add(url)
            out.append(
                ParallelResult(
                    url=url,
                    title=r.get("title"),
                    publish_date=r.get("publish_date"),
                    excerpts=(r.get("excerpts") or [])[:2],
                    relevance=tag,
                )
            )
    return out