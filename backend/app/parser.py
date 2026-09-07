"""Turn a natural-language change request into a structured intent.

Rules first (fast, free, deterministic — matters when you are demoing on
conference wifi). If the regexes miss and GEMINI_API_KEY is set, fall back to
an LLM call that must return strict JSON.
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

_WORD_NUMBERS = {
    "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6,
    "seven": 7, "eight": 8, "nine": 9, "ten": 10, "eleven": 11, "twelve": 12,
}

_MOVE_VERBS = r"(?:move|shift|push|pull|reschedule|bump|slide|put)"
_CUT_VERBS = r"(?:cut|drop|omit|remove|delete|scrap)"
_SWAP_VERBS = r"(?:swap|switch|flip|exchange|trade)"


def _num(token: str) -> Optional[int]:
    token = token.strip().lower()
    if token.isdigit():
        return int(token)
    return _WORD_NUMBERS.get(token)


def parse_rules(text: str) -> ParsedIntent:
    t = " ".join(text.lower().split())
    num = r"(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)"

    # swap scene 4 and scene 9  |  swap scenes 4 and 9
    m = re.search(rf"{_SWAP_VERBS}\s+(?:scenes?\s+)?{num}\s*(?:and|with|&|for)\s*(?:scene\s+)?{num}", t)
    if m:
        return ParsedIntent(
            action="swap", scene_ids=[m.group(1), m.group(2)], raw=text, parser="rules"
        )

    # move scene 5 (and 6) to day 3
    m = re.search(
        rf"{_MOVE_VERBS}\s+(?:scenes?\s+)?{num}((?:\s*(?:,|and|&)\s*(?:scene\s+)?\d+)*)"
        rf".*?\bday\s+{num}",
        t,
    )
    if m:
        extra = re.findall(r"\d+", m.group(2) or "")
        return ParsedIntent(
            action="move",
            scene_ids=[m.group(1)] + extra,
            target_day=_num(m.group(3)),
            raw=text,
            parser="rules",
        )

    # scene 5 -> day 3  |  scene 5 to day 3
    m = re.search(rf"scene\s+{num}\s*(?:->|→|to|onto|into|on)\s*day\s+{num}", t)
    if m:
        return ParsedIntent(
            action="move",
            scene_ids=[m.group(1)],
            target_day=_num(m.group(2)),
            raw=text,
            parser="rules",
        )

    # cut scene 7
    m = re.search(rf"{_CUT_VERBS}\s+(?:scene\s+)?{num}", t)
    if m:
        return ParsedIntent(action="cut", scene_ids=[m.group(1)], raw=text, parser="rules")

    return ParsedIntent(action="unknown", raw=text, parser="rules", confidence=0.0)


_LLM_PROMPT = """You convert film-production scheduling requests into JSON.

Return ONLY a JSON object, no markdown fences, no prose:
{"action": "move"|"swap"|"cut"|"unknown", "scene_ids": ["5"], "target_day": 3 or null}

Rules:
- "action" is "move" when a scene changes shoot day, "swap" when two scenes trade
  days, "cut" when a scene is dropped, "unknown" if you cannot tell.
- scene_ids are strings, in the order mentioned.
- target_day is the 1-indexed shoot day number, or null for swap/cut.

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


async def parse_change(text: str) -> ParsedIntent:
    intent = parse_rules(text)
    if intent.action != "unknown":
        return intent
    return await parse_llm(text) or intent