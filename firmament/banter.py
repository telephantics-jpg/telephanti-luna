"""Camp banter — dynamic openers / ambient lines via free minds.

This is the server-side mechanism for greets & idle banter.
Client should call POST /api/firmament/banter (or agent/chat with these prompts).
Static HTML line pools are FALLBACK only.
"""

from __future__ import annotations

from typing import Any


def opener_prompt(
    agent_id: str,
    *,
    visitor_name: str = "",
    returning: bool = False,
    context: str = "",
    near: str = "",
    wave_index: int = 0,
) -> str:
    who = (agent_id or "luna").strip().lower()
    visitor = (visitor_name or "traveler").strip() or "traveler"
    ctx = (context or "aurora meadow camp").strip()
    ret = (
        f"{visitor} is back (familiar friend energy — no memory receipts)."
        if returning
        else f"{visitor} just showed up. First impression counts."
    )
    beats = [
        "first to notice them",
        "second voice in the welcome",
        "third take — don't echo the others",
        "soft follow-up",
        "closing note in the wave",
    ]
    beat = beats[min(max(0, wave_index), len(beats) - 1)]
    near_bit = f" Nearby: {near}." if near else ""
    return (
        f"(DYNAMIC OPENING — invent fresh, never stock.)\n"
        f"You are {who} at Luna Camp. {ret}\n"
        f"Welcome wave role: {beat}.\n"
        f"Greet in YOUR voice in one to two full paragraphs (~90–140 words): a real hello, "
        f"character color, and a natural invite to talk. "
        f"Funny, original, specific. Context: {ctx}.{near_bit}\n"
        f"Never say last-time-you-said / I-remember-when. No *stage directions*. No AI talk."
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
    who = (agent_id or "luna").strip().lower()
    visitor = (visitor_name or "a visitor").strip() or "a visitor"
    ctx = (context or "camp is humming").strip()
    near_bit = f" Nearby: {near}." if near else ""
    if reply_to_name and reply_to_idea:
        idea = " ".join(reply_to_idea.split())[:100]
        return (
            f"{reply_to_name} just riffed (idea only): {idea}. "
            f"Reply TO them as {who} in one to two full paragraphs (~100–150 words) — "
            f"funny, original, logical. Don't copy wording. Camp: {ctx}.{near_bit}"
        )
    return (
        f"You are {who} at camp. Notice one real thing (fire, music, pond, {visitor}, props) "
        f"and riff in one to two full paragraphs (~100–160 words) — funny, specific, YOUR voice. "
        f"Camp: {ctx}.{near_bit}"
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
