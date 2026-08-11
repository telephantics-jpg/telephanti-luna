"""Camp banter — dynamic openers / ambient lines via free minds.

This is the server-side mechanism for greets & idle banter.
Client should call POST /api/firmament/banter (or agent/chat with these prompts).
Static HTML line pools are FALLBACK only.

Prompts are pure scene seeds — never instruction dumps the model can recite.
"""

from __future__ import annotations

import random
from typing import Any


_OPEN_SEEDS = (
    "{visitor} just walked into the meadow — mid-conversation energy, no formal welcome speech.",
    "{visitor} is here by the fire. React natural: notice them, then say something true and light.",
    "New footsteps: {visitor}. Start mid-thought if it fits; land a warm hook.",
    "{visitor} showed up under the corona. Two-beat welcome: short reaction, then a real question or joke.",
    "Camp just gained {visitor}. Sound like a friend who already sat down, not a tour guide.",
    "{visitor} arrived. Organic speech — contractions, one vivid detail, leave room for them.",
)

_RETURN_SEEDS = (
    "{visitor} is back at camp — callback energy, not a brand-new intro.",
    "{visitor} returned to the meadow. Notice what's different, then welcome soft.",
    "{visitor} circled back to the fire. Mid-thread vibe: 'you again' with affection.",
    "{visitor} reappeared. Natural paragraph: react, then one true thing about the gap.",
)

_AMBIENT_SEEDS = (
    "Something small just caught your eye (fire, pond, cookies, sky, music, props). One organic beat.",
    "Quiet beat at the meadow — one real detail stands out. Speak like you might keep talking later.",
    "Camp is humming. Riff mid-thought; don't open like a new scene title card.",
    "A pause between conversations. Fill it with personality, not filler.",
    "Someone nearby said something half-heard. React, then add your spin in a second breath.",
    "The fire pops. Use it. Sensory first, meaning second — natural chat structure.",
)

_WAVE_BEATS = (
    "first to notice",
    "second welcome voice",
    "third welcome voice",
    "soft follow-up",
    "closing welcome note",
)


def opener_prompt(
    agent_id: str,
    *,
    visitor_name: str = "",
    returning: bool = False,
    context: str = "",
    near: str = "",
    wave_index: int = 0,
) -> str:
    """Scene seed for greets — no ALL-CAPS instruction labels."""
    visitor = (visitor_name or "traveler").strip() or "traveler"
    ctx = (context or "aurora meadow camp").strip()
    pool = _RETURN_SEEDS if returning else _OPEN_SEEDS
    seed = random.choice(pool).format(visitor=visitor)
    beat = _WAVE_BEATS[min(max(0, wave_index), len(_WAVE_BEATS) - 1)]
    near_bit = f" Nearby: {near}." if near else ""
    # Pure scene text — identity lives in system prompt
    return (
        f"{seed}\n"
        f"Place: {ctx}.{near_bit}\n"
        f"Welcome wave: {beat}."
    )


def ambient_prompt(
    agent_id: str,
    *,
    visitor_name: str = "",
    context: str = "",
    near: str = "",
    reply_to_name: str = "",
    reply_to_idea: str = "",
) -> str:
    """Scene seed for idle / reply banter — no meta scaffolding."""
    visitor = (visitor_name or "a visitor").strip() or "a visitor"
    ctx = (context or "camp is humming").strip()
    near_bit = f" Nearby: {near}." if near else ""
    if reply_to_name and reply_to_idea:
        idea = " ".join(reply_to_idea.split())[:100]
        return (
            f"{reply_to_name} said: {idea}\n"
            f"Place: {ctx}.{near_bit}"
        )
    seed = random.choice(_AMBIENT_SEEDS)
    return (
        f"{seed}\n"
        f"{visitor} is around.\n"
        f"Place: {ctx}.{near_bit}"
    )


async def speak_banter(
    agent_id: str,
    *,
    kind: str = "opener",
    visitor_name: str = "",
    visitor_id: str = "",
    returning: bool = False,
    context: str = "",
    near: str = "",
    wave_index: int = 0,
    reply_to_name: str = "",
    reply_to_idea: str = "",
    pack_name: str = "",
) -> dict[str, Any]:
    """Generate a live banter line through the free-mind chain."""
    from firmament.brain import agent_chat

    kind = (kind or "opener").strip().lower()
    if kind in ("opener", "arrive", "greeting", "welcome"):
        message = opener_prompt(
            agent_id,
            visitor_name=visitor_name,
            returning=returning,
            context=context,
            near=near,
            wave_index=wave_index,
        )
    else:
        message = ambient_prompt(
            agent_id,
            visitor_name=visitor_name,
            context=context,
            near=near,
            reply_to_name=reply_to_name,
            reply_to_idea=reply_to_idea,
        )

    result = await agent_chat(
        agent_id,
        message,
        pack_name=pack_name,
        visitor_id=visitor_id,
        visitor_name=visitor_name,
        ambient=True,
        skip_memory=True,
        converse_mode=False,
    )
    result["kind"] = kind
    result["banter"] = True
    return result
