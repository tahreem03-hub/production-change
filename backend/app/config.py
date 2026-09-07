"""Configuration and production-data loading."""

from __future__ import annotations

import json
import os
from functools import lru_cache
from pathlib import Path
from typing import Any

try:  # local dev convenience; no-op in the container where env vars are injected
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:  # pragma: no cover
    pass

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_PATH = Path(os.getenv("PRODUCTION_DATA", BASE_DIR / "data" / "production.json"))

# --- Parallel Search -------------------------------------------------------
PARALLEL_API_KEY = os.getenv("PARALLEL_API_KEY", "")
PARALLEL_BASE_URL = os.getenv("PARALLEL_BASE_URL", "https://api.parallel.ai")
PARALLEL_SEARCH_MODE = os.getenv("PARALLEL_SEARCH_MODE", "fast")  # turbo|fast|basic|advanced
PARALLEL_MAX_RESULTS = int(os.getenv("PARALLEL_MAX_RESULTS", "4"))
PARALLEL_MAX_CHARS_PER_RESULT = int(os.getenv("PARALLEL_MAX_CHARS_PER_RESULT", "800"))
PARALLEL_TIMEOUT = float(os.getenv("PARALLEL_TIMEOUT", "20"))

# --- Optional LLM parsing (falls back to regex when unset) -----------------
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

# --- Server ----------------------------------------------------------------
ALLOWED_ORIGINS = [
    o.strip() for o in os.getenv("ALLOWED_ORIGINS", "*").split(",") if o.strip()
]


@lru_cache(maxsize=1)
def load_production() -> dict[str, Any]:
    """Load and index the production data once per process."""
    with open(DATA_PATH, "r", encoding="utf-8") as fh:
        data = json.load(fh)

    data["_scenes_by_id"] = {s["id"]: s for s in data["scenes"]}
    data["_cast_by_id"] = {c["id"]: c for c in data["cast"]}
    data["_locations_by_id"] = {loc["id"]: loc for loc in data["locations"]}
    return data


def reload_production() -> dict[str, Any]:
    load_production.cache_clear()
    return load_production()