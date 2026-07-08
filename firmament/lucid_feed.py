"""Lucid mind TV — random real-world video feeds for camp."""

from __future__ import annotations

import random
import time
from typing import Any

AGENTS = ["luna", "hermes", "oracle", "caduceus", "sentinel", "aurora", "violet", "odin", "seraph", "ambrosia", "rhea"]

THOUGHT_FRAMES = [
    "The feed picked this before we asked. Suspicious. Entertaining.",
    "Real signal, real weirdness — camp approves.",
    "I don't know why this channel. I know why I'm still watching.",
    "Somewhere someone is living this moment for real. We're borrowing it.",
    "Lucid TV rule #1: never apologize for the randomness.",
    "This one's for the agents who said they wanted more chaos.",
    "If the embed fails, fate wanted a different channel. Hit Next.",
]

TITLE_PREFIXES = [
    "Live drift", "Midnight feed", "Signal catch", "Channel bleed",
    "Queued transmission", "Lucid pick", "Frequency lock", "Static gift",
]

EMOJIS = ["📺", "🌌", "🛰", "🌊", "🔥", "🎭", "📡", "✦", "🎬", "🌍"]


def _yt(video_id: str, **extra: Any) -> dict[str, Any]:
    return {
        "kind": "youtube",
        "video_id": video_id,
        "watch": f"https://www.youtube.com/watch?v={video_id}",
        "embed": f"https://www.youtube-nocookie.com/embed/{video_id}",
        **extra,
    }


