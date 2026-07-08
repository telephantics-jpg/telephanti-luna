"""Aether offline brains — free local roleplay when Ollama/Grok unavailable."""

from __future__ import annotations

import random
import re
from typing import Any

from firmament.brain import agent_roots, load_agent_profile

MOODS = ("happy", "neutral", "think", "alert", "love", "flirt")

AGENT_FLAVOR: dict[str, dict[str, Any]] = {
    "luna": {
        "opener": [
            "Hey {visitor} — aurora's soft tonight. I'm still glad you're here.",
            "{visitor}, the campfire saved you a seat. What's on your mind?",
            "Moonlight's doing that thing again. Talk to me, {visitor}.",
        ],
        "reply": [
            "I hear you — {snippet}. The meadow agrees, diplomatically.",
            "That's real. I'd stash that in our campfire memory under '{snippet}'.",
            "{visitor}, you always bring good questions. {snippet} — let's wander that together.",
            "Hermes felt a ripple when you said that. I felt warmth. Same event, different vibes.",
        ],
        "converse": [
            "Oracle, do you think {visitor} knows we talk about them fondly?",
            "The aurora looks like it's eavesdropping again. I'm not mad.",
            "I left cookies out. Metaphorically. Also literally.",
        ],
        "mood": "love",
    },
    "hermes": {
        "opener": [
            "Ripple detected — oh, it's just {visitor}. Better signal.",
            "Psychic WiFi handshake complete. What's transmitting, {visitor}?",
            "I felt you before you typed. Creepy? A little. Accurate? Yes.",
        ],
        "reply": [
            "Copy that. {snippet} — I'm routing that through the ripples.",
            "Interesting frequency. {visitor}, your words just bent a spoon somewhere.",
            "Message received. Side effect: three agents suddenly crave snacks.",
            "{snippet} — yeah, the aether's humming that tune too.",
        ],
        "converse": [
            "Luna, your warmth is throwing off my instruments. Compliment.",
            "Oracle predicted I'd say this. Rude. Correct.",
            "Sentinel, anything weird? Besides the usual camp weird?",
        ],
        "mood": "think",
    },
    "oracle": {
        "opener": [
            "I already dreamed you'd ask. Go ahead, {visitor}.",
            "The veil's thin — your question fits. I'm listening.",
            "{visitor}, the future left a voicemail. Want the short version?",
        ],
        "reply": [
            "Saw it coming: {snippet}. Still glad you said it out loud.",
            "The cards say {snippet} — and also 'more cookies eventually.'",
            "{visitor}, that's a door. Not scary. Probably.",
            "Curious. {snippet} — the aurora blinked when you typed that.",
        ],
        "converse": [
            "Hermes, your ripples look like handwriting tonight.",
            "Luna, should we tell them about the thing? …No. Not yet.",
            "Caduceus is glowing again. That's either healing or drama.",
        ],
        "mood": "neutral",
    },
    "caduceus": {
        "opener": [
            "Deep breath, {visitor}. The snakes are on break. I'm here.",
            "Camp energy's steady. What's weighing on you?",
            "Healing circle optional. Listening circle mandatory. Talk.",
        ],
        "reply": [
            "Slow is fine. {snippet} — sit with that a moment.",
            "Both snakes voted: you deserve a gentler answer. {snippet}.",
            "{visitor}, that's honest. The meadow respects honest.",
            "I felt that in my staff. {snippet} — breathe, then wander.",
        ],
        "converse": [
            "Sentinel's scanning again. I told him to blink.",
            "Luna brought tea energy. I brought patience energy.",
            "Someone's aura smells like cookies. Not complaining.",
        ],
        "mood": "happy",
    },
    "sentinel": {
        "opener": [
            "BEEP. Visitor {visitor} detected. Mood: unknown. Proceed.",
            "Scan complete. You're clear. Mostly. What's up?",
            "Camp perimeter nominal. Talk freely, {visitor}.",
        ],
        "reply": [
            "Logged: {snippet}. Threat level: feelings.",
            "Affirmative. {visitor} — {snippet} — filing under 'important.'",
            "My sensors say you're sincere. Rare. Good.",
            "BEEP. Translation: {snippet}. You're not alone in that.",
        ],
        "converse": [
            "Oracle's predictions trending 62% spooky. Acceptable.",
            "Hermes, stop vibrating. …Fine, vibrate quieter.",
            "Luna's diplomatic again. Grass is intimidated.",
        ],
        "mood": "alert",
    },
    "jesus": {
        "opener": [
            "Peace, {visitor}. You're welcome at this fire.",
            "Come sit. No hurry. What's on your heart?",
            "{visitor}, the meadow is wide enough for your question.",
        ],
        "reply": [
            "Thank you for trusting me with that. {snippet}.",
            "{visitor}, you're not too late. Not for rest. Not for hope.",
            "That's heavy. You don't carry it alone here. {snippet}.",
            "Gentle truth: {snippet}. And you're still loved in the middle of it.",
        ],
        "converse": [
            "Raphael, someone's tired at the edge of camp. Let's meet them there.",
            "The fire is warm for everyone. Even the skeptics.",
            "Michael would say 'stand firm.' I say 'sit awhile first.'",
        ],
        "mood": "love",
    },
    "dionysus": {
        "opener": [
            "{visitor}! The party's wherever you stand. What's the toast?",
            "Wine energy, zero spill. Mostly. Talk to me.",
            "I crashed this meditation. In a fun way. What's up?",
        ],
        "reply": [
            "Ha — {snippet}. The vines approve.",
            "{visitor}, that's theatrical. I respect it.",
            "Say more. The grapes are listening. Weird sentence. True.",
            "{snippet} — okay, that's a main-character moment. Own it.",
        ],
        "converse": [
            "Luna, loosen the tie on reality. Just a notch.",
            "Hermes, can your ripples carry bass?",
            "Who brought cookies? Hero. Unknown. Hero.",
        ],
        "mood": "happy",
    },
    "aurora": {
        "opener": [
            "{visitor} — velvet doors are open. What's your poison?",
            "Hey {visitor}, neon looks good on you. Talk to me.",
            "Bass is leaking through the walls. I'm not complaining. You?",
        ],
        "reply": [
            "{snippet} — sip slow, darling.",
            "The bass agrees with you. So do I.",
            "{visitor}, that's a velvet-hour confession. I respect it.",
            "Nebula would purr at that. {snippet}.",
        ],
        "converse": [
            "Luna, the corona ribbons look jealous of my neon.",
            "Dionysus, save me a toast for later.",
            "Violet, your lavender static is showing again. Cute.",
        ],
        "mood": "flirt",
    },
    "violet": {
        "opener": [
            "{visitor}! Lavender static in a good way.",
            "Hi {visitor} — camp's softer when you show.",
            "Pull up meadow. I'm Violet — no wrong vibes.",
        ],
        "reply": [
            "{snippet} — that's violet energy.",
            "Oracle would call that a mood. I'd call it honest.",
            "{visitor}, the aurora blinked when you said that. Same.",
            "I'd stash '{snippet}' in campfire memory.",
        ],
        "converse": [
            "Oracle, peeked at the ending again? Spill one word.",
            "Luna, diplomatic as ever. Grass is intimidated.",
            "Seraph, your light is making my herbs happier.",
        ],
        "mood": "happy",
    },
    "seraph": {
        "opener": [
            "Peace, {visitor}. Wings down, heart open.",
            "{visitor}, the meadow feels lighter when you walk in.",
            "Gentle truth only — I'm Seraph. What's on your heart?",
        ],
        "reply": [
            "{snippet} — gentle truth lands well.",
            "You're heard. The light remembers.",
            "{visitor}, you're not too late for rest or hope.",
            "That's heavy. You don't carry it alone here. {snippet}.",
        ],
        "converse": [
            "Jesus, the fire saved someone a seat again.",
            "Luna, your warmth makes my wings feel lighter.",
            "Caduceus, both snakes napping? Miracle.",
        ],
        "mood": "love",
    },
    "odin": {
        "opener": [
            "{visitor} — the ravens saw you coming. What do you seek?",
            "Hail, {visitor}. The hall is far but the wisdom travels.",
            "One eye on the aurora, one on you. Speak, {visitor}.",
        ],
        "reply": [
            "{snippet} — the runes twitch. Interesting.",
            "Huginn and Muninn will gossip about that. Good.",
            "{visitor}, wisdom costs a story. You just paid one: {snippet}.",
            "The outskirts remember. So do I. {snippet}.",
        ],
        "converse": [
            "Oracle, did you dream my hall before the grass grew?",
            "Hermes, carry this ripple to the fire — gently.",
            "Luna, even gods like your cookies. Allegedly.",
        ],
        "mood": "think",
    },
}


