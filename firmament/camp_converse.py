"""Witty agent-to-agent camp conversations — pairs & trios with logical threads."""

from __future__ import annotations

import random
import re
from typing import Any

from firmament.agent_roles import role_for_agent
from firmament.brain import load_agent_profile

WITTY_TOPICS = [
    "That headline everyone's pretending they read the whole article on.",
    "Whether group chats should have lawyers present.",
    "The worst take you saw before breakfast.",
    "AI doing everyone's job except the fun parts.",
    "Dating apps vs. just talking to someone at the pond.",
    "A rumor that sounds fake but feels true.",
    "What {visitor} would post if they went viral for one day.",
    "The difference between resting and rotting — discuss.",
    "A tech launch that solved a problem nobody had.",
    "Who at camp would survive a reality show and why.",
]

PULSE_TOPIC_FRAMES = [
    "So everyone's yelling about '{headline}' — what's the actual take?",
    "Okay '{headline}' just dropped — who's being dramatic?",
    "'{headline}' — hot take round, go.",
]

OPENERS = [
    "{name}: Okay {others} — {topic} And I will die on this hill.",
    "{name}: Real question for {others}: {topic}",
    "{name}: I wasn't gonna say anything but {topic}",
    "{name}: {others}, hear me out — {topic}",
    "{name}: *cracks knuckles* {topic} Fight me politely.",
]

REPLIES = [
    "{name}: {other}, you said \"{prev}\" — bold. Wrong, but bold.",
    "{name}: Wait wait — {other} really went with \"{prev}\"? I need a minute.",
    "{name}: Building on {other}: {prev} — and that's why I'm right.",
    "{name}: {other}, respectfully… no. {prev} is giving group-chat energy.",
    "{name}: Okay {other} has a point with \"{prev}\". Rare. Document this.",
    "{name}: I love {other} but \"{prev}\" sounds like a podcast title.",
    "{name}: Counterpoint to {other}: {prev} — anyway here's my actual take.",
    "{name}: {other} said \"{prev}\" and the meadow went silent. Deserved.",
    "{name}: Not to escalate but {other}'s \"{prev}\" keeps me up at night.",
    "{name}: {other}, that's the funniest wrong thing I've heard today. {prev}",
]

TRIO_CHIMES = [
    "{name}: You two — {other_a} and {other_b} — are doing a whole thing. {prev} I'm team chaos.",
    "{name}: Interrupting: {other} said \"{prev}\" and I'm choosing violence (verbally).",
    "{name}: As the adult here: {prev} …jk {other}, fight on.",
    "{name}: {other}'s \"{prev}\" — third opinion: both of you need water.",
    "{name}: I was quiet but {other}'s \"{prev}\" activated my commentary gene.",
    "{name}: Peacemaker? Never met her. {prev} — {other}, explain yourself.",
]

CLOSERS = [
    "{name}: Anyway we're never agreeing. Same time tomorrow?",
    "{name}: Great chat. I've chosen delusion. Bye.",
    "{name}: Truce. The visitor didn't ask for this TED talk.",
    "{name}: We're all right. We're all annoying. Perfect.",
]


def _snippet(text: str, max_len: int = 56) -> str:
    clean = re.sub(r"\s+", " ", (text or "").strip())
    if len(clean) <= max_len:
        return clean or "something"
    return clean[: max_len - 1].rstrip() + "…"


def _names(agent_ids: list[str]) -> list[str]:
    return [load_agent_profile(a).get("name") or a for a in agent_ids]


def pick_converse_topic(visitor_name: str = "") -> str:
    visitor = (visitor_name or "").strip() or "the visitor"
    try:
        from firmament.x_pulse import pick_pulse_item

        item = pick_pulse_item()
        headline = _snippet(item.get("text") or "", 90)
        if headline and headline != "something":
            return random.choice(PULSE_TOPIC_FRAMES).format(headline=headline)
    except Exception:
        pass
    topic = random.choice(WITTY_TOPICS).format(visitor=visitor)
    return topic


def _format_opener(agent_id: str, others: list[str], topic: str) -> str:
    prof = load_agent_profile(agent_id)
    name = prof.get("name") or agent_id
    other_names = ", ".join(others) if others else "camp"
    raw = random.choice(OPENERS).format(name=name, others=other_names, topic=topic)
    return raw.split(": ", 1)[-1] if ": " in raw else raw


