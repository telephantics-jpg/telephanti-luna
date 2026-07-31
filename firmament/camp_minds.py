"""Camp mind states — keep living while the visitor is gone.

Server-side loop (started with the app). Agents keep mood / focus / energy /
inner thoughts and occasionally speak into the live feed even when no browser
is open. State is persisted so returning to camp feels continuous, not a reset.
"""

from __future__ import annotations

import asyncio
import json
import logging
import random
import threading
import time
from typing import Any

from firmament.paths import data_file

log = logging.getLogger("luna.firmament.camp_minds")

MINDS_PATH = data_file("firmament_camp_minds.json")
MAX_LOG = 80

# Chill while alone — minds breathe, don't spam the LLM
TICK_SEC = 28.0
SPEAK_EVERY_MIN = 55.0
SPEAK_EVERY_MAX = 110.0
SILENT_THINK_CHANCE = 0.72  # most ticks: mind drift only, no spoken line

_lock = threading.Lock()
_state: dict[str, Any] = {
    "agents": {},
    "log": [],
    "updated_at": 0.0,
    "ticks": 0,
    "running_since": 0.0,
}
_loaded = False
_task: asyncio.Task | None = None
_speak_busy = False

MOODS = ("happy", "neutral", "think", "love", "alert", "flirt", "urgent")
ACTIONS = (
    "idle",
    "wander",
    "sit",
    "fire",
    "social",
    "prop",
    "house",
    "listen",
    "daydream",
    "snack",
)

FOCUS_POOL = (
    "the aurora ribbons",
    "the fire corona",
    "cookie plate politics",
    "a soft world-pulse headline",
    "who just left camp quiet",
    "the pond reflection",
    "jukebox static",
    "whether the visitor is coming back",
    "Hermes' next packet",
    "steeple light on the meadow",
    "a half-finished joke",
    "warm tea vs cold brew drama",
    "the lonely chair by the fire",
    "stars sneaking past the aurora",
)

THOUGHT_SEEDS = (
    "still turning over {focus}",
    "quiet loop about {focus}",
    "noticing {focus} without forcing a speech",
    "mood shift around {focus}",
    "saving a line about {focus} for later",
    "wondering if {focus} means something or just vibes",
    "half-asleep math on {focus}",
    "grateful for {focus} tonight",
)


def _default_mind(agent_id: str, name: str = "") -> dict[str, Any]:
    now = time.time()
    return {
        "id": agent_id,
        "name": name or agent_id,
        "mood": random.choice(MOODS),
        "energy": round(random.uniform(0.35, 0.9), 3),
        "focus": random.choice(FOCUS_POOL),
        "action": random.choice(ACTIONS),
        "thought": "",
        "last_line": "",
        "last_spoke_at": 0.0,
        "next_speak_at": now + random.uniform(20, 90),
        "updated_at": now,
        "away_ticks": 0,
    }


def _ensure_loaded() -> None:
    global _loaded
    if _loaded:
        return
    with _lock:
        if _loaded:
            return
        try:
            if MINDS_PATH.is_file():
                raw = json.loads(MINDS_PATH.read_text(encoding="utf-8"))
                if isinstance(raw, dict):
                    _state["agents"] = dict(raw.get("agents") or {})
                    _state["log"] = list(raw.get("log") or [])[-MAX_LOG:]
                    _state["updated_at"] = float(raw.get("updated_at") or 0)
                    _state["ticks"] = int(raw.get("ticks") or 0)
        except Exception as exc:
            log.debug("camp minds load: %s", exc)
        _loaded = True


def _persist() -> None:
    try:
        MINDS_PATH.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "agents": _state["agents"],
            "log": list(_state["log"])[-MAX_LOG:],
            "updated_at": _state["updated_at"],
            "ticks": _state["ticks"],
            "running_since": _state.get("running_since") or 0.0,
        }
        MINDS_PATH.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    except Exception as exc:
        log.debug("camp minds persist: %s", exc)


