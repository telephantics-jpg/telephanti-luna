"""Telephantix DJ Radio — free local drops between songs.

Character: **DJ Vox** — late-night Luna Camp board op, free edge-tts voice.
Script: Ollama (hermes3/llama3.2) when free minds is on · witty templates offline.
Voice: edge-tts GuyNeural (free) — keyed as ``dj`` / ``vox``.

Kinds:
  - ``bridge`` — short witty handoff that names the next track (most songs)
  - ``truth`` — slightly longer world-truth monologue, still lands on the track (~every 3–4 songs)
  - ``id`` — station sign-on
"""

from __future__ import annotations

import logging
import os
import random
import re
from datetime import date
from typing import Any

import httpx

log = logging.getLogger("luna.firmament.dj")

# Bridge = tad longer witty; truth = fuller beat over the bed
MAX_DROP_CHARS = 280
MAX_TRUTH_CHARS = 420
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
        "Warm late-night radio host. Cosmic but grounded, dry-witty, never corporate. "
        "Loves Telephantix tracks, the meadow, night drivers, and saying one true thing "
        "without lecturing. Talks like a friend in the booth — clever, a little longer than "
        "a jingle, never a TED talk."
    ),
    "signoffs": [
        "Vox on the boards.",
        "This is Vox — stay with the signal.",
        "Vox out — music up.",
        "— Vox, overnight.",
    ],
}

# Grounded "today's world" truths — observational, not partisan rant.
# Rotated by calendar day so the set feels like "today" without needing news APIs.
WORLD_TRUTHS = [
    (
        "Today's world is a firehose with a like button. Attention is the new oil, "
        "and most of us are the pipeline. Guard the tap."
    ),
    (
        "We carry supercomputers in our pockets and still forget to call the people "
        "who would actually answer. Connection isn't bandwidth — it's follow-through."
    ),
    (
        "Everyone's broadcasting; almost nobody's listening. Being the one who listens "
        "is a quiet superpower now."
    ),
    (
        "The algorithm will happily optimize you into a smaller version of yourself. "
        "Choose one true thing offline today and look longer than comfort allows."
    ),
    (
        "We're more informed and more exhausted than any generation before us. "
        "Information isn't wisdom until it changes how you treat the next person."
    ),
    (
        "Climate isn't a vibe; it's physics with a calendar. Hope without action is décor. "
        "Action without hope is burnout. Hold both."
    ),
    (
        "A.I. can draft the sentence; only you can mean it. Don't outsource your honesty "
        "to a model that never has to live with the consequences."
    ),
    (
        "Loneliness is epidemic in a world of constant pings. Proximity isn't presence. "
        "Text less. Show up more."
    ),
    (
        "News moves at panic speed; truth moves at verification speed. If it demands "
        "your rage before your curiosity, wait one breath."
    ),
    (
        "Your body still runs on sleep, water, salt, and sunlight — no app can patch that. "
        "The oldest tech still wins."
    ),
    (
        "Public life rewards performance; private life rewards character. Build the part "
        "nobody claps for — that's the load-bearing wall."
    ),
    (
        "We optimized for convenience and accidentally optimized away patience. "
        "Waiting is a muscle. Flex it on purpose."
    ),
    (
        "Debt, dopamine, and deadlines run most modern calendars. Steal back one hour "
        "that isn't monetized. Call it free."
    ),
    (
        "The world is loud about opinions and quiet about craft. Make something solid. "
        "Solid things outlast takes."
    ),
    (
        "Trust is the rarest currency online because it's expensive to verify and cheap to fake. "
        "Earn it slow; spend it careful."
    ),
    (
        "Screens flatten the night sky. Step outside once — the cosmos is still the original "
        "timeline, and it doesn't need an update."
    ),
    (
        "Everyone wants a brand; fewer want a backbone. Consistency under pressure is the "
        "real flex of this era."
    ),
    (
        "Health is upstream of almost every ambition, and we treat it like an optional DLC. "
        "Move. Eat real food. Sleep like it matters — because it does."
    ),
    (
        "The culture sells infinite choice and then wonders why people freeze. Pick a good-enough "
        "path and walk it with style."
    ),
    (
        "Kindness without boundaries is self-erasure; boundaries without kindness is a fortress. "
        "Today's adults need both, calibrated."
    ),
    (
        "We document everything and remember almost nothing. Live one scene you won't post — "
        "those are the ones that stick."
    ),
    (
        "Polarization pays; nuance doesn't. Be expensive. Hold a second thought longer than "
        "the first hot take."
    ),
    (
        "Your nervous system was not designed for global catastrophe before breakfast. "
        "Local care first: one room, one person, one true task."
    ),
    (
        "Creativity is still the escape hatch from machine sameness. Ugly first drafts beat "
        "polished emptiness every time."
    ),
]