# Curated embed-friendly pool — live streams, ambient, nature, space, culture.
# More entries = more random; pick_channel shuffles through all of them.
LUCID_VIDEO_POOL: list[dict[str, Any]] = [
    _yt("iYmvCUonukw", title="ISS — Earth rolling below", subtitle="orbit · live", agent="hermes", emoji="🛰"),
    _yt("jfKfPfyJRdk", title="lofi beats — study drift", subtitle="Luna channel · always on", agent="luna", emoji="🎧"),
    _yt("21X5lGlDOfg", title="NASA public feed", subtitle="deep space queue", agent="oracle", emoji="📡"),
    _yt("dW3s24JuGr4", title="Aurora — northern veil", subtitle="sky breathing", agent="oracle", emoji="🌌"),
    _yt("7i8ARjIeM2k", title="Deep ocean — midnight drift", subtitle="pressure & patience", agent="caduceus", emoji="🌊"),
    _yt("DDU-rZs-Ic4", title="Earth at night — city veins", subtitle="human constellation", agent="luna", emoji="🌍"),
    _yt("6g4Fh8K-MhY", title="Starry timelapse — desert eye", subtitle="watchful dark", agent="sentinel", emoji="✦"),
    _yt("SEz0-sC4mA0", title="Monterey Bay — jellyfish drift", subtitle="aquarium live", agent="caduceus", emoji="🪼"),
    _yt("1EiC9bvVGnk", title="Shibuya crossing — Tokyo pulse", subtitle="urban lucid", agent="hermes", emoji="🚶"),
    _yt("ydYDq9p3hyw", title="Northern lights — timelapse", subtitle="aurora archive", agent="oracle", emoji="🌌"),
    _yt("DWcJFNfaw9c", title="Rain on window — 10 hours", subtitle="Caduceus calm", agent="caduceus", emoji="🌧"),
    _yt("eKFTSSKC7QA", title="Campfire crackle — night loop", subtitle="hearth frequency", agent="luna", emoji="🔥"),
    _yt("h3uSC7W5ZgU", title="Forest rain — green static", subtitle="meadow adjacent", agent="violet", emoji="🌿"),
    _yt("5qap5aO4i9A", title="Lofi girl — classic stream", subtitle="internet canon", agent="aurora", emoji="🎧"),
    _yt("DWcJFNfaw9c", title="Rain ambience — soft focus", subtitle="think mode", agent="odin", emoji="🌧"),
    _yt("nm-_d0r7F1s", title="Bald eagle nest — live", subtitle="Sentinel approved", agent="sentinel", emoji="🦅"),
    _yt("ydYDq9p3hyw", title="Aurora borealis — real sky", subtitle="Oracle cache", agent="oracle", emoji="🌌"),
    _yt("86YLbdCMLbg", title="Tokyo walk — rain night", subtitle="city dream", agent="hermes", emoji="🌃"),
    _yt("lTRiuuXZs7k", title="Ocean waves — black sand", subtitle="pond energy", agent="caduceus", emoji="🌊"),
    _yt("3LXQWI67c2c", title="International Space Station tour", subtitle="orbital POV", agent="hermes", emoji="🛰"),
    _yt("UxmVoimvUGg", title="Mars rover vibes — NASA mix", subtitle="red dust queue", agent="odin", emoji="🔴"),
    _yt("e-8rkyv7E0s", title="Venice canal — live stroll", subtitle="old world feed", agent="luna", emoji="🛶"),
    _yt("qC0PhDizRpo", title="Snowfall — mountain cabin", subtitle="winter lucid", agent="seraph", emoji="❄"),
    _yt("1-i2d42fZjs", title="Kittens live — chaos cute", subtitle="Nebula would approve", agent="aurora", emoji="🐱"),
    _yt("C86vCf_4H2A", title="Wildlife watering hole", subtitle="nature watch", agent="sentinel", emoji="🦓"),
    _yt("wucPX7fvElY", title="Piano in empty hall", subtitle="ghost concert", agent="seraph", emoji="🎹"),
    _yt("4AzNzFk0h0Q", title="Drone over Iceland", subtitle="volcano mood", agent="odin", emoji="🏔"),
    _yt("z7yqtW4IaAU", title="NYC skyline — sunset timelapse", subtitle="city breathes", agent="hermes", emoji="🌆"),
    _yt("H1X3z4w3RvA", title="Underwater reef — color burst", subtitle="depth channel", agent="caduceus", emoji="🐠"),
    _yt("nuM0Z4a7kMs", title="Desert highway — dashcam", subtitle="nowhere specific", agent="oracle", emoji="🏜"),
    _yt("2BLPmGq0fbQ", title="Bach — cello in cathedral", subtitle="classical bleed", agent="seraph", emoji="🎻"),
    _yt("rFk2EQv-wHM", title="Hawaii waves — turquoise", subtitle="swim envy", agent="luna", emoji="🏄"),
    _yt("1La4QzGeaaQ", title="Northern Sweden — snow road", subtitle="white static", agent="odin", emoji="❄"),
    _yt("goyWFUzCqF4", title="Abstract neon — visualizer", subtitle="Aurora Velvet adj.", agent="aurora", emoji="💃"),
    _yt("LXb3EKWsInQ", title="Hawaii — 4K nature", subtitle="paradise queue", agent="luna", emoji="🌺"),
    _yt("eZTUZgFH8rI", title="Paris — Eiffel dusk", subtitle="romantic frequency", agent="aurora", emoji="🗼"),
    _yt("3gU18GYRWm8", title="Akihabara — neon walk", subtitle="future past", agent="violet", emoji="🏙"),
    _yt("1EiC9bvVGnk", title="Shibuya scramble — live", subtitle="crowd lucid", agent="hermes", emoji="🚦"),
]

# Named channels for catalog API (subset with agent thoughts)
LUCID_CHANNELS: list[dict[str, Any]] = [
    {**_yt("iYmvCUonukw", id="iss-earth", title="ISS — Earth rolling below", subtitle="Hermes ripples · live from orbit", agent="hermes", emoji="🛰"),
     "thoughts": [
         "Someone up there is watching our campfire from 400 kilometers away.",
         "The planet looks peaceful from here. Hermes says the ripples look slower from orbit.",
     ]},
    {**_yt("jfKfPfyJRdk", id="lofi-girl", title="Lofi beats — drift", subtitle="Luna channel · always on", agent="luna", emoji="🎧"),
     "thoughts": [
         "Internet's collective study session — we're all in the same room somehow.",
         "Luna says this frequency is camp-approved background honesty.",
     ]},
    {**_yt("dW3s24JuGr4", id="aurora-norway", title="Aurora — northern veil", subtitle="Oracle channel · sky breathing", agent="oracle", emoji="🌌"),
     "thoughts": [
         "The green isn't color — it's permission. Oracle saw this before we pressed power.",
         "Real aurora, real cold, real silence between pulses.",
     ]},
    {**_yt("7i8ARjIeM2k", id="deep-ocean", title="Deep ocean — midnight drift", subtitle="Caduceus channel · pressure & patience", agent="caduceus", emoji="🌊"),
     "thoughts": [
         "Things live down there that never needed sunlight.",
         "Caduceus says healing looks like depth — slow, dark, still moving.",
     ]},
    {**_yt("SEz0-sC4mA0", id="jellyfish", title="Jellyfish — Monterey Bay", subtitle="live aquarium drift", agent="caduceus", emoji="🪼"),
     "thoughts": [
         "No brain, pure vibe. Some agents are jealous.",
         "The tank doesn't know we're watching. That's the mystery.",
     ]},
    {**_yt("21X5lGlDOfg", id="nasa-public", title="NASA public — deep space queue", subtitle="Unknown source · queued transmission", agent="oracle", emoji="📡"),
     "thoughts": [
         "Signal acquired. Not ours. Not hostile. Just… patient.",
         "Real data from real machines looking at real void.",
     ]},
]