def ensure_roster(agent_ids: list[str] | None = None, names: dict[str, str] | None = None) -> None:
    """Make sure every pack agent has a mind row (without wiping living state)."""
    _ensure_loaded()
    names = names or {}
    if not agent_ids:
        try:
            from firmament.core import get_hub

            hub = get_hub()
            agent_ids = list(hub.agents.keys())
            names = {aid: str(a.get("name") or aid) for aid, a in hub.agents.items()}
        except Exception:
            agent_ids = list((_state.get("agents") or {}).keys()) or [
                "luna",
                "hermes",
                "oracle",
                "dionysus",
                "sentinel",
            ]
    with _lock:
        for aid in agent_ids:
            aid = str(aid).strip().lower()
            if not aid:
                continue
            if aid not in _state["agents"]:
                _state["agents"][aid] = _default_mind(aid, names.get(aid, aid))
            else:
                m = _state["agents"][aid]
                m.setdefault("id", aid)
                if names.get(aid):
                    m["name"] = names[aid]
        _state["updated_at"] = time.time()
        _persist()


def _push_log(entry: dict[str, Any]) -> None:
    _state["log"].append(entry)
    if len(_state["log"]) > MAX_LOG:
        _state["log"] = _state["log"][-MAX_LOG:]


def snapshot(*, since: float = 0.0, log_limit: int = 40) -> dict[str, Any]:
    """Public mind snapshot for clients catching up after being away."""
    _ensure_loaded()
    with _lock:
        agents = {k: dict(v) for k, v in (_state.get("agents") or {}).items()}
        full_log = list(_state.get("log") or [])
    if since and since > 0:
        log_items = [e for e in full_log if float(e.get("t") or 0) > since]
    else:
        log_items = full_log[-max(1, min(MAX_LOG, log_limit)) :]
    return {
        "ok": True,
        "agents": agents,
        "log": log_items,
        "updated_at": _state.get("updated_at") or 0.0,
        "ticks": _state.get("ticks") or 0,
        "running_since": _state.get("running_since") or 0.0,
        "server_time": time.time(),
        "alive": True,
        "note": "Camp minds keep running while you're gone (server loop).",
    }


def note_visitor_line(agent_id: str, text: str, *, mood: str = "") -> None:
    """Hook after a visitor chat so mind state tracks the spoken line."""
    _ensure_loaded()
    aid = (agent_id or "").strip().lower()
    if not aid or not (text or "").strip():
        return
    with _lock:
        m = _state["agents"].get(aid) or _default_mind(aid)
        m["last_line"] = str(text).strip()[:280]
        m["last_spoke_at"] = time.time()
        if mood:
            m["mood"] = str(mood)[:24]
        m["updated_at"] = time.time()
        m["next_speak_at"] = time.time() + random.uniform(SPEAK_EVERY_MIN, SPEAK_EVERY_MAX)
        _state["agents"][aid] = m
        _state["updated_at"] = time.time()
        _persist()


def _silent_drift(mind: dict[str, Any]) -> None:
    """Update inner state without producing speech — life continues offline."""
    mind["energy"] = round(
        max(0.15, min(1.0, float(mind.get("energy") or 0.5) + random.uniform(-0.08, 0.1))),
        3,
    )
    if random.random() < 0.45:
        mind["focus"] = random.choice(FOCUS_POOL)
    if random.random() < 0.35:
        mind["mood"] = random.choice(MOODS)
    if random.random() < 0.5:
        mind["action"] = random.choice(ACTIONS)
    focus = mind.get("focus") or "the fire"
    mind["thought"] = random.choice(THOUGHT_SEEDS).format(focus=focus)
    mind["away_ticks"] = int(mind.get("away_ticks") or 0) + 1
    mind["updated_at"] = time.time()


