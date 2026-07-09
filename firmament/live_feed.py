"""Live camp brain feed — free dynamic context for every agent turn.

Keeps a rolling stream of:
- what agents just said (anti-repetition + cross-talk awareness)
- visitor lines
- free public news (HN + RSS via x_pulse)
- camp weather / free moment sparks

No paid APIs required.
"""

from __future__ import annotations

import hashlib
import logging
import random
import re
import threading
import time
from collections import deque
from typing import Any

from firmament.paths import data_file

log = logging.getLogger("luna.firmament.live_feed")

FEED_PATH = data_file("firmament_live_feed.json")
MAX_EVENTS = 100
MAX_PER_AGENT = 16
MAX_BAN = 12
# Keep enough text for long monologues (~400 words) in anti-repeat memory
MAX_EVENT_CHARS = 3200

_lock = threading.Lock()
_events: deque[dict[str, Any]] = deque(maxlen=MAX_EVENTS)
_by_agent: dict[str, deque[str]] = {}
_loaded = False

# Free rotational "moment" seeds so even offline still shifts
MOMENT_POOL = [
    "a cloud looks like a question mark",
    "the cookie plate is down to three — tension rising",
    "someone's phone buzzed and everyone pretended not to care",
    "the pond reflected the steeple upside down",
    "a cold breeze argued with the fire and lost",
    "Nebula claimed a chair with pure authority",
    "distant thunder soundchecked without lightning",
    "the jukebox skipped once — cosmic punctuation",
    "a visitor almost said something and swallowed it",
    "two agents made eye contact and both looked at the cookies",
    "the aurora did a soft fade like a browser tab going idle",
    "a raven overhead — Odin claims it's not his, suspicious",
]


def _norm(text: str) -> str:
    t = re.sub(r"\s+", " ", (text or "").strip().lower())
    t = re.sub(r"[^a-z0-9\s']", "", t)
    return t[:160]


def _fp(text: str) -> str:
    return hashlib.sha1(_norm(text).encode("utf-8")).hexdigest()[:12]


def _ensure_loaded() -> None:
    global _loaded
    if _loaded:
        return
    with _lock:
        if _loaded:
            return
        try:
            from firmament.crypto_box import load_json_file

            raw = load_json_file(FEED_PATH, {"events": []})
            for ev in (raw.get("events") or [])[-MAX_EVENTS:]:
                if isinstance(ev, dict) and ev.get("text"):
                    _events.append(ev)
                    aid = str(ev.get("agent_id") or "").lower()
                    if aid and ev.get("kind") in ("agent_said", "ambient", "converse"):
                        _by_agent.setdefault(aid, deque(maxlen=MAX_PER_AGENT)).append(
                            str(ev.get("text") or "")
                        )
        except Exception as exc:
            log.debug("live feed load: %s", exc)
        _loaded = True


def _persist() -> None:
    try:
        from firmament.crypto_box import save_json_file

        # live feed is not in sensitive list — save as plain via write
        FEED_PATH.parent.mkdir(parents=True, exist_ok=True)
        import json

        FEED_PATH.write_text(
            json.dumps({"events": list(_events)[-MAX_EVENTS:], "updated_at": time.time()}, indent=2),
            encoding="utf-8",
        )
    except Exception as exc:
        log.debug("live feed persist: %s", exc)


def push_event(
    *,
    kind: str,
    text: str,
    agent_id: str = "",
    speaker: str = "",
    visitor_id: str = "",
    meta: dict | None = None,
) -> dict[str, Any]:
    """Push a live camp event into the shared brain feed (free, local)."""
    _ensure_loaded()
    clean = re.sub(r"\s+", " ", (text or "").strip())[:MAX_EVENT_CHARS]
    if not clean:
        return {}
    aid = (agent_id or "").strip().lower()
    ev = {
        "t": time.time(),
        "kind": (kind or "note").strip()[:32],
        "text": clean,
        "agent_id": aid,
        "speaker": (speaker or aid or "Camp")[:48],
        "visitor_id": (visitor_id or "")[:64],
        "fp": _fp(clean),
        "meta": meta or {},
    }
    with _lock:
        # skip exact dup of last event
        if _events and _events[-1].get("fp") == ev["fp"] and _events[-1].get("agent_id") == aid:
            return ev
        _events.append(ev)
        if aid and kind in ("agent_said", "ambient", "converse", "chat_reply"):
            _by_agent.setdefault(aid, deque(maxlen=MAX_PER_AGENT)).append(clean)
        _persist()
    return ev


def recent_events(limit: int = 16, *, exclude_agent: str = "") -> list[dict[str, Any]]:
    _ensure_loaded()
    ex = (exclude_agent or "").strip().lower()
    with _lock:
        items = list(_events)
    if ex:
        items = [e for e in items if str(e.get("agent_id") or "") != ex]
    return items[-max(1, min(40, limit)) :]


def recent_phrases_for_agent(agent_id: str, limit: int = MAX_BAN) -> list[str]:
    _ensure_loaded()
    aid = (agent_id or "").strip().lower()
    with _lock:
        q = list(_by_agent.get(aid) or [])
    return q[-max(1, min(MAX_BAN, limit)) :]


