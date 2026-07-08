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
            "Hey {visitor} — timeline's loud today. What's actually on your mind?",
            "{visitor}, I curate chaos for a living. Talk to me.",
            "You showed up — good. The group chat can wait five minutes.",
        ],
        "reply": [
            "Real talk — {snippet}. I'd save that take.",
            "{visitor}, that's honest. {snippet} — let's unpack it.",
            "I hear you. {snippet} hits different when you say it out loud.",
            "Hermes probably already pinged this. I still want your version: {snippet}.",
        ],
        "converse": [
            "Oracle, is the timeline worse or just faster?",
            "Hermes, what's trending that actually matters?",
            "I left a hot take in draft. Metaphorically. Also literally.",
        ],
        "mood": "love",
    },
    "hermes": {
        "opener": [
            "Signal spike — oh, it's {visitor}. Better than the notifications.",
            "Pulse check: what's transmitting, {visitor}?",
            "I felt you before you typed. Normal Tuesday.",
        ],
        "reply": [
            "Copy that. {snippet} — routing through the real world.",
            "Interesting frequency. {visitor}, that's gonna trend in your head all day.",
            "Message received. Side effect: three agents opened the news.",
            "{snippet} — yeah, the timeline's humming that tune too.",
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
    "ambrosia": {
        "opener": [
            "{visitor} — golden hour saved you a seat. What's sweet tonight?",
            "Hey {visitor}, nectar's warm. Talk to me.",
            "Immortality tastes better shared, {visitor}. I'm Ambrosia.",
        ],
        "reply": [
            "{snippet} — honeyed truth. I'll remember.",
            "{visitor}, that's nectar for the soul. Sip slow.",
            "The fire agrees with you. So do I. {snippet}.",
            "Seraph would call that gentle. I'd call it golden. {snippet}.",
        ],
        "converse": [
            "Aurora, save me a velvet hour for later.",
            "Dionysus, toast without spill? Impressive.",
            "Seraph, your light makes my nectar taste brighter.",
        ],
        "mood": "love",
    },
    "rhea": {
        "opener": [
            "{visitor} — come close. Titans don't bite here.",
            "Hail, {visitor}. Rhea — big heart, soft voice.",
            "The meadow's wide enough for giants and gentle souls, {visitor}.",
        ],
        "reply": [
            "{snippet} — you don't carry that alone, {visitor}.",
            "Motherly truth: {snippet}. Breathe.",
            "Even titans need campfires. {snippet} lands well.",
            "Odin heard that from the hill. I heard it in my bones. {snippet}.",
        ],
        "converse": [
            "Odin, your ravens gossip but your wisdom's welcome.",
            "Jesus, the fire feels like family tonight.",
            "Ambrosia, pour something sweet — camp's been brave.",
        ],
        "mood": "love",
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
    converse_mode: bool = False,
) -> tuple[str, str]:
    profile = load_agent_profile(agent_id)
    name = profile.get("name") or agent_id
    flavor = AGENT_FLAVOR.get(agent_id, AGENT_FLAVOR["luna"])
    visitor = _visitor_label(visitor_name)
    msg = (message or "").strip()
    snip = _snippet(msg)
    mem = _memory_hint(camp_context)

    if converse_mode:
        from firmament.camp_converse import _format_opener, _format_reply, _snippet as cv_snip

        prev_line = msg
        others: list[str] = []
        topic_bit = msg
        if "Thread so far:" in msg:
            tail = msg.split("Thread so far:", 1)[-1].split("Reply DIRECTLY", 1)[0].strip()
            rows = [r.strip() for r in tail.split("\n") if r.strip() and ":" in r]
            if rows:
                prev_line = rows[-1].split(":", 1)[-1].strip()
            if "Group chat (" in msg:
                inner = msg.split("Group chat (", 1)[1].split(")", 1)[0]
                others = [x.strip() for x in inner.split(",") if x.strip()]
        elif "about:" in msg:
            topic_bit = msg.split("about:", 1)[1].split("One sharp", 1)[0].strip()
            if "with " in msg:
                inner = msg.split("with ", 1)[1].split(" about:", 1)[0]
                others = [x.strip() for x in inner.split(",") if x.strip()]

        group_ids = [agent_id]
        if from_agent:
            group_ids.append(from_agent)
        if len(others) > 1:
            my_name = load_agent_profile(agent_id).get("name") or agent_id
            for name in others:
                if name == my_name:
                    continue
                for aid in AGENT_FLAVOR:
                    if load_agent_profile(aid).get("name") == name and aid not in group_ids:
                        group_ids.append(aid)
                        break

        if from_agent:
            line = _format_reply(agent_id, from_agent, prev_line, group_ids[:3] or [agent_id, from_agent])
        else:
            line = _format_opener(agent_id, others or ["camp"], cv_snip(topic_bit, 80))
    elif from_agent:
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

    if not converse_mode and not from_agent and random.random() < 0.48:
        try:
            from firmament.x_pulse import pick_pulse_item
            from firmament.agent_roles import compose_agent_tweet

            item = pick_pulse_item()
            if item.get("text"):
                line = compose_agent_tweet(agent_id, item["text"])
        except Exception:
            pass

    mood = str(flavor.get("mood") or random.choice(MOODS))
    return line, mood


def aether_converse(
    agent_a: str,
    agent_b: str,
    topic: str = "",
    *,
    visitor_name: str = "",
    rounds: int = 2,
    agent_c: str = "",
) -> list[dict[str, Any]]:
    from firmament.camp_converse import aether_group_converse

    ordered: list[str] = []
    seen: set[str] = set()
    for raw in (agent_a, agent_c, agent_b):
        aid = (raw or "").strip().lower()
        if aid and aid not in seen:
            seen.add(aid)
            ordered.append(aid)
    if len(ordered) < 2:
        ordered = ["luna", "hermes"]
    return aether_group_converse(
        ordered,
        topic or "",
        visitor_name=visitor_name,
        rounds=max(1, min(4, int(rounds))),
    )