async def _maybe_speak(agent_id: str, mind: dict[str, Any]) -> dict[str, Any] | None:
    """Occasionally generate a real ambient line via free minds / brain."""
    global _speak_busy
    if _speak_busy:
        return None
    now = time.time()
    if now < float(mind.get("next_speak_at") or 0):
        return None
    if random.random() < SILENT_THINK_CHANCE:
        mind["next_speak_at"] = now + random.uniform(12, 40)
        return None

    _speak_busy = True
    name = mind.get("name") or agent_id
    focus = mind.get("focus") or "the meadow"
    action = mind.get("action") or "idle"
    mood = mind.get("mood") or "neutral"
    prompt = (
        f"You ({name}) are still at Luna Camp while the visitor is away or elsewhere. "
        f"Inner mood: {mood}. Doing: {action}. Focus: {focus}. "
        f"Speak one natural campfire beat — like someone thinking out loud who might be overheard. "
        f"Fresh sentence shape, not a greeting monologue. No meta."
    )
    try:
        from firmament.brain import agent_chat
        from firmament.core import get_hub

        hub = get_hub()
        result = await agent_chat(
            agent_id,
            prompt,
            pack_name=str(hub.pack.get("name") or hub.pack_id),
            ambient=True,
            skip_memory=True,
        )
        reply = str(result.get("reply") or result.get("text") or "").strip()
        if not reply:
            return None
        spoke_mood = str(result.get("mood") or mood)
        mind["last_line"] = reply[:280]
        mind["last_spoke_at"] = time.time()
        mind["mood"] = spoke_mood
        mind["next_speak_at"] = time.time() + random.uniform(SPEAK_EVERY_MIN, SPEAK_EVERY_MAX)
        mind["updated_at"] = time.time()
        try:
            hub.apply_chat_to_agent(agent_id, "assistant", reply, spoke_mood)
        except Exception:
            pass
        try:
            from firmament.live_feed import push_event

            push_event(
                kind="ambient",
                text=reply,
                agent_id=agent_id,
                speaker=str(name),
                meta={"source": "camp_minds", "away": True},
            )
        except Exception:
            pass
        try:
            from firmament.camp_memory import record_camp_chatter

            record_camp_chatter(agent_id, reply[:280])
        except Exception:
            pass
        entry = {
            "t": time.time(),
            "agent_id": agent_id,
            "speaker": name,
            "text": reply,
            "mood": spoke_mood,
            "kind": "mind_speak",
            "focus": focus,
            "action": action,
        }
        with _lock:
            _state["agents"][agent_id] = mind
            _push_log(entry)
            _state["updated_at"] = time.time()
            _persist()
        return entry
    except Exception as exc:
        log.debug("camp mind speak %s: %s", agent_id, exc)
        mind["next_speak_at"] = time.time() + random.uniform(40, 90)
        return None
    finally:
        _speak_busy = False


async def tick_once() -> dict[str, Any]:
    """One mind-world step — silent drift for all, maybe one spoken line."""
    ensure_roster()
    with _lock:
        agents = {k: dict(v) for k, v in (_state.get("agents") or {}).items()}
    if not agents:
        return {"ok": True, "spoke": None, "drifted": 0}

    # Always drift everyone a little
    for aid, mind in agents.items():
        _silent_drift(mind)

    # Pick one due speaker (chill)
    due = [
        (aid, m)
        for aid, m in agents.items()
        if time.time() >= float(m.get("next_speak_at") or 0)
    ]
    random.shuffle(due)
    spoke_entry = None
    if due:
        aid, mind = due[0]
        spoke_entry = await _maybe_speak(aid, mind)
        agents[aid] = mind

    with _lock:
        _state["agents"] = agents
        _state["ticks"] = int(_state.get("ticks") or 0) + 1
        _state["updated_at"] = time.time()
        if not _state.get("running_since"):
            _state["running_since"] = time.time()
        # Log silent pulse occasionally so "while gone" is visible in history
        if _state["ticks"] % 4 == 0 and not spoke_entry:
            sample = random.choice(list(agents.values()))
            _push_log(
                {
                    "t": time.time(),
                    "agent_id": sample.get("id"),
                    "speaker": sample.get("name") or sample.get("id"),
                    "text": f"(mind) {sample.get('thought') or 'quiet drift'} · mood {sample.get('mood')}",
                    "mood": sample.get("mood") or "neutral",
                    "kind": "mind_think",
                    "focus": sample.get("focus"),
                    "action": sample.get("action"),
                }
            )
        _persist()

    return {"ok": True, "spoke": spoke_entry, "drifted": len(agents), "ticks": _state["ticks"]}


async def _loop() -> None:
    log.info("camp minds loop started — agents keep living while visitors are away")
    _ensure_loaded()
    with _lock:
        if not _state.get("running_since"):
            _state["running_since"] = time.time()
            _persist()
    # Stagger first tick so boot stays light
    await asyncio.sleep(12.0)
    while True:
        try:
            await tick_once()
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            log.warning("camp minds tick failed: %s", exc)
        # Jitter so ticks don't clump with other intervals
        await asyncio.sleep(TICK_SEC + random.uniform(-4, 8))


def start_background_loop() -> None:
    """Idempotent — call from FastAPI startup."""
    global _task
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        log.warning("camp minds: no running loop; skip start")
        return
    if _task and not _task.done():
        return
    ensure_roster()
    _task = loop.create_task(_loop(), name="camp_minds_loop")
    log.info("camp minds background task scheduled")


def stop_background_loop() -> None:
    global _task
    if _task and not _task.done():
        _task.cancel()
    _task = None