def _clean_title(s: str) -> str:
    t = re.sub(r"\s+", " ", str(s or "").strip())
    return t[:80] if t else "this next one"


def _clamp(line: str, max_chars: int) -> str:
    line = re.sub(r"\s+", " ", (line or "").strip())
    if len(line) > max_chars:
        return line[: max_chars - 1].rstrip() + "…"
    return line


def _todays_truths(n: int = 8) -> list[str]:
    """Deterministic daily shuffle so 'today' feels consistent across drops."""
    seed = date.today().toordinal()
    rng = random.Random(seed)
    bag = list(WORLD_TRUTHS)
    rng.shuffle(bag)
    return bag[: max(1, min(n, len(bag)))]


def template_drop(
    *,
    next_title: str,
    prev_title: str = "",
    artist: str = DEFAULT_ARTIST,
    station: str = DEFAULT_STATION,
) -> str:
    """Witty bridge (~2 short sentences) that names the next song — rides over a music bed."""
    nxt = _clean_title(next_title)
    prev = _clean_title(prev_title) if prev_title else ""
    art = _clean_title(artist) or DEFAULT_ARTIST
    name = DJ_CHARACTER["handle"]

    lines = [
        f"{name} in the booth — easing you into {nxt}. Telephantix wrote the feeling; you just have to not skip the first thirty seconds.",
        f"Here's {nxt} by {art}. Windows-down energy, brain-on energy — rare combo, so don't waste it scrolling.",
        f"Don't blink: {nxt} is already under us. If the bass finds your pulse before your thoughts do, that's the point.",
        f"From the boards: {nxt}. Cosmic without the corporate yoga voice. Stay weird, stay kind.",
        f"Soft landing into {nxt}. I could say more, but the good part is coming and I like you enough to shut up soon.",
        f"{nxt} — for the night drivers and the people who rehearse conversations in the shower. You're both valid.",
        f"Spinning {nxt}. If today tried to flatten you, let this one put some dimension back.",
        f"Camp, breathe — {art}, {nxt}. The algorithm wants your panic; this track wants your shoulders down.",
        f"Right into {nxt}. I'll talk just long enough to prove I'm awake, then the music does the real work.",
        f"Board flip: {nxt}. Vox out in a breath — music up, ego down.",
        f"This is {nxt}. Not a product placement — a mood delivery. Accept the package.",
        f"{name} says: if the world felt synthetic today, {nxt} is the antidote with a pulse.",
        f"Incoming: {nxt} by {art}. Clever without being smug, warm without being syrup. Like good company.",
        f"We're sliding into {nxt}. Keep one ear on the lyric and one on whatever true thing you've been dodging.",
        f"Telephantix Radio — {nxt} next. Brief talk, longer song, zero lectures. You're welcome.",
    ]
    if prev and prev.lower() != nxt.lower():
        lines.extend(
            [
                f"Out of {prev}, into {nxt}. Clean handoff — like changing lanes without the road rage.",
                f"That was {prev} — now {nxt} takes the wheel. Same night, new voltage.",
                f"Leaving {prev} in the rearview. Ahead: {nxt}. Don't text and drive your life either.",
                f"From {prev} to {nxt} — the set has a spine tonight. Stay with it.",
            ]
        )
    return _clamp(random.choice(lines), MAX_DROP_CHARS)


def template_truth_drop(
    *,
    next_title: str,
    prev_title: str = "",
    artist: str = DEFAULT_ARTIST,
    station: str = DEFAULT_STATION,
) -> str:
    """Every few songs: a world-truth beat, then land on the track by name."""
    nxt = _clean_title(next_title)
    art = _clean_title(artist) or DEFAULT_ARTIST
    name = DJ_CHARACTER["handle"]
    truth = random.choice(_todays_truths(12))

    openers = [
        f"{name} with a truth from today's world — then we play.",
        f"Quick truth from the world outside the booth.",
        f"Hold the skip button — one true thing, then the music.",
        f"{name} here. Real talk for half a breath.",
        f"Today's world, no TED stage — just the booth.",
    ]
    landings = [
        f"And with that — {nxt}, by {art}. Let it work.",
        f"Truth parked. Here's {nxt}. Windows down if you can.",
        f"That's the sermon. Congregation: {nxt}.",
        f"Mic down — {nxt} takes it from here.",
        f"Enough philosophy. {art}, {nxt}. Stay human.",
        f"Now the medicine: {nxt}.",
    ]
    line = f"{random.choice(openers)} {truth} {random.choice(landings)}"
    return _clamp(line, MAX_TRUTH_CHARS)


