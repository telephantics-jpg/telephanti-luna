"""Telephantix DJ Radio — free local drops between songs.

Character: **DJ Vox** — late-night Luna Camp board op, free edge-tts voice.
Script: Ollama (hermes3/llama3.2) when free minds is on · witty templates offline.
Voice: edge-tts GuyNeural (free) — keyed as ``dj`` / ``vox``.
"""

from __future__ import annotations

import logging
import os
import random
import re
from typing import Any

import httpx

log = logging.getLogger("luna.firmament.dj")

# Brief mic drops — talk over the bed, not a monologue
MAX_DROP_CHARS = 150
DEFAULT_STATION = "Telephantix Radio"
DEFAULT_ARTIST = "Telephantix"

# Free DJ character (no paid API voice required)
DJ_CHARACTER = {
    "id": "vox",
    "name": "DJ Vox",
    "handle": "Vox",
    "title": "board op · Luna Camp overnight",
    "station": DEFAULT_STATION,
    "voice_key": "vox",  # edge-tts free male neural
    "vibe": (
        "Warm late-night radio host. Cosmic but grounded, playful, never corporate. "
        "Loves Telephantix tracks, the meadow, and night drivers. Short drops only."
    ),
    "signoffs": [
        "Vox on the boards.",
        "This is Vox — stay with the signal.",
        "Vox out — music up.",
        "— Vox, overnight.",
    ],
}


def _clean_title(s: str) -> str:
    t = re.sub(r"\s+", " ", str(s or "").strip())
    return t[:80] if t else "this next one"


def template_drop(
    *,
    next_title: str,
    prev_title: str = "",
    artist: str = DEFAULT_ARTIST,
    station: str = DEFAULT_STATION,
) -> str:
    """Brief clever line that *names* the next song — designed to ride over a music bed."""
    nxt = _clean_title(next_title)
    prev = _clean_title(prev_title) if prev_title else ""
    art = _clean_title(artist) or DEFAULT_ARTIST
    name = DJ_CHARACTER["handle"]

    # One tight beat: always include next title; optional prev wink
    lines = [
        f"{name} here — sliding into {nxt}. Let it open up.",
        f"Here's {nxt} by {art}. Windows-down energy.",
        f"Don't blink — {nxt} is already under us.",
        f"From the booth: {nxt}. Telephantix does the rest.",
        f"Soft landing into {nxt}. Stay with it.",
        f"{nxt} — this one's for the night drivers.",
        f"Spinning {nxt}. Stay weird, stay kind.",
        f"Camp, breathe — {art}, {nxt}.",
        f"Right into {nxt}. I won't talk over the good part.",
        f"Board flip: {nxt}. Vox out — music up.",
    ]
    if prev and prev.lower() != nxt.lower():
        lines.extend(
            [
                f"Out of {prev}, into {nxt}. Clean handoff.",
                f"That was {prev} — now {nxt} takes the wheel.",
                f"Leaving {prev} in the rearview. {nxt}.",
            ]
        )
    line = random.choice(lines).strip()
    if len(line) > MAX_DROP_CHARS:
        line = line[: MAX_DROP_CHARS - 1].rstrip() + "…"
    return line


def station_id_drop() -> str:
    """Short sign-on — rides over whatever is already playing."""
    name = DJ_CHARACTER["name"]
    st = DJ_CHARACTER["station"]
    lines = [
        f"{name} on {st}. Telephantix only — stay with the signal.",
        f"Overnight meadow. {name}. We keep it human.",
        f"You're on {st}. I'm {name} — brief talk, long songs.",
    ]
    return random.choice(lines)


def _ollama_host() -> str:
    return (os.getenv("OLLAMA_HOST") or os.getenv("LUNA_OLLAMA_HOST") or "http://127.0.0.1:11434").rstrip(
        "/"
    )


def _ollama_model() -> str:
    return os.getenv("OLLAMA_MODEL") or os.getenv("LUNA_OLLAMA_MODEL") or "hermes3"


