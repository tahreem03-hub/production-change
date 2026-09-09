"""Turn a natural-language change request into a structured intent.

Rules first (fast, free, deterministic — matters when you are demoing on
conference wifi). If the regexes miss and GEMINI_API_KEY is set, fall back to
an LLM call that must return strict JSON.

Supported phrasings (all case-insensitive):
  MOVE  – move/shift/push/pull/reschedule/bump/slide/put scene 5 to day 3
         – scene 5 to/-> day 3
         – move scene 5 and 6 to day 3
         – push day 4 to day 6   (moves ALL scenes from day 4 → day 6)
         – move everything on day 2 to day 4
         – move all scenes from day 1 to day 3
  SWAP  – swap scene 4 and scene 9
         – switch/flip/exchange/trade scenes 4 and 9
         – swap day 2 and day 5  (swaps all scenes between two days)
  CUT   – cut/drop/omit/remove/delete/scrap scene 7
         – cut scenes 7 and 8
  HOLD  – hold scene 5            (mark scene as not-shooting)
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any, Optional

import httpx

from .config import GEMINI_API_KEY, GEMINI_MODEL
from .schemas import ParsedIntent

log = logging.getLogger("pca.parser")

# ---------------------------------------------------------------------------
# Word-number look-up
# ---------------------------------------------------------------------------
_WORD_NUMBERS: dict[str, int] = {
    "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6,
    "seven": 7, "eight": 8, "nine": 9, "ten": 10, "eleven": 11, "twelve": 12,
    "thirteen": 13, "fourteen": 14, "fifteen": 15,
}

# ---------------------------------------------------------------------------
# Verb groups
# ---------------------------------------------------------------------------
_MOVE_VERBS  = r"(?:move|shift|push|pull|reschedule|bump|slide|put|relocate|transfer|send)"
_CUT_VERBS   = r"(?:cut|drop|omit|remove|delete|scrap|cancel|scratch|eliminate)"
_SWAP_VERBS  = r"(?:swap|switch|flip|exchange|trade|rotate)"
_HOLD_VERBS  = r"(?:hold|pause|delay|defer|postpone|freeze)"

# ---------------------------------------------------------------------------
# Token helpers
# ---------------------------------------------------------------------------
_NUM_WORDS   = "|".join(_WORD_NUMBERS.keys())
_NUM_PATTERN = rf"(\d+|{_NUM_WORDS})"   # captures one number token


def _num(token: str) -> Optional[int]:
    t = token.strip().lower()
    if t.isdigit():
        return int(t)
    return _WORD_NUMBERS.get(t)


def extract_scene_list(text: str) -> list[str]:
    """Return all scene-id tokens from a fragment like '5', '5, 6', '5 and 6 and 7'."""
    return re.findall(r"\d+", text)


# ---------------------------------------------------------------------------
# Rule-based parser
# ---------------------------------------------------------------------------
def parse_rules(text: str) -> ParsedIntent:  # noqa: PLR0912
    t = " ".join(text.lower().split())

    # ── SWAP scenes ─────────────────────────────────────────────────────────
    # swap scene 4 and scene 9  |  swap scenes 4 and 9
    m = re.search(
        rf"{_SWAP_VERBS}\s+(?:scenes?\s+){_NUM_PATTERN}"
        rf"\s*(?:and|with|&|for)\s*(?:scene\s+)?{_NUM_PATTERN}",
        t,
    )
    if m:
        return ParsedIntent(
            action="swap", scene_ids=[m.group(1), m.group(2)], raw=text, parser="rules"
        )

    # swap day 2 and day 5  (swaps ALL scenes on those two days)
    m = re.search(
        rf"{_SWAP_VERBS}\s+days?\s+{_NUM_PATTERN}\s*(?:and|with|&)\s*days?\s+{_NUM_PATTERN}",
        t,
    )
    if m:
        d1, d2 = _num(m.group(1)), _num(m.group(2))
        if d1 and d2:
            return ParsedIntent(
                action="swap_days",
                scene_ids=[],
                target_day=d1,
                raw=text,
                parser="rules",
                confidence=0.9,
                # encode second day in raw for the backend to read
                extra={"day_a": d1, "day_b": d2},
            )

    # ── MOVE: scene(s) to a day ─────────────────────────────────────────────
    # move scene 5 to day 3
    # move scenes 5, 6 and 7 to day 3
    m = re.search(
        rf"{_MOVE_VERBS}\s+(?:scenes?\s+){_NUM_PATTERN}"
        rf"((?:\s*[,&]?\s*(?:and\s+)?(?:scene\s+)?\d+)*)"
        rf".*?\bto\s+day\s+{_NUM_PATTERN}",
        t,
    )
    if m:
        extra = extract_scene_list(m.group(2) or "")
        tday = _num(m.group(3))
        if tday:
            return ParsedIntent(
                action="move",
                scene_ids=[m.group(1)] + extra,
                target_day=tday,
                raw=text,
                parser="rules",
            )

    # move scene 5 and 6 to day 3  (variant without "scenes" prefix)
    m = re.search(
        rf"{_MOVE_VERBS}\s+(?:scene\s+)?{_NUM_PATTERN}"
        rf"((?:\s*[,&]\s*\d+|\s+and\s+\d+)*)"
        rf"\s+(?:to|onto|into)\s+day\s+{_NUM_PATTERN}",
        t,
    )
    if m:
        extra = extract_scene_list(m.group(2) or "")
        tday = _num(m.group(3))
        if tday:
            return ParsedIntent(
                action="move",
                scene_ids=[m.group(1)] + extra,
                target_day=tday,
                raw=text,
                parser="rules",
            )

    # scene 5 -> day 3  |  scene 5 to day 3  |  scene 5 onto day 3
    m = re.search(
        rf"scene\s+{_NUM_PATTERN}\s*(?:->|→|to|onto|into|on)\s*day\s+{_NUM_PATTERN}",
        t,
    )
    if m:
        tday = _num(m.group(2))
        if tday:
            return ParsedIntent(
                action="move",
                scene_ids=[m.group(1)],
                target_day=tday,
                raw=text,
                parser="rules",
            )

    # push/move day 4 to day 6  → move ALL scenes from day 4 → day 6
    m = re.search(
        rf"(?:{_MOVE_VERBS}|move)\s+(?:all\s+(?:scenes?\s+)?(?:from|on|in)\s+)?days?\s+{_NUM_PATTERN}"
        rf"\s+(?:to|onto|into)\s+days?\s+{_NUM_PATTERN}",
        t,
    )
    if m:
        d_from, d_to = _num(m.group(1)), _num(m.group(2))
        if d_from and d_to and d_from != d_to:
            return ParsedIntent(
                action="move_day",
                scene_ids=[],
                target_day=d_to,
                raw=text,
                parser="rules",
                confidence=0.9,
                extra={"from_day": d_from, "to_day": d_to},
            )

    # move everything on day 2 to day 4
    m = re.search(
        rf"(?:{_MOVE_VERBS})\s+(?:everything|all(?:\s+scenes?)?)\s+"
        rf"(?:on|from|in|scheduled\s+for)\s+days?\s+{_NUM_PATTERN}"
        rf"\s+(?:to|onto|into)\s+days?\s+{_NUM_PATTERN}",
        t,
    )
    if m:
        d_from, d_to = _num(m.group(1)), _num(m.group(2))
        if d_from and d_to:
            return ParsedIntent(
                action="move_day",
                scene_ids=[],
                target_day=d_to,
                raw=text,
                parser="rules",
                confidence=0.9,
                extra={"from_day": d_from, "to_day": d_to},
            )

    # ── CUT scenes ──────────────────────────────────────────────────────────
    # cut scene 7  |  cut scenes 7, 8 and 9
    m = re.search(
        rf"{_CUT_VERBS}\s+(?:scenes?\s+)?{_NUM_PATTERN}"
        rf"((?:\s*[,&]?\s*(?:and\s+)?(?:scene\s+)?\d+)*)",
        t,
    )
    if m:
        extra = extract_scene_list(m.group(2) or "")
        scene_ids = [m.group(1)] + extra
        # only keep real scene ids, skip stray numbers captured from "day X"
        return ParsedIntent(action="cut", scene_ids=scene_ids, raw=text, parser="rules")

    # ── HOLD scene ──────────────────────────────────────────────────────────
    m = re.search(rf"{_HOLD_VERBS}\s+(?:scene\s+)?{_NUM_PATTERN}", t)
    if m:
        return ParsedIntent(action="hold", scene_ids=[m.group(1)], raw=text, parser="rules")

    return ParsedIntent(action="unknown", raw=text, parser="rules", confidence=0.0)


# ---------------------------------------------------------------------------
# LLM fallback (Gemini)
# ---------------------------------------------------------------------------
_LLM_PROMPT = """You convert film-production scheduling requests into JSON.

