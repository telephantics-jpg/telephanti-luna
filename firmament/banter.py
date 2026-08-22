"""Camp banter — dynamic openers / ambient lines via free minds.

This is the server-side mechanism for greets & idle banter.
Client should call POST /api/firmament/banter (or agent/chat with these prompts).
Static HTML line pools are FALLBACK only.

Prompts are pure scene moments — never director notes the model can recite.
"""

from __future__ import annotations

import random
import re
from typing import Any


# Pure sensory / social moments — NO "use it / react / structure" director speak
_OPEN_SEEDS = (
    "{visitor} just walked into the meadow. Embers jump. A mug clinks somewhere.",
    "{visitor} sits by the fire. Pine smoke, soft aurora, a half-eaten cookie on a napkin.",
    "New footsteps: {visitor}. Corona light on wet grass. Someone laughs two tents over.",
    "{visitor} shows up under the corona. Warm wood smell. A guitar case leans on a stump.",
    "Camp gains {visitor}. The fire leans toward them like it recognizes company.",
    "{visitor} arrives. Dew on the log bench. Somewhere a kettle ticks.",
)

_RETURN_SEEDS = (
    "{visitor} is back. Same fire, different sky. A seat still warm from earlier.",
    "{visitor} returns to the meadow. The cookies look rearranged. Suspicious.",
    "{visitor} circles back. Aurora did a new color trick while they were gone.",
    "{visitor} reappears. The pond mirror holds their outline for a second.",
)

_AMBIENT_SEEDS = (
    "A pinecone rolls into the coals. Sparks stitch a tiny constellation.",
    "Quiet meadow beat — pond glass, distant guitar, one stubborn cricket.",
    "Camp hums. Cookie tin lid half-open. Someone left a joke unfinished.",
    "Between conversations: steam from a mug, corona flicker, soft boot-scuff.",
    "Half a laugh drifts from the other side of the fire. Then the hush again.",
    "Fire pops. One bright coal settles. The meadow holds its breath.",
    "Nebula the cat stares at nothing in particular. Extremely judgmental nothing.",
    "A shooting star tries too hard. The corona shrugs like 'yeah, we do that here.'",
    "The kettle ticks three times. Superstitious people count. The rest sip.",
    "Dew draws a map on the log bench nobody asked to follow.",
    "Jukebox static between songs. Camp pretends that's a drum fill.",
    "A moth pays rent around the lantern. Extremely professional moth.",
    "The pond holds a second moon. The first one is not jealous. Much.",
    "Warm mug, cold fingers. The math checks out and still feels like a trick.",
    "Stars sneak past the aurora like they're late for a better party.",
    "Someone's guitar case is still zipped. The meadow notices. Doesn't push.",
)

_WAVE_BEATS = (
    "first to notice",
    "second welcome voice",
    "third welcome voice",
    "soft follow-up",
    "closing welcome note",
)

# Phrases that mean the model recited scaffolding — force aether fallback
_SEED_ECHO_MARKERS = (
    "sensory first",
    "natural chat structure",
    "add your spin",
    "second breath",
    "welcome wave:",
    "place:",
    "logged with care",
    "use it.",
    "react, then",
    "mid-conversation energy",
    "no formal welcome",
    "organic speech",
    "leave room for them",
    "callback energy",
    "brand-new intro",
    "tour card",
    "fill it with personality",
    "not filler",
    "paused by the fire",
    "half-finished thought",
    "you just used",
    "share what you were chewing",
    "honest multi-sentence",
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
    """Scene seed for greets — sensory only."""
    visitor = (visitor_name or "traveler").strip() or "traveler"
    ctx = (context or "aurora meadow camp").strip()
    pool = _RETURN_SEEDS if returning else _OPEN_SEEDS
    seed = random.choice(pool).format(visitor=visitor)
    near_bit = f" Nearby: {near}." if near else ""
    # Tiny spice token so models don't cache one opener
    spice = random.choice(("soft wind", "warm ash", "quiet laugh", "cool dew", "bright ember"))
    return (
        f"{seed}\n"
        f"Setting: {ctx}.{near_bit} Detail: {spice}."
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
    """Scene seed for idle / reply banter — sensory only."""
    visitor = (visitor_name or "a visitor").strip() or "a visitor"
    ctx = (context or "camp is humming").strip()
    near_bit = f" Nearby: {near}." if near else ""
    if reply_to_name and reply_to_idea:
        idea = " ".join(reply_to_idea.split())[:100]
        return (
            f'{reply_to_name} just said: "{idea}"\n'
            f"{visitor} is listening.\n"
            f"Setting: {ctx}.{near_bit}"
        )
    seed = random.choice(_AMBIENT_SEEDS)
    spice = random.choice(("left", "right", "behind you", "across the fire", "overhead"))
    return (
        f"{seed}\n"
        f"{visitor} is around ({spice}).\n"
        f"Setting: {ctx}.{near_bit}"
    )


def _looks_like_seed_echo(reply: str, seed: str = "") -> bool:
    t = (reply or "").strip().lower()
    if not t or len(t) < 12:
        return True
    for m in _SEED_ECHO_MARKERS:
        if m in t:
            return True
    # Heavy overlap with the seed itself
    if seed:
        seed_l = seed.lower()
        # Take a distinctive 6+ word chunk from seed
        words = [w for w in re.findall(r"[a-z0-9']+", seed_l) if len(w) > 3]
        if len(words) >= 6:
            chunk = " ".join(words[2:8])
            if chunk and chunk in t:
                return True
    return False


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
    from firmament.brain import agent_chat, _looks_like_prompt_echo, _strip_meta_dialogue_leak
    from firmament.aether_offline import aether_reply

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

    # Frame as situation — spoken reply only (hard to recite as script)
    user_turn = (
        f"Live moment at camp:\n{message}\n\n"
        f"Speak only as yourself out loud. Fresh words. Do not narrate instructions."
    )

    result = await agent_chat(
        agent_id,
        user_turn,
        pack_name=pack_name,
        visitor_id=visitor_id,
        visitor_name=visitor_name,
        ambient=True,
        skip_memory=True,
        converse_mode=False,
    )
    reply = _strip_meta_dialogue_leak((result.get("reply") or "").strip())
    if (
        not reply
        or _looks_like_prompt_echo(reply)
        or _looks_like_seed_echo(reply, message)
    ):
        # Free offline witty line — still dynamic (random pools), never silent / never seed-echo
        visitor = (visitor_name or "friend").strip() or "friend"
        line, mood = aether_reply(
            agent_id,
            message,
            visitor_name=visitor,
            camp_context=context or "",
        )
        result["reply"] = line
        result["mood"] = mood or result.get("mood") or "happy"
        result["backend"] = "aether"
        result["fallback"] = "seed_echo"
    else:
        result["reply"] = reply

    result["kind"] = kind
    result["banter"] = True
    return result
