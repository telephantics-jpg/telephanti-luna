"""Telephantix DJ Radio  -  free local drops between songs.

Character: **DJ Vox**  -  late-night Luna Camp board op, free edge-tts voice.
Script: Ollama (hermes3/llama3.2) when free minds is on · witty templates offline.
Voice: edge-tts GuyNeural (free)  -  keyed as ``dj`` / ``vox``.

Kinds:
  - ``bridge``  -  short witty handoff that names the next track (most songs)
  - ``truth``  -  slightly longer world-truth monologue, still lands on the track (~every 3-4 songs)
  - ``id``  -  station sign-on
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
        "Late-night board op with dry comic timing. Ironic but accurate  -  "
        "says the quiet true thing like a joke that lands. Even energy every drop: "
        "two beats, one laugh of recognition, then the song. Never mean, never preachy, "
        "never corporate. Loves Telephantix, night drivers, and the comedy of modern life."
    ),
    "signoffs": [
        "Vox on the boards.",
        "This is Vox  -  stay with the signal.",
        "Vox out  -  music up, ego down.",
        " -  Vox, overnight. Don't @ me.",
    ],
}

# Ironic-but-true world bits  -  funny first, accurate second. Not partisan.
# Rotated by calendar day so the set feels like "today" without news APIs.
WORLD_TRUTHS = [
    (
        "We built pocket supercomputers so we could argue with strangers about lunch. "
        "Progress: yes. Wisdom: still buffering."
    ),
    (
        "Everyone's 'building a personal brand' like personality is a SaaS tier. "
        "Meanwhile character is still free and somehow rarer."
    ),
    (
        "We have infinite entertainment and the collective attention span of a goldfish "
        "with a push notification. Congrats to us."
    ),
    (
        "The algorithm will feed you the version of you that clicks most. "
        "That's not destiny  -  that's a vending machine with better lighting."
    ),
    (
        "We're always 'connected' and somehow always late to call the one person "
        "who'd actually pick up. Bandwidth isn't the same as showing up."
    ),
    (
        "News wants your panic before breakfast; truth wants a second source. "
        "One of those has a business model. Guess which."
    ),
    (
        "A.I. will write the email. You still have to mean the apology. "
        "The model doesn't get the awkward lunch after."
    ),
    (
        "We optimized life for convenience and accidentally deleted patience. "
        "Now waiting three seconds feels like a human rights violation."
    ),
    (
        "Loneliness is booming in group chats. Proximity was never the product  -  "
        "presence was. We just bought the wrong upgrade."
    ),
    (
        "Your body still needs sleep, water, and sunlight. No subscription plan "
        "has patched biology yet  -  trust me, they've tried."
    ),
    (
        "We document every sandwich and forget whole years. "
        "Live one scene you won't post. Those are the ones that actually stick."
    ),
    (
        "Public life pays for performance; private life pays for integrity. "
        "Only one of those shows up when the Wi-Fi dies."
    ),
    (
        "Infinite choice was sold as freedom. Turns out it's just a loading screen "
        "with better thumbnails. Pick something good enough and go."
    ),
    (
        "Polarization is a growth industry. Nuance doesn't trend. "
        "Be expensive: hold two thoughts without starting a podcast about either."
    ),
    (
        "We treat health like optional DLC and then wonder why the main quest lags. "
        "Move. Eat something that had a mother. Sleep like it matters."
    ),
    (
        "Trust is expensive to earn and cheap to fake online. "
        "That's not cynicism  -  that's the fee schedule."
    ),
    (
        "Everyone wants to be a main character; almost nobody wants to do the dishes "
        "in act two. Spoiler: the dishes are the plot."
    ),
    (
        "Climate isn't a vibe check  -  it's physics with a due date. "
        "Hope without action is décor; action without hope is just yelling at the thermostat."
    ),
    (
        "Your nervous system wasn't designed for global catastrophe before coffee. "
        "Local care first: one room, one person, one true task. Save the planet after lunch."
    ),
    (
        "Craft is quiet; takes are loud. The loud thing goes viral; the quiet thing "
        "outlasts the app. Choose your immortality carefully."
    ),
    (
        "We call it 'multitasking' when it's really 'doing three things badly "
        "while feeling productive.' Single-thread is the new flex."
    ),
    (
        "Kindness without boundaries is a doormat with good PR. "
        "Boundaries without kindness is a fortress with no friends. Calibrate."
    ),
    (
        "Debt, dopamine, and deadlines run the modern calendar. "
        "Steal one hour that isn't monetized. Call it a crime. Call it free."
    ),
    (
        "Screens flattened the night sky into a rectangle. "
        "Step outside  -  the original timeline is still streaming, no ads."
    ),
    (
        "Advice culture is huge; follow-through culture is a niche hobby. "
        "Knowing better is free. Doing better costs one awkward Tuesday."
    ),
    (
        "We're drowning in opinions and starving for people who can change their mind "
        "without a press release. Stay weird enough to revise."
    ),
    (
        "The best meetings could've been a sentence. The best apologies still can't. "
        "Allocate your words like rent money."
    ),
    (
        "Creativity is the escape hatch from machine sameness. "
        "Ugly first drafts beat polished emptiness  -  and they cost less lighting."
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
    """Even witty bridge (~2 sentences): funny + true, names the next song."""
    nxt = _clean_title(next_title)
    prev = _clean_title(prev_title) if prev_title else ""
    art = _clean_title(artist) or DEFAULT_ARTIST
    name = DJ_CHARACTER["handle"]

    # Keep lengths similar so the set feels even  -  joke, then land on title.
    lines = [
        f"{name} here  -  {nxt} is up. I could hype it with five adjectives, but honesty is funnier: it slaps, so stop doomscrolling for one song.",
        f"Incoming: {nxt} by {art}. Windows-down energy in a world that mostly offers notification anxiety. Rare upgrade  -  take it.",
        f"Don't skip the first thirty seconds of {nxt}. That's where the song earns your trust and your phone loses the argument.",
        f"Board flip to {nxt}. Cosmic, not corporate yoga voice. Stay weird, stay kind, leave the brand deck at the door.",
        f"Soft landing into {nxt}. I'll talk just long enough to prove I'm awake  -  then the music does the grown-up work.",
        f"{nxt}  -  for night drivers and people who rehearse arguments in the shower. Both of you are valid. Neither of you should text yet.",
        f"Spinning {nxt}. If today flattened you into a productivity spreadsheet, this one puts some illegal dimension back.",
        f"Camp, breathe  -  {art}, {nxt}. The algorithm wants your panic; this track wants your shoulders somewhere near human.",
        f"This is {nxt}. Not a product placement  -  a mood delivery. No signature required. No upsell. Weird, I know.",
        f"{name} says: if life felt synthetic today, {nxt} is the antidote with a pulse and zero Terms of Service.",
        f"Sliding into {nxt}. One ear on the lyric, one on the true thing you've been dodging. Multitasking, but useful for once.",
        f"Telephantix Radio  -  {nxt} next. Brief talk, longer song, zero lectures. You're welcome; my therapist is less efficient.",
        f"Right into {nxt}. I'll keep this shorter than a corporate all-hands and twice as honest.",
        f"Here's {nxt}. Brain on, shoulders down  -  a combo the modern workplace forgot to invent.",
        f"Cue {nxt} by {art}. If the bass finds your pulse before your to-do list does, that's not an accident  -  that's mercy.",
        f"{name} on the boards: {nxt}. Clever without smug, warm without syrup. Like good company that doesn't check their phone mid-sentence.",
        f"Music up on {nxt}. Ego down. Notification badges can wait  -  they've survived without you this long.",
        f"Playing {nxt}. Consider this a tiny rebellion against the infinite scroll. We still have those.",
    ]
    if prev and prev.lower() != nxt.lower():
        lines.extend(
            [
                f"Out of {prev}, into {nxt}. Clean handoff  -  like changing lanes without inventing a new personality online.",
                f"That was {prev}  -  now {nxt} takes the wheel. Same night, new voltage, fewer opinions required.",
                f"Leaving {prev} in the rearview. Ahead: {nxt}. Don't text-and-drive your whole life either  -  ask me how I know.",
                f"From {prev} to {nxt}  -  the set has a spine tonight. Stay with it; the skip button is a coward's democracy.",
                f"Closed {prev}. Opening {nxt}. Continuity is underrated in a culture of cold opens and colder takes.",
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
    """Every few songs: ironic-true beat, then land on the track by name."""
    nxt = _clean_title(next_title)
    art = _clean_title(artist) or DEFAULT_ARTIST
    name = DJ_CHARACTER["handle"]
    truth = random.choice(_todays_truths(14))

    openers = [
        f"{name} with a true thing that sounds like a joke  -  because it is, and also isn't.",
        f"Hold skip half a second. Funny truth from outside the booth.",
        f"{name} here. Observation, not a TED talk  -  then we play.",
        f"Quick world note, dry humor included, refunds not available.",
        f"Today's world, booth edition: ironic, accurate, mercifully short.",
        f"Real talk that won't ruin the vibe  -  that's the whole brand.",
    ]
    landings = [
        f"Truth parked. Here's {nxt} by {art}. Windows down if you can; ego down either way.",
        f"That's the bit. Congregation: {nxt}. Collection plate is optional.",
        f"Mic down  -  {nxt} takes it. Stay human; the bots already filled the group chat.",
        f"Enough philosophy. {art}, {nxt}. Medicine that doesn't taste like kale.",
        f"And scene  -  {nxt}. Let it work while the world keeps refreshing itself.",
        f"Joke over, song on: {nxt}. Same energy, better bass.",
    ]
    line = f"{random.choice(openers)} {truth} {random.choice(landings)}"
    return _clamp(line, MAX_TRUTH_CHARS)


def station_id_drop() -> str:
    """Short sign-on  -  rides over whatever is already playing."""
    name = DJ_CHARACTER["name"]
    st = DJ_CHARACTER["station"]
    lines = [
        f"{name} on {st}. Telephantix only  -  funny truths, real songs, no corporate mindfulness tax.",
        f"Overnight meadow. {name}. Even drops, dry jokes, occasional world-truth that lands soft.",
        f"You're on {st}. I'm {name}  -  witty handoffs, ironic honesty, long songs that don't apologize.",
        f"{name} at the boards. Every few tracks I say something true that sounds like a joke. The rest is music.",
        f"{st} overnight with {name}. Skip culture is loud; good songs are louder if you let them.",
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
        truth_seed = random.choice(_todays_truths(12))
        prompt = (
            f"You are {char['name']} ({char['handle']}), free late-night DJ on {st}. "
            f"Persona: {char['vibe']} "
            f"Write a spoken mic drop (2-4 short sentences, about 50-85 words) that: "
            f"(1) opens as Vox with even, confident booth energy, "
            f"(2) delivers ONE funny, ironic-but-true observation about modern life "
            f"(phones, algorithms, loneliness-in-group-chats, sleep, craft, attention, choice paralysis  -  "
            f"NOT partisan politics, NOT mean, NOT a lecture), "
            f"(3) MUST name the exact song title \"{nxt}\" by {art} at the end as the landing. "
            f"Seed idea to riff on in your voice (do not quote verbatim): {truth_seed} "
            "Tone: dry comedy that nods yes because it's accurate. Friend in the booth, not a coach. "
            "No hashtags, no emojis, no stage directions. Only words into the mic."
        )
        max_chars = MAX_TRUTH_CHARS
        num_predict = 220
    else:
        prompt = (
            f"You are {char['name']} ({char['handle']}), free Spotify-style radio DJ on {st}. "
            f"Persona: {char['vibe']} "
            f"Write ONE spoken intro (exactly 2 short sentences, about 30-48 words) for the song STARTING NOW. "
            f"Even energy every time: first sentence a dry funny true beat, second lands on the song. "
            f"You MUST say the exact title \"{nxt}\". Artist: {art}. "
            + (f'Optional half-breath nod to previous song \"{prev}\". ' if prev else "")
            + "Ironic but warm. Not generic hype. Not a monologue. Not corporate. "
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
                                f"You are {char['name']}, a free live radio DJ. "
                                "Only output the spoken drop. Funny, ironic, true, even length. "
                                "Never mean. Never preach. Never mention AI, models, or prompts."
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
        "drop_style": "even witty bridges · funny ironic truths",
    }