def station_id_drop() -> str:
    """Short sign-on — rides over whatever is already playing."""
    name = DJ_CHARACTER["name"]
    st = DJ_CHARACTER["station"]
    lines = [
        f"{name} on {st}. Telephantix only — witty talk, real songs, stay with the signal.",
        f"Overnight meadow. {name}. We keep it human — a little longer when the truth needs air.",
        f"You're on {st}. I'm {name} — clever drops, occasional world-truth, long songs.",
        f"{name} at the boards. Every few tracks I tell you something true about the world. The rest is music.",
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
    kind: str = "bridge",
    timeout: float = 10.0,
) -> str | None:
    """DJ Vox script via local Ollama. Returns None on any failure."""
    nxt = _clean_title(next_title)
    prev = _clean_title(prev_title)
    art = _clean_title(artist) or DEFAULT_ARTIST
    st = _clean_title(station) or DEFAULT_STATION
    char = DJ_CHARACTER
    is_truth = (kind or "").lower() in ("truth", "world", "world_truth", "sermon")

    if is_truth:
        truth_seed = random.choice(_todays_truths(10))
        prompt = (
            f"You are {char['name']} ({char['handle']}), free late-night DJ on {st}. "
            f"Persona: {char['vibe']} "
            f"Write a spoken mic drop (2–4 short sentences, about 45–85 words) that: "
            f"(1) opens as Vox, (2) delivers ONE sharp, witty truth about TODAY'S world "
            f"(attention, tech, loneliness, body, climate-as-physics, craft, kindness — not partisan rant), "
            f"(3) MUST name the exact song title \"{nxt}\" by {art} at the end as the landing. "
            f"Seed idea you may riff on (rewrite in your voice, don't quote): {truth_seed} "
            "Sound like a clever friend in a radio booth, not a coach or news anchor. "
            "No hashtags, no emojis, no stage directions. Only the words into the mic."
        )
        max_chars = MAX_TRUTH_CHARS
        num_predict = 220
    else:
        prompt = (
            f"You are {char['name']} ({char['handle']}), a free Spotify-style AI radio DJ on {st}. "
            f"Persona: {char['vibe']} "
            f"Write ONE spoken intro (1–2 sentences, about 28–45 words) for the song STARTING NOW. "
            f"Witty, specific, a tad longer than a jingle — not generic, not a monologue. "
            f"You MUST say the exact title \"{nxt}\". Artist: {art}. "
            + (f'You may nod at the previous song \"{prev}\" in half a breath. ' if prev else "")
            + "Talking over the intro of the track. Dry humor welcome. "
            "No hashtags, no emojis, no stage directions. Only the words into the mic."
        )
        max_chars = MAX_DROP_CHARS
        num_predict = 140

    model = _ollama_model()
    host = _ollama_host()
    try:
        with httpx.Client(timeout=timeout) as client:
            r = client.post(
                f"{host}/api/chat",
                json={
                    "model": model,
                    "stream": False,
                    "options": {"temperature": 0.92, "num_predict": num_predict},
                    "messages": [
                        {
                            "role": "system",
                            "content": (
                                f"You are {char['name']}, a free live radio DJ character. "
                                "Only output the spoken drop. Be witty. Never mention AI or prompts."
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
                        "options": {"temperature": 0.92, "num_predict": num_predict},
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
            return _clamp(text, max_chars)
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
    kind: ``bridge`` | ``truth`` (world-truth every few songs) | ``id``
    """
    raw_kind = (kind or "bridge").strip().lower() or "bridge"
    if raw_kind in ("world", "world_truth", "sermon", "truths"):
        raw_kind = "truth"
    source = "template"
    line = None

    if raw_kind == "id":
        line = station_id_drop()
        source = "template-id"
        if use_llm:
            punched = craft_drop_with_ollama(
                next_title=next_title or "the overnight set",
                prev_title="",
                artist=artist,
                station=station,
                kind="bridge",
            )
            if punched:
                line = punched
                source = "ollama-id"
    elif raw_kind == "truth":
        if use_llm:
            line = craft_drop_with_ollama(
                next_title=next_title,
                prev_title=prev_title,
                artist=artist,
                station=station,
                kind="truth",
            )
            if line:
                source = "ollama-truth"
        if not line:
            line = template_truth_drop(
                next_title=next_title,
                prev_title=prev_title,
                artist=artist,
                station=station,
            )
            source = "template-truth"
    else:
        if use_llm:
            line = craft_drop_with_ollama(
                next_title=next_title,
                prev_title=prev_title,
                artist=artist,
                station=station,
                kind="bridge",
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
        "kind": raw_kind,
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
        "truth_every": "3-4 songs",
        "drop_style": "witty bridge · occasional world-truth",
    }