def craft_drop_with_ollama(
    *,
    next_title: str,
    prev_title: str = "",
    artist: str = DEFAULT_ARTIST,
    station: str = DEFAULT_STATION,
    timeout: float = 8.0,
) -> str | None:
    """Short DJ Vox script via local Ollama. Returns None on any failure."""
    nxt = _clean_title(next_title)
    prev = _clean_title(prev_title)
    art = _clean_title(artist) or DEFAULT_ARTIST
    st = _clean_title(station) or DEFAULT_STATION
    char = DJ_CHARACTER
    prompt = (
        f"You are {char['name']} ({char['handle']}), a free Spotify-style AI radio DJ on {st}. "
        f"Persona: {char['vibe']} "
        f"Write ONE short spoken intro (1 sentence, max 22 words) for the song that is STARTING NOW. "
        f"Sound like Spotify DJ: personal, clever, specific to THIS track — not generic. "
        f"You MUST say the exact title \"{nxt}\". Artist: {art}. "
        + (f'You can nod at the previous song \"{prev}\" in a half-breath. ' if prev else "")
        + "Talking over the intro of the track. No hashtags, no emojis, no stage directions. "
        "Only the words into the mic."
    )
    model = _ollama_model()
    host = _ollama_host()
    try:
        with httpx.Client(timeout=timeout) as client:
            r = client.post(
                f"{host}/api/chat",
                json={
                    "model": model,
                    "stream": False,
                    "options": {"temperature": 0.9, "num_predict": 100},
                    "messages": [
                        {
                            "role": "system",
                            "content": (
                                f"You are {char['name']}, a free live radio DJ character. "
                                "Only output the spoken drop."
                            ),
                        },
                        {"role": "user", "content": prompt},
                    ],
                },
            )
            if r.status_code != 200:
                r = client.post(
                    f"{host}/api/generate",
                    json={
                        "model": model,
                        "prompt": prompt,
                        "stream": False,
                        "options": {"temperature": 0.9, "num_predict": 100},
                    },
                )
            if r.status_code != 200:
                return None
            data = r.json()
            text = (
                (data.get("message") or {}).get("content")
                if isinstance(data.get("message"), dict)
                else None
            ) or data.get("response") or ""
            text = re.sub(r"\s+", " ", str(text)).strip().strip("\"'")
            text = re.sub(r"^(DJ|Host|Announcer|Vox)\s*:\s*", "", text, flags=re.I)
            if len(text) < 12:
                return None
            if len(text) > MAX_DROP_CHARS:
                text = text[: MAX_DROP_CHARS - 1].rstrip() + "…"
            return text
    except Exception as exc:
        log.info("dj ollama skip: %s", exc)
        return None


def craft_dj_line(
    *,
    next_title: str,
    prev_title: str = "",
    artist: str = DEFAULT_ARTIST,
    station: str = DEFAULT_STATION,
    use_llm: bool = True,
    kind: str = "bridge",
) -> dict[str, Any]:
    """
    kind: ``bridge`` (between songs) | ``id`` (station ID / first open)
    """
    source = "template"
    line = None
    if kind == "id":
        line = station_id_drop()
        source = "template-id"
        if use_llm:
            # Optional: punch up ID via LLM
            punched = craft_drop_with_ollama(
                next_title=next_title or "the overnight set",
                prev_title="",
                artist=artist,
                station=station,
            )
            if punched:
                line = punched
                source = "ollama-id"
    else:
        if use_llm:
            line = craft_drop_with_ollama(
                next_title=next_title,
                prev_title=prev_title,
                artist=artist,
                station=station,
            )
            if line:
                source = "ollama"
        if not line:
            line = template_drop(
                next_title=next_title,
                prev_title=prev_title,
                artist=artist,
                station=station,
            )
            source = "template"
    return {
        "text": line,
        "source": source,
        "next_title": _clean_title(next_title),
        "prev_title": _clean_title(prev_title),
        "artist": _clean_title(artist) or DEFAULT_ARTIST,
        "station": _clean_title(station) or DEFAULT_STATION,
        "dj": {
            "id": DJ_CHARACTER["id"],
            "name": DJ_CHARACTER["name"],
            "handle": DJ_CHARACTER["handle"],
            "title": DJ_CHARACTER["title"],
            "voice_key": DJ_CHARACTER["voice_key"],
        },
    }


def dj_public_profile() -> dict[str, Any]:
    return {
        "id": DJ_CHARACTER["id"],
        "name": DJ_CHARACTER["name"],
        "handle": DJ_CHARACTER["handle"],
        "title": DJ_CHARACTER["title"],
        "station": DJ_CHARACTER["station"],
        "voice_key": DJ_CHARACTER["voice_key"],
        "vibe": DJ_CHARACTER["vibe"],
        "free": True,
        "tts": "edge-tts",
        "default_on": True,
    }
