"""Shared camp world catalog — layout + visual keys for 2D / Three.js / Unreal."""

from __future__ import annotations

import json
import logging
from copy import deepcopy
from pathlib import Path
from typing import Any

from firmament.paths import ROOT

log = logging.getLogger("luna.firmament.world")

WORLD_DIR = ROOT / "firmament" / "world"
CATALOG_PATH = WORLD_DIR / "camp_catalog.json"
AGENTS_DIR = ROOT / "firmament" / "agents"

_cache: dict[str, Any] | None = None
_cache_mtime: float | None = None


def _read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def catalog_path() -> Path:
    return CATALOG_PATH


def load_catalog(*, force: bool = False) -> dict[str, Any]:
    """Load camp_catalog.json (mtime-cached). Merges agent persona names when present."""
    global _cache, _cache_mtime

    if not CATALOG_PATH.is_file():
        log.warning("camp catalog missing: %s", CATALOG_PATH)
        return _empty_catalog()

    try:
        mtime = CATALOG_PATH.stat().st_mtime
    except OSError:
        mtime = None

    if not force and _cache is not None and mtime is not None and mtime == _cache_mtime:
        return deepcopy(_cache)

    try:
        data = _read_json(CATALOG_PATH)
    except (OSError, json.JSONDecodeError) as exc:
        log.error("camp catalog load failed: %s", exc)
        return _empty_catalog()

    if not isinstance(data, dict):
        return _empty_catalog()

    _merge_agent_profiles(data)
    data.setdefault("version", 1)
    data.setdefault("scale", {"three": 0.018})
    for key in ("props", "houses", "agents", "landmarks", "furniture", "music"):
        if not isinstance(data.get(key), list):
            data[key] = []

    _cache = data
    _cache_mtime = mtime
    return deepcopy(data)


def _merge_agent_profiles(catalog: dict[str, Any]) -> None:
    """Fill display name / bubble color from firmament/agents/<id>.json when missing."""
    for entry in catalog.get("agents") or []:
        if not isinstance(entry, dict):
            continue
        agent_id = str(entry.get("id") or "").strip()
        if not agent_id:
            continue
        path = AGENTS_DIR / f"{agent_id}.json"
        if not path.is_file():
            continue
        try:
            profile = _read_json(path)
        except (OSError, json.JSONDecodeError):
            continue
        if not entry.get("name") and profile.get("name"):
            entry["name"] = profile["name"]
        visual = entry.setdefault("visual", {})
        if isinstance(visual, dict):
            bubble = profile.get("bubble") if isinstance(profile.get("bubble"), dict) else {}
            if not visual.get("primary") and bubble.get("color"):
                visual["primary"] = bubble["color"]
            if not visual.get("archetype") and profile.get("role"):
                visual["role"] = profile.get("role")


def _empty_catalog() -> dict[str, Any]:
    return {
        "id": "empty",
        "version": 0,
        "name": "Empty Camp",
        "scale": {"three": 0.018},
        "props": [],
        "houses": [],
        "agents": [],
        "landmarks": [],
        "error": "catalog_missing",
    }


def catalog_public() -> dict[str, Any]:
    """API payload for clients."""
    cat = load_catalog()
    return {
        "ok": True,
        "catalog": cat,
        "path": "firmament/world/camp_catalog.json",
    }
