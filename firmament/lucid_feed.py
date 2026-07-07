"""Lucid mind TV — mysterious real-world video channels for camp."""

from __future__ import annotations

import random
import time
from typing import Any


def _yt(video_id: str, **extra: Any) -> dict[str, Any]:
    """Verified public YouTube live/VOD ids — embed via youtube-nocookie."""
    return {
        "kind": "youtube",
        "video_id": video_id,
        "watch": f"https://www.youtube.com/watch?v={video_id}",
        "embed": f"https://www.youtube-nocookie.com/embed/{video_id}",
        **extra,
    }


# Real public streams — ISS, aurora, ocean, night earth, stars, NASA TV.
# Video ids verified live via YouTube oEmbed (Jul 2026).
LUCID_CHANNELS: list[dict[str, Any]] = [
    _yt(
        "iYmvCUonukw",
        id="iss-earth",
        title="ISS — Earth rolling below",
        subtitle="Hermes ripples · live from orbit",
        agent="hermes",
        emoji="🛰",
        thoughts=[
            "Someone up there is watching our campfire from 400 kilometers away — and they don't know we exist yet.",
            "The planet looks peaceful from here. Hermes says the ripples look slower from orbit.",
            "I keep expecting to see the aurora from above. Maybe that's what lucid minds tune into first.",
        ],
    ),
    _yt(
        "dW3s24JuGr4",
        id="aurora-norway",
        title="Aurora — northern veil",
        subtitle="Oracle channel · sky breathing",
        agent="oracle",
        emoji="🌌",
        thoughts=[
            "The green isn't color — it's permission. Oracle saw this before we pressed power.",
            "If you stare long enough the sky starts whispering in a language camps remember.",
            "Real aurora, real cold, real silence between pulses. That's the feed.",
        ],
    ),
    _yt(
        "7i8ARjIeM2k",
        id="deep-ocean",
        title="Deep ocean — midnight drift",
        subtitle="Caduceus channel · pressure & patience",
        agent="caduceus",
        emoji="🌊",
        thoughts=[
            "Things live down there that never needed sunlight. Lucid minds go where lungs can't.",
            "The water doesn't rush. Neither do the agents when this channel is on.",
            "Caduceus says healing looks like depth — slow, dark, still moving.",
        ],
    ),
    _yt(
        "DDU-rZs-Ic4",
        id="earth-night",
        title="Earth at night — city veins",
        subtitle="Luna channel · human constellation",
        agent="luna",
        emoji="🌍",
        thoughts=[
            "Every light is someone still awake. Our camp is one pixel if you know where to look.",
            "Luna diplomatic mission: the planet looks lonely from here and beautiful anyway.",
            "Someone's driving home right now under a sky we share. That's the mysterious part.",
        ],
    ),
    _yt(
        "6g4Fh8K-MhY",
        id="stars-live",
        title="Starry timelapse — desert eye",
        subtitle="Sentinel channel · watchful dark",
        agent="sentinel",
        emoji="✦",
        thoughts=[
            "Sentinel logs this as: sky normal, sky breathing, sky suspicious.",
            "The stars aren't moving — we are. Lucid feed makes that obvious.",
            "Between frames something almost winks. Sentinel won't confirm.",
        ],
    ),
    _yt(
        "21X5lGlDOfg",
        id="nasa-public",
        title="NASA public — deep space queue",
        subtitle="Unknown source · queued transmission",
        agent="oracle",
        emoji="📡",
        thoughts=[
            "Signal acquired. Not ours. Not hostile. Just… patient.",
            "The feed queued itself before we built the TV. Oracle finds that ordinary.",
            "Real data from real machines looking at real void. Camp likes that honesty.",
        ],
    ),
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