Return ONLY a JSON object — no markdown fences, no prose, no extra keys:
{"action": "move"|"swap"|"cut"|"hold"|"unknown", "scene_ids": ["5"], "target_day": 3}

Rules:
- "action": "move" when a scene changes shoot day; "swap" when two scenes trade days;
  "cut" when a scene is dropped from the schedule; "hold" when a scene is deferred
  without a new day; "unknown" if none apply.
- scene_ids: array of string scene IDs in the order mentioned.
- target_day: 1-indexed shoot-day integer (for move), or null for swap/cut/hold.

Examples:
  "bump scene 12 to day 5"           -> {"action":"move","scene_ids":["12"],"target_day":5}
  "flip scene 3 and scene 8"         -> {"action":"swap","scene_ids":["3","8"],"target_day":null}
  "drop scene 7 entirely"            -> {"action":"cut","scene_ids":["7"],"target_day":null}
  "defer scene 14"                   -> {"action":"hold","scene_ids":["14"],"target_day":null}
  "what happens if we do scene 5 first" -> {"action":"unknown","scene_ids":[],"target_day":null}

Request: {request}
"""


async def parse_llm(text: str) -> Optional[ParsedIntent]:
    if not GEMINI_API_KEY:
        return None
    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{GEMINI_MODEL}:generateContent"
    )
    body = {
        "contents": [{"parts": [{"text": _LLM_PROMPT.replace("{request}", text)}]}],
        "generationConfig": {"temperature": 0, "responseMimeType": "application/json"},
    }
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                url, json=body, headers={"x-goog-api-key": GEMINI_API_KEY}
            )
        if resp.status_code != 200:
            log.error("Gemini %s: %s", resp.status_code, resp.text[:300])
            return None
        payload: dict[str, Any] = resp.json()
        raw = payload["candidates"][0]["content"]["parts"][0]["text"]
        data = json.loads(raw.replace("```json", "").replace("```", "").strip())
        return ParsedIntent(
            action=data.get("action", "unknown"),
            scene_ids=[str(s) for s in data.get("scene_ids", [])],
            target_day=data.get("target_day"),
            raw=text,
            parser="gemini",
            confidence=0.8,
        )
    except (httpx.HTTPError, KeyError, IndexError, ValueError) as exc:
        log.error("Gemini parse failed: %s", exc)
        return None


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------
async def parse_change(text: str) -> ParsedIntent:
    intent = parse_rules(text)
    if intent.action != "unknown":
        return intent
    return await parse_llm(text) or intent