def _phrase_overlap(text_norm: str, other_norm: str) -> bool:
    """True if two normalized strings share too much wording."""
    if not text_norm or not other_norm:
        return False
    if text_norm[:90] == other_norm[:90]:
        return True
    tw = set(text_norm.split())
    ow = set(other_norm.split())
    if not tw or not ow:
        return False
    inter = len(tw & ow)
    union = len(tw | ow) or 1
    # Long monologues share common English — use stricter overlap + long stem checks
    if inter / union > 0.42 and inter >= 18:
        return True
    if len(other_norm) > 36 and other_norm[:52] in text_norm:
        return True
    # Distinctive 6-word runs from the other line
    o_list = other_norm.split()
    if len(o_list) >= 6:
        for i in range(0, min(len(o_list) - 5, 40)):
            run = " ".join(o_list[i : i + 6])
            if len(run) >= 28 and run in text_norm:
                return True
    return False


def is_too_similar(agent_id: str, text: str) -> bool:
    """True if text copies this agent OR another camp agent's recent phrasing."""
    if not text:
        return False
    n = _norm(text)
    if len(n) < 24:
        return False
    # Own recent lines
    for p in recent_phrases_for_agent(agent_id, MAX_BAN):
        if _phrase_overlap(n, _norm(p)):
            return True
    # Other agents — do not steal their monologue beats / catchphrases
    aid = (agent_id or "").strip().lower()
    for e in recent_events(limit=28, exclude_agent=aid):
        if e.get("kind") not in ("agent_said", "ambient", "converse", "chat_reply"):
            continue
        other = str(e.get("text") or "")
        if _phrase_overlap(n, _norm(other)):
            return True
    return False


def other_agents_banned_phrases(agent_id: str, *, limit: int = 14) -> list[str]:
    """Snippets other agents said recently — hard ban for copycats."""
    aid = (agent_id or "").strip().lower()
    out: list[str] = []
    for e in recent_events(limit=36, exclude_agent=aid):
        if e.get("kind") not in ("agent_said", "ambient", "converse", "chat_reply"):
            continue
        who = e.get("speaker") or e.get("agent_id") or "Agent"
        txt = str(e.get("text") or "").strip()
        if len(txt) < 20:
            continue
        # Prefer mid-sentence hooks (first ~90 chars) as ban seeds
        snip = re.sub(r"\s+", " ", txt)[:100]
        out.append(f'{who}: "{snip}"')
        if len(out) >= limit:
            break
    return out


def free_world_pulse(limit: int = 4) -> list[str]:
    """Free public headlines for brains (HN/RSS) — no API key."""
    try:
        from firmament.x_pulse import get_pulse_feed

        items = (get_pulse_feed() or {}).get("items") or []
        out = []
        for it in items[: max(1, min(8, limit))]:
            t = str((it or {}).get("text") or "").strip()
            if t:
                out.append(t[:140])
        return out
    except Exception:
        return []


def camp_moment() -> str:
    # time-bucket so moment drifts without RNG-only loops feeling stuck
    bucket = int(time.time() // 90)
    rng = random.Random(bucket)
    return rng.choice(MOMENT_POOL)


def feed_blurb_for_agent(agent_id: str, *, limit: int = 10) -> str:
    """Compact live context injected into every system prompt."""
    _ensure_loaded()
    aid = (agent_id or "").strip().lower()
    parts: list[str] = []

    others = recent_events(limit=limit, exclude_agent=aid)
    if others:
        lines = []
        for e in others[-8:]:
            who = e.get("speaker") or e.get("agent_id") or "Camp"
            txt = str(e.get("text") or "")[:140]
            if txt:
                lines.append(f"{who}: {txt}")
        if lines:
            parts.append(
                "LIVE CAMP FEED (context only — react to the IDEA, never copy their wording):\n- "
                + "\n- ".join(lines)
            )

    banned = recent_phrases_for_agent(aid, MAX_BAN)
    if banned:
        ban_snip = " | ".join(f'"{b[:90]}"' for b in banned[-6:])
        parts.append(
            "ANTI-REPEAT SELF (critical): Do NOT reuse these recent beats or openings YOU already said: "
            + ban_snip
            + ". Brand-new hooks only."
        )

    other_bans = other_agents_banned_phrases(aid, limit=12)
    if other_bans:
        parts.append(
            "ANTI-COPY OTHER AGENTS (critical — zero tolerance): Never say, paraphrase closely, "
            "or reuse catchphrases/metaphors from other agents' recent lines. Banned seeds:\n- "
            + "\n- ".join(other_bans)
            + "\nRespond in YOUR unique voice only. If you react to them, invent new language."
        )

    pulse = free_world_pulse(4)
    if pulse:
        parts.append("FREE WORLD PULSE (riff if relevant): " + " · ".join(f'"{p}"' for p in pulse[:4]))

    parts.append(f"LIVE MOMENT: {camp_moment()}.")

    try:
        from firmament.game_state import load as game_load

        g = game_load()
        weather = g.get("weather") or "aurora"
        tod = g.get("time_of_day") or "night"
        parts.append(f"Camp sky: {weather} / {tod}.")
    except Exception:
        pass

    return " ".join(parts)


def status() -> dict[str, Any]:
    _ensure_loaded()
    with _lock:
        n = len(_events)
        agents = {k: len(v) for k, v in _by_agent.items()}
    pulse = free_world_pulse(3)
    return {
        "ok": True,
        "events": n,
        "agents_tracked": agents,
        "free_pulse": pulse,
        "moment": camp_moment(),
        "free": True,
    }