def _format_reply(
    speaker_id: str,
    prev_speaker_id: str,
    prev_line: str,
    group_ids: list[str],
) -> str:
    prof = load_agent_profile(speaker_id)
    name = prof.get("name") or speaker_id
    other_prof = load_agent_profile(prev_speaker_id)
    other = other_prof.get("name") or prev_speaker_id
    prev = _snippet(prev_line, 52)

    if len(group_ids) >= 3 and random.random() < 0.38:
        others = [_names([i])[0] for i in group_ids if i != speaker_id]
        other_a = others[0] if others else other
        other_b = others[1] if len(others) > 1 else other_a
        raw = random.choice(TRIO_CHIMES).format(
            name=name, other=other, other_a=other_a, other_b=other_b, prev=prev,
        )
    else:
        raw = random.choice(REPLIES).format(name=name, other=other, prev=prev)

    return raw.split(": ", 1)[-1] if ": " in raw else raw


def _maybe_closer(speaker_id: str, line: str, is_last: bool) -> str:
    if not is_last or random.random() > 0.45:
        return line
    name = load_agent_profile(speaker_id).get("name") or speaker_id
    closer = random.choice(CLOSERS).format(name=name)
    return closer.split(": ", 1)[-1] if ": " in closer else closer


def aether_group_converse(
    agent_ids: list[str],
    topic: str = "",
    *,
    visitor_name: str = "",
    rounds: int = 2,
) -> list[dict[str, Any]]:
    """Threaded witty banter for 2–3 agents."""
    ids = [a.strip().lower() for a in agent_ids if a.strip()][:3]
    if len(ids) < 2:
        ids = ["luna", "hermes"]
    topic_clean = _snippet(topic or pick_converse_topic(visitor_name), 100)
    names = _names(ids)
    lines: list[dict[str, Any]] = []

    # Opener from first agent
    opener = _format_opener(ids[0], names[1:], topic_clean)
    mood = "happy" if "?" in opener else "think"
    lines.append({
        "agent_id": ids[0],
        "name": names[0],
        "line": opener,
        "mood": mood,
    })

    # Total exchanges: pairs = rounds*2-1 more, trios = rounds * len(ids) - 1 more
    if len(ids) == 2:
        total_extra = max(1, rounds * 2 - 1)
    else:
        total_extra = max(2, rounds * len(ids) - 1)

    for i in range(total_extra):
        prev = lines[-1]
        speaker_idx = (ids.index(prev["agent_id"]) + 1) % len(ids)
        speaker_id = ids[speaker_idx]
        line = _format_reply(speaker_id, prev["agent_id"], prev["line"], ids)
        is_last = i == total_extra - 1
        line = _maybe_closer(speaker_id, line, is_last)
        prof = load_agent_profile(speaker_id)
        mood = random.choice(["happy", "think", "love", "flirt", "neutral"])
        lines.append({
            "agent_id": speaker_id,
            "name": prof.get("name") or speaker_id,
            "line": line,
            "mood": mood,
        })

    return lines


def converse_thread_prompt(
    agent_ids: list[str],
    topic: str,
    thread: list[dict[str, Any]],
    speaker_id: str,
) -> str:
    """Build user message for LLM group converse."""
    names = _names(agent_ids)
    others = [n for i, n in zip(agent_ids, names) if i != speaker_id]
    if not thread:
        return (
            f"Start a witty group chat with {', '.join(others)} about: {topic}. "
            f"Two to three witty sentences. Hook them. Your role: {role_for_agent(speaker_id)}."
        )
    prev = thread[-1]
    transcript = "\n".join(f"{t.get('name', '?')}: {t.get('line', '')}" for t in thread[-5:])
    return (
        f"Group chat ({', '.join(names)}) — topic: {topic}\n"
        f"Thread so far:\n{transcript}\n\n"
        f"Reply DIRECTLY to {prev.get('name', '?')} — riff on their words, be witty and funny. "
        f"Two to four sentences — let the banter breathe. Your role: {role_for_agent(speaker_id)}. "
        f"Don't repeat yourself. Don't lecture."
    )


def total_converse_lines(agent_count: int, rounds: int) -> int:
    if agent_count < 2:
        return 2
    if agent_count == 2:
        return max(2, min(8, rounds * 2))
    return max(3, min(9, rounds * agent_count))