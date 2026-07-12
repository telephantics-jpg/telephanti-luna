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
    "{visitor} just walked into the meadow. Notice them and say hi in your own voice.",
    "{visitor} is here — give a real hello, not a stock greeter line.",
    "New footsteps by the fire: {visitor}. Welcome them like only you would.",
    "{visitor} showed up under the corona. Greet them; leave an easy door to talk.",
    "Camp gained a body: {visitor}. Open with something specific and warm.",
)

_RETURN_SEEDS = (
    "{visitor} is back. Treat them like a familiar friend — no memory receipts.",
    "Hey — {visitor} returned. Easy familiarity, zero CRM vibes.",
    "{visitor} circled back to camp. Warm nod energy; invent a fresh hello.",
)

_AMBIENT_SEEDS = (
    "Something small just caught your eye at camp (fire, pond, cookies, sky, music, props).",
    "Idle moment by the meadow — notice one real detail and talk about it.",
    "Camp is humming. Share one observation in your voice.",
    "A quiet beat between conversations. What are you actually noticing?",
)

_WAVE_BEATS = (
    "You're first to notice them.",
    "You're the second voice in the welcome — don't copy the first.",
    "Third take — be distinct from whoever already spoke.",
    "Soft follow-up energy.",
    "Closing note in the welcome wave.",
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
        f"{seed} ({beat})\n"
        f"Place: {ctx}.{near_bit}\n"
        f"Speak as yourself only — natural hello, a little character color, invite to talk."
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
            f"{reply_to_name} just riffed (meaning only): {idea}\n"
            f"Answer them naturally — funny, specific, your spin. Don't copy their wording.\n"
            f"Place: {ctx}.{near_bit}"
        )
    seed = random.choice(_AMBIENT_SEEDS)
    return (
        f"{seed}\n"
        f"{visitor} is around if that matters.\n"
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