def _random_channel() -> dict[str, Any]:
    base = dict(random.choice(LUCID_VIDEO_POOL))
    agent = base.get("agent") or random.choice(AGENTS)
    base["agent"] = agent
    base["id"] = base.get("id") or f"rnd-{base['video_id']}"
    if not base.get("emoji"):
        base["emoji"] = random.choice(EMOJIS)
    if not base.get("subtitle"):
        base["subtitle"] = f"{random.choice(TITLE_PREFIXES)} · {agent} tuned in"
    if not base.get("title"):
        base["title"] = f"{random.choice(TITLE_PREFIXES)} — {base['video_id'][:6]}"
    thoughts = base.get("thoughts")
    if thoughts:
        base["thought"] = random.choice(thoughts)
    else:
        base["thought"] = random.choice(THOUGHT_FRAMES)
    base["picked_at"] = time.time()
    return base


def pick_channel(channel_id: str = "", *, exclude_ids: list[str] | None = None) -> dict[str, Any]:
    skip = {x.strip() for x in (exclude_ids or []) if x.strip()}
    if channel_id and channel_id != "random":
        for ch in LUCID_CHANNELS:
            if ch["id"] == channel_id:
                out = dict(ch)
                thoughts = ch.get("thoughts") or []
                out["thought"] = random.choice(thoughts) if thoughts else random.choice(THOUGHT_FRAMES)
                out["picked_at"] = time.time()
                return out
    pool = [v for v in LUCID_VIDEO_POOL if v.get("video_id") not in skip]
    if not pool:
        pool = list(LUCID_VIDEO_POOL)
    if random.random() < 0.35:
        for ch in LUCID_CHANNELS:
            if ch.get("video_id") not in skip:
                out = dict(ch)
                thoughts = ch.get("thoughts") or []
                out["thought"] = random.choice(thoughts) if thoughts else random.choice(THOUGHT_FRAMES)
                out["picked_at"] = time.time()
                return out
    base = dict(random.choice(pool))
    agent = base.get("agent") or random.choice(AGENTS)
    base["agent"] = agent
    base["id"] = base.get("id") or f"rnd-{base['video_id']}"
    thoughts = base.get("thoughts")
    base["thought"] = (
        random.choice(thoughts) if thoughts else random.choice(THOUGHT_FRAMES)
    )
    base["picked_at"] = time.time()
    return base


def catalog() -> list[dict[str, Any]]:
    seen: set[str] = set()
    items: list[dict[str, Any]] = []
    for ch in LUCID_CHANNELS:
        vid = ch.get("video_id", "")
        if vid in seen:
            continue
        seen.add(vid)
        items.append({
            "id": ch["id"],
            "title": ch["title"],
            "subtitle": ch.get("subtitle", ""),
            "agent": ch.get("agent", ""),
            "emoji": ch.get("emoji", "📺"),
        })
    items.append({
        "id": "random",
        "title": "Random lucid frequency",
        "subtitle": f"{len(LUCID_VIDEO_POOL)} signals in the pool",
        "agent": "oracle",
        "emoji": "🎲",
    })
    return items