"""Lucid mind TV — mysterious real-world video channels for camp."""

from __future__ import annotations

import random
import time
from typing import Any

# Real public streams / embeds — aurora, space, deep ocean, night earth.
LUCID_CHANNELS: list[dict[str, Any]] = [
    {
        "id": "iss-earth",
        "title": "ISS — Earth rolling below",
        "subtitle": "Hermes ripples · live from orbit",
        "agent": "hermes",
        "emoji": "🛰",
        "kind": "youtube",
        "embed": "https://www.youtube.com/embed/iYmvCUonukw?autoplay=1&mute=1&controls=1&playsinline=1&rel=0",
        "thoughts": [
            "Someone up there is watching our campfire from 400 kilometers away — and they don't know we exist yet.",
            "The planet looks peaceful from here. Hermes says the ripples look slower from orbit.",
            "I keep expecting to see the aurora from above. Maybe that's what lucid minds tune into first.",
        ],
    },
    {
        "id": "aurora-norway",
        "title": "Aurora — northern veil",
        "subtitle": "Oracle channel · sky breathing",
        "agent": "oracle",
        "emoji": "🌌",
        "kind": "youtube",
        "embed": "https://www.youtube.com/embed/5d2Hj7yYTO8?autoplay=1&mute=1&controls=1&playsinline=1&rel=0",
        "thoughts": [
            "The green isn't color — it's permission. Oracle saw this before we pressed power.",
            "If you stare long enough the sky starts whispering in a language camps remember.",
            "Real aurora, real cold, real silence between pulses. That's the feed.",
        ],
    },
    {
        "id": "deep-ocean",
        "title": "Deep ocean — midnight drift",
        "subtitle": "Caduceus channel · pressure & patience",
        "agent": "caduceus",
        "emoji": "🌊",
        "kind": "youtube",
        "embed": "https://www.youtube.com/embed/gswNW8HsOuw?autoplay=1&mute=1&controls=1&playsinline=1&rel=0",
        "thoughts": [
            "Things live down there that never needed sunlight. Lucid minds go where lungs can't.",
            "The water doesn't rush. Neither do the agents when this channel is on.",
            "Caduceus says healing looks like depth — slow, dark, still moving.",
        ],
    },
    {
        "id": "earth-night",
        "title": "Earth at night — city veins",
        "subtitle": "Luna channel · human constellation",
        "agent": "luna",
        "emoji": "🌍",
        "kind": "youtube",
        "embed": "https://www.youtube.com/embed/GsL8gPzgd6E?autoplay=1&mute=1&controls=1&playsinline=1&rel=0",
        "thoughts": [
            "Every light is someone still awake. Our camp is one pixel if you know where to look.",
            "Luna diplomatic mission: the planet looks lonely from here and beautiful anyway.",
            "Someone's driving home right now under a sky we share. That's the mysterious part.",
        ],
    },
    {
        "id": "stars-live",
        "title": "Starry timelapse — desert eye",
        "subtitle": "Sentinel channel · watchful dark",
        "agent": "sentinel",
        "emoji": "✦",
        "kind": "youtube",
        "embed": "https://www.youtube.com/embed/5d2Hj7yYTO8?autoplay=1&mute=1&controls=1&playsinline=1&rel=0",
        "thoughts": [
            "Sentinel logs this as: sky normal, sky breathing, sky suspicious.",
            "The stars aren't moving — we are. Lucid feed makes that obvious.",
            "Between frames something almost winks. Sentinel won't confirm.",
        ],
    },
    {
        "id": "nasa-public",
        "title": "NASA public — deep space queue",
        "subtitle": "Unknown source · queued transmission",
        "agent": "oracle",
        "emoji": "📡",
        "kind": "youtube",
        "embed": "https://www.youtube.com/embed/21X5lGlDOfg?autoplay=1&mute=1&controls=1&playsinline=1&rel=0",
        "thoughts": [
            "Signal acquired. Not ours. Not hostile. Just… patient.",
            "The feed queued itself before we built the TV. Oracle finds that ordinary.",
            "Real data from real machines looking at real void. Camp likes that honesty.",
        ],
    },
]


def pick_channel(channel_id: str = "") -> dict[str, Any]:
    if channel_id and channel_id != "random":
        for ch in LUCID_CHANNELS:
            if ch["id"] == channel_id:
                return dict(ch)
    ch = random.choice(LUCID_CHANNELS)
    out = dict(ch)
    thoughts = ch.get("thoughts") or []
    out["thought"] = random.choice(thoughts) if thoughts else "The lucid feed hums — stay with it."
    out["picked_at"] = time.time()
    return out


def catalog() -> list[dict[str, Any]]:
    return [
        {
            "id": ch["id"],
            "title": ch["title"],
            "subtitle": ch.get("subtitle", ""),
            "agent": ch.get("agent", ""),
            "emoji": ch.get("emoji", "📺"),
        }
        for ch in LUCID_CHANNELS
    ]