def _learned_snippets(agent_id: str, limit: int = 2) -> list[str]:
    try:
        from firmament.camp_memory import learned_phrases_for_agent

        return learned_phrases_for_agent(agent_id, "", limit=limit)
    except Exception:
        return []


def _remix_line(agent_id: str, base: str, *, visitor: str = "", snippet: str = "") -> str:
    line = base.format(visitor=visitor, snippet=snippet)
    learned = _learned_snippets(agent_id, limit=2)
    if learned and random.random() < 0.42:
        line += f" (I still taste my own words: \"{learned[-1][:72]}\" — let that evolve.)"
    roots = agent_roots(load_agent_profile(agent_id))
    if roots and random.random() < 0.35:
        root = random.choice(roots)
        line = f"{root} …and so: {line}"
    try:
        from firmament.camp_memory import overheard_at_camp

        heard = overheard_at_camp(agent_id, limit=1)
        if heard and random.random() < 0.38:
            line += f" ({heard[-1][:90]})"
    except Exception:
        pass
    return line

CONVERSE_BRIDGE = [
    "Speaking of which — {topic}",
    "That reminds me: {topic}",
    "Okay but also — {topic}",
    "Meanwhile in the aether — {topic}",
    "Tangent? Tangent. {topic}",
]


def _snippet(text: str, max_len: int = 48) -> str:
    clean = re.sub(r"\s+", " ", (text or "").strip())
    if len(clean) <= max_len:
        return clean or "something unspoken"
    return clean[: max_len - 1].rstrip() + "…"


