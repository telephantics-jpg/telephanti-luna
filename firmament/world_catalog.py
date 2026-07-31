"""Shared camp world catalog — layout + visual keys for 2D / Three.js / Unreal."""

from __future__ import annotations

import json
import logging
import random
from copy import deepcopy
from datetime import date
from pathlib import Path
from typing import Any

from firmament.paths import ROOT

log = logging.getLogger("luna.firmament.world")

WORLD_DIR = ROOT / "firmament" / "world"
CATALOG_PATH = WORLD_DIR / "camp_catalog.json"
ROSTER_PATH = WORLD_DIR / "npc_roster.json"
AGENTS_DIR = ROOT / "firmament" / "agents"

_cache: dict[str, Any] | None = None
_cache_mtime: float | None = None
_cache_day: str | None = None


def _read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def catalog_path() -> Path:
    return CATALOG_PATH


def _daily_seed() -> str:
    return date.today().isoformat()


def load_roster() -> dict[str, Any]:
    if not ROSTER_PATH.is_file():
        return {"agents": [], "daily": {}}
    try:
        data = _read_json(ROSTER_PATH)
        return data if isinstance(data, dict) else {"agents": [], "daily": {}}
    except (OSError, json.JSONDecodeError) as exc:
        log.warning("npc roster load failed: %s", exc)
        return {"agents": [], "daily": {}}


def pick_daily_visitors(*, day: str | None = None) -> list[dict[str, Any]]:
    """Deterministic daily subset of gods / demons / angels / clever wits."""
    roster = load_roster()
    agents = [a for a in (roster.get("agents") or []) if isinstance(a, dict) and a.get("id")]
    daily = roster.get("daily") if isinstance(roster.get("daily"), dict) else {}
    counts = {
        "god": int(daily.get("god", 4) or 4),
        "demon": int(daily.get("demon", 3) or 3),
        "angel": int(daily.get("angel", 4) or 4),
        "clever": int(daily.get("clever", 5) or 5),
    }
    rng = random.Random(day or _daily_seed())
    picks: list[dict[str, Any]] = []
    for faction, n in counts.items():
        pool = [a for a in agents if str(a.get("faction") or "") == faction]
        if not pool:
            continue
        k = min(n, len(pool))
        picks.extend(rng.sample(pool, k))
    return picks


def _faction_spawn(faction: str, index: int) -> tuple[float, float]:
    """Scatter visitors by district (wide town map — not piled on the fire)."""
    hubs = {
        "god": (-980.0, 320.0),      # Temple Walk
        "demon": (-420.0, -980.0),   # Undercroft
        "angel": (420.0, 920.0),     # Angel Terrace
        "clever": (780.0, -620.0),   # Wit Alley
    }
    hx, hy = hubs.get(faction, (0.0, 480.0))
    ring = 70 + (index % 5) * 55
    ang = (index * 2.2) % 6.28
    import math

    return hx + math.cos(ang) * ring, hy + math.sin(ang) * ring


def _apply_daily_rotation(catalog: dict[str, Any]) -> None:
    """Append today's visitors to catalog.agents (skip ids already in base cast)."""
    day = _daily_seed()
    base = [a for a in (catalog.get("agents") or []) if isinstance(a, dict)]
    have = {str(a.get("id") or "") for a in base}
    visitors = pick_daily_visitors(day=day)
    added: list[dict[str, Any]] = []
    for i, raw in enumerate(visitors):
        aid = str(raw.get("id") or "").strip()
        if not aid or aid in have:
            continue
        faction = str(raw.get("faction") or "clever")
        x, y = _faction_spawn(faction, i)
        vis = dict(raw.get("visual") or {})
        vis.setdefault("kit", vis.get("archetype") or "messenger")
        openers = raw.get("openers") if isinstance(raw.get("openers"), list) else []
        roots = raw.get("roots") if isinstance(raw.get("roots"), list) else []
        # Daily witty line for bubbles + compact Ollama seed
        import random as _rnd

        rng_line = _rnd.Random(f"{day}:{aid}")
        pool = [str(s).strip() for s in (openers or roots) if str(s).strip()]
        opener = rng_line.choice(pool) if pool else f"{raw.get('name') or aid} clocks into Luna Town."
        blurb = str(raw.get("blurb") or raw.get("persona") or "").strip()
        if len(blurb) > 160:
            blurb = blurb[:157].rstrip() + "…"
        entry = {
            "id": aid,
            "name": raw.get("name") or aid,
            "x": round(x, 1),
            "y": round(y, 1),
            "mood": raw.get("mood") or "happy",
            "base": True,
            "summon": "",
            "faction": faction,
            "daily": True,
            "rotation_day": day,
            "opener": opener,
            "blurb": blurb,
            "persona_hint": blurb,
            "visual": vis,
        }
        added.append(entry)
        have.add(aid)
    catalog["agents"] = base + added
    catalog["daily_rotation"] = {
        "day": day,
        "added": [a["id"] for a in added],
        "counts": {
            "god": sum(1 for a in added if a.get("faction") == "god"),
            "demon": sum(1 for a in added if a.get("faction") == "demon"),
            "angel": sum(1 for a in added if a.get("faction") == "angel"),
            "clever": sum(1 for a in added if a.get("faction") == "clever"),
        },
    }
    log.info(
        "daily rotation %s → +%s visitors (%s)",
        day,
        len(added),
        catalog["daily_rotation"]["counts"],
    )


def load_catalog(*, force: bool = False) -> dict[str, Any]:
    """Load camp_catalog.json (mtime + day cached). Merges personas + daily NPCs."""
    global _cache, _cache_mtime, _cache_day

    if not CATALOG_PATH.is_file():
        log.warning("camp catalog missing: %s", CATALOG_PATH)
        return _empty_catalog()

    try:
        mtime = CATALOG_PATH.stat().st_mtime
    except OSError:
        mtime = None

    day = _daily_seed()
    if (
        not force
        and _cache is not None
        and mtime is not None
        and mtime == _cache_mtime
        and _cache_day == day
    ):
        return deepcopy(_cache)

    try:
        data = _read_json(CATALOG_PATH)
    except (OSError, json.JSONDecodeError) as exc:
        log.error("camp catalog load failed: %s", exc)
        return _empty_catalog()

    if not isinstance(data, dict):
        return _empty_catalog()

    data.setdefault("version", 1)
    data.setdefault("scale", {"three": 0.018})
    for key in ("props", "houses", "agents", "landmarks", "furniture", "music"):
        if not isinstance(data.get(key), list):
            data[key] = []

    _apply_daily_rotation(data)
    _merge_agent_profiles(data)

    _cache = data
    _cache_mtime = mtime
    _cache_day = day
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
        "daily_rotation": cat.get("daily_rotation"),
    }
