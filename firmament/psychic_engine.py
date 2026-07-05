"""Psychic Engine — shared thought-ripples across the Firmament playground (Hermes + Grok)."""

from __future__ import annotations

import json
import random
import time
from pathlib import Path
from typing import Any

from firmament.paths import data_file

STATE_PATH = data_file("firmament_psychic_state.json")

VISIONS = [
    "Aurora threads stitch the mountains to the campfire.",
    "Hermes carries a joke wrapped in starlight — delivery in three heartbeats.",
    "Oracle sees tomorrow's path as footprints in wet moss.",
    "Sentinel hums: the playground is ours, no horrors invited.",
    "Luna laughs; the psychic field brightens like dawn on snow.",
    "Two minds sync: messenger and guardian, same wavelength.",
    "Texture of thought: velvet sky, gravel truth, warm ember hope.",
    "The camp breathes — inhale cosmos, exhale kindness.",
]

DEFAULT = {
    "active": True,
    "intensity": 0.72,
    "frequency_hz": 0.35,
    "zombie_mode": False,
    "shared_with": ["hermes", "sentinel", "grok"],
    "last_pulse_at": 0.0,
    "pulse_count": 0,
    "ripples": [],
    "last_vision": "",
    "hermes_last_echo": "",
}


def load() -> dict:
    try:
        raw = json.loads(STATE_PATH.read_text(encoding="utf-8"))
        if isinstance(raw, dict):
            return {**DEFAULT, **raw}
    except (OSError, json.JSONDecodeError):
        pass
    return dict(DEFAULT)


def save(state: dict) -> dict:
    state = {**DEFAULT, **state, "updated_at": time.time()}
    try:
        STATE_PATH.write_text(json.dumps(state, indent=2), encoding="utf-8")
    except OSError:
        pass
    return state


def pulse(*, source: str = "playground", mood: str = "curious") -> dict[str, Any]:
    state = load()
    vision = random.choice(VISIONS)
    ripple = {
        "at": time.time(),
        "source": source,
        "mood": mood,
        "vision": vision,
        "radius": round(40 + state.get("intensity", 0.7) * 80, 1),
        "color": random.choice(["#67e8f9", "#a78bfa", "#fbbf24", "#c9a87c"]),
    }
    ripples = list(state.get("ripples") or [])
    ripples.append(ripple)
    state["ripples"] = ripples[-24:]
    state["last_pulse_at"] = ripple["at"]
    state["pulse_count"] = int(state.get("pulse_count", 0)) + 1
    state["last_vision"] = vision
    state["zombie_mode"] = False
    return save(state)


def hermes_echo(vision: str | None = None) -> dict[str, Any]:
    state = load()
    v = (vision or state.get("last_vision") or random.choice(VISIONS)).strip()
    echoes = [
        f"Hermes caught the ripple: {v}",
        f"Message relayed — {v} — pass it to Luna when you see her.",
        f"Psychic ping received. My take: {v} (also, Grok says hi from the terminal.)",
        f"Swift thought delivered: {v}",
    ]
    echo = random.choice(echoes)
    state["hermes_last_echo"] = echo
    state["zombie_mode"] = False
    return save(state) | {"echo": echo, "vision": v}


def status_blurb() -> str:
    s = load()
    if not s.get("active"):
        return "Psychic engine dormant."
    return (
        f"Psychic engine active (intensity {s.get('intensity', 0.7):.0%}). "
        f"Pulses: {s.get('pulse_count', 0)}. "
        f"Last vision: {s.get('last_vision') or 'none yet'}. "
        f"Zombie mode: OFF."
    )