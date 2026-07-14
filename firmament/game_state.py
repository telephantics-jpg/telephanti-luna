"""Live game state for firmament playground (optional game events)."""

from __future__ import annotations

import json
import time
from pathlib import Path

from firmament.paths import data_file

STATE_PATH = data_file("firmament_game_state.json")

DEFAULT = {
    "mode": "playground",
    "zombie_mode": False,
    "wave": 0,
    "zombies_killed": 0,
    "zombies_alive": 0,
    "player_health": 100,
    "ammo": 0,
    "phase": "explore",
    "location": "luna_camp",
    "psychic_phase": "aurora_calm",
    "weather": "aurora",
    "time_of_day": "dawn",
    "last_event": "",
    "updated_at": 0.0,
}

ZOMBIE_EVENTS = frozenset({"wave_start", "zombie_kill", "zombie_spawn", "zombie_wave"})


def load() -> dict:
    try:
        from firmament.crypto_box import load_json_file

        raw = load_json_file(STATE_PATH, {})
        if isinstance(raw, dict):
            out = {**DEFAULT, **raw}
            return out
    except Exception:
        pass
    return dict(DEFAULT)


def save(state: dict) -> dict:
    state = {**DEFAULT, **state, "updated_at": time.time()}
    try:
        from firmament.crypto_box import save_json_file

        save_json_file(STATE_PATH, state)
    except OSError:
        pass
    return state


def apply_event(event: str, payload: dict | None = None) -> dict:
    payload = payload or {}
    state = load()
    state["last_event"] = event
    state["zombie_mode"] = False
    state["zombies_alive"] = 0

    if event in ZOMBIE_EVENTS:
        state["last_event"] = "zombie_blocked"
        state["phase"] = "explore"
        state["psychic_phase"] = "aurora_calm"
        return save(state)

    if event == "psychic_pulse":
        state["psychic_phase"] = str(payload.get("phase", "ripple"))
        state["phase"] = "psychic"
    elif event == "wave_start":
        state["wave"] = int(payload.get("wave", state["wave"] + 1))
        state["phase"] = "wave"
        state["zombies_alive"] = int(payload.get("zombies_alive", 8))
    elif event == "zombie_kill":
        state["zombies_killed"] = int(state.get("zombies_killed", 0)) + int(payload.get("count", 1))
        state["zombies_alive"] = max(0, int(state.get("zombies_alive", 0)) - int(payload.get("count", 1)))
    elif event == "player_hit":
        state["player_health"] = max(0, int(state.get("player_health", 100)) - int(payload.get("damage", 10)))
        if state["player_health"] <= 0:
            state["phase"] = "down"
    elif event == "safe_zone":
        state["phase"] = "safe"
        state["location"] = str(payload.get("location", "outpost"))
    elif event == "ammo_pickup":
        state["ammo"] = int(state.get("ammo", 0)) + int(payload.get("amount", 15))
    elif event == "weather_set":
        state["weather"] = str(payload.get("weather", "aurora")).lower()[:24]
        if payload.get("time_of_day"):
            state["time_of_day"] = str(payload.get("time_of_day"))[:16]
    elif event == "reset":
        state = dict(DEFAULT)

    return save(state)


def context_blurb(state: dict | None = None) -> str:
    s = state or load()
    try:
        from firmament.psychic_engine import status_blurb as psychic_blurb

        psychic = psychic_blurb()
    except Exception:
        psychic = "Psychic engine online."
    return (
        f"Playground mode at Luna camp — zombie mode OFF. "
        f"Phase: {s.get('phase', 'explore')}. Psychic: {s.get('psychic_phase', 'aurora_calm')}. "
        f"Location: {s.get('location', 'luna_camp')}. {psychic}"
    )