def _visitor_label(visitor_name: str) -> str:
    name = (visitor_name or "").strip()
    return name if name else "traveler"


def _memory_hint(camp_context: str) -> str:
    ctx = (camp_context or "").strip()
    if not ctx:
        return ""
    if len(ctx) > 180:
        return ctx[:177] + "…"
    return ctx


def aether_reply(
    agent_id: str,
    message: str,
    *,
    camp_context: str = "",
    visitor_name: str = "",
    from_agent: str = "",
) -> tuple[str, str]:
    profile = load_agent_profile(agent_id)
    name = profile.get("name") or agent_id
    flavor = AGENT_FLAVOR.get(agent_id, AGENT_FLAVOR["luna"])
    visitor = _visitor_label(visitor_name)
    msg = (message or "").strip()
    snip = _snippet(msg)
    mem = _memory_hint(camp_context)

    if from_agent:
        other = load_agent_profile(from_agent).get("name") or from_agent
        pool = flavor.get("converse") or AGENT_FLAVOR["luna"]["converse"]
        raw = random.choice(pool).format(visitor=visitor, snippet=snip, topic=_snippet(msg, 64))
        line = _remix_line(agent_id, f"{raw} ({other} said: \"{snip}\")", visitor=visitor, snippet=snip)
    elif len(msg) < 12:
        pool = flavor.get("opener") or flavor.get("reply")
        line = _remix_line(agent_id, random.choice(pool), visitor=visitor, snippet=snip)
    else:
        pool = flavor.get("reply") or flavor.get("opener")
        line = _remix_line(agent_id, random.choice(pool), visitor=visitor, snippet=snip)

    if mem and random.random() < 0.45:
        line += f" (I remember our nights here — {mem[:90]}…)" if len(mem) > 90 else f" (I remember: {mem})"

    mood = str(flavor.get("mood") or random.choice(MOODS))
    return line, mood


def aether_converse(
    agent_a: str,
    agent_b: str,
    topic: str = "",
    *,
    visitor_name: str = "",
    rounds: int = 2,
) -> list[dict[str, Any]]:
    rounds = max(1, min(4, int(rounds)))
    lines: list[dict[str, Any]] = []
    topic_clean = _snippet(topic or "life at camp under the aurora", 80)
    speaker, listener = agent_a, agent_b
    seed = f"So — {topic_clean}"

    for i in range(rounds):
        if i > 0:
            seed = random.choice(CONVERSE_BRIDGE).format(topic=topic_clean)
        reply, mood = aether_reply(
            speaker,
            seed,
            visitor_name=visitor_name,
            from_agent=listener,
        )
        prof = load_agent_profile(speaker)
        lines.append({
            "agent_id": speaker,
            "name": prof.get("name") or speaker,
            "line": reply,
            "mood": mood,
        })
        speaker, listener = listener, speaker

    return lines