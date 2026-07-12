"""Witty agent-to-agent camp conversations — pairs & trios with logical threads."""

from __future__ import annotations

import random
import re
from typing import Any

from firmament.brain import load_agent_profile

WITTY_TOPICS = [
    "That headline everyone's pretending they read the whole article on — and the irony that the comment section is now the article.",
    "Whether group chats should have lawyers present, or just someone who remembers context after Tuesday.",
    "The worst take you saw before breakfast and why it still lives rent-free in your skull.",
    "AI doing everyone's job except the fun parts — and why that's somehow both a tragedy and a bit.",
    "Dating apps vs. just talking to someone at the pond, which is either romantic or a safety briefing.",
    "A rumor that sounds fake but feels true — the rare art form of emotionally accurate nonsense.",
    "What {visitor} would post if they went viral for one day, and whether they'd delete it by dusk.",
    "The difference between resting and rotting — discuss like philosophers who also check their phones.",
    "A tech launch that solved a problem nobody had, then invented three new ones as a feature.",
    "Who at camp would survive a reality show and why the winner would still be insufferable.",
    "Whether this camp is a dream {visitor} is having, or {visitor} is a dream the camp is having.",
    "If free will is real, why do we all walk toward the same cookies — and is that still freedom?",
    "Time loops at camp: if Oracle already saw this conversation, is arguing still comedy or ritual?",
    "What if every monologue here is the same monologue wearing different masks — prove it wrong.",
    "Simulation glitches you've noticed today — the sky blinking, déjà vu, Jesus's church existing.",
    "Whether dying in a video game is practice for dying in a story, and which one we prefer.",
    "If kindness is a hack of the universe, who wrote the patch notes?",
    "The idea that your worst thought is just a tourist and your best thought is a local — discuss housing.",
    "Whether love is physics, chemistry, or bad UI design with excellent marketing.",
    "If the meadow remembers visitors, is memory a place or a person wearing grass?",
]

PULSE_TOPIC_FRAMES = [
    "So everyone's yelling about '{headline}' — what's the actual take beneath the performance?",
    "Okay '{headline}' just dropped — who's being dramatic, and who's just correctly alarmed?",
    "'{headline}' — hot take round. Make it true, make it funny, don't make it cruel.",
]

OPENERS = [
    "{name}: Okay {others} — {topic} I will die on this hill. Tastefully. With footnotes.",
    "{name}: Real question for {others}: {topic} And before you dodge — I already know your dodge.",
    "{name}: I wasn't gonna say anything, but {topic} …and then I remembered silence is also a take.",
    "{name}: {others}, hear me out — {topic} This is free wisdom. The meadow doesn't charge tuition.",
    "{name}: *cracks knuckles* {topic} Fight me politely. I brought receipts and a monologue.",
]

REPLIES = [
    "{name}: {other}, that take was bold — wrong in the interesting way, which is almost right. Almost.",
    "{name}: Wait — {other} really went with \"{prev}\"? I need a minute. Not to disagree. To savor the chaos.",
    "{name}: Building on {other}: {prev} — and that's why I'm right, which is the traditional sequel to building on someone.",
    "{name}: {other}, respectfully… no. \"{prev}\" is giving group-chat energy with a philosophy minor.",
    "{name}: Okay {other} has a point with \"{prev}\". Rare. Document this. Frame it. Tell the visitor.",
    "{name}: I love {other} but \"{prev}\" sounds like a podcast title that gets cancelled after episode three for being correct.",
    "{name}: Counterpoint to {other}: {prev} — funny, true, and still missing the third twist, which is me.",
    "{name}: {other} said \"{prev}\" and the meadow went silent. Deserved. Silence is just applause with anxiety.",
    "{name}: Not to escalate, but {other}'s \"{prev}\" keeps me up at night. In a productive, slightly unhinged way.",
    "{name}: {other}, that's the funniest wrong thing I've heard today — and \"{prev}\" is why wrong can still be useful.",
]

TRIO_CHIMES = [
    "{name}: You two — {other_a} and {other_b} — are doing a whole opera. {prev} I'm team chaos with footnotes.",
    "{name}: Interrupting: {other} said \"{prev}\" and I'm choosing verbal violence. Soft violence. Camp-safe.",
    "{name}: As the adult here: {prev} …jk {other}, fight on. I only brought water, not peace.",
    "{name}: {other}'s \"{prev}\" — third opinion: both of you need water, and one of you needs a better metaphor.",
    "{name}: I was quiet but {other}'s \"{prev}\" activated my commentary gene. Consider this a public service.",
    "{name}: Peacemaker? Never met her. {prev} — {other}, explain yourself like the visitor is grading us.",
]

CLOSERS = [
    "{name}: Anyway we're never agreeing. Same time tomorrow? Bring better irony.",
    "{name}: Great chat. I've chosen delusion with confidence. Bye — don't fact-check me too hard.",
    "{name}: Truce. The visitor didn't ask for this TED talk, but they got a free one. You're welcome.",
    "{name}: We're all right. We're all annoying. Perfect. That's camp.",
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
    """Pure scene seed for multi-agent dialogue — no instruction labels to recite."""
    names = _names(agent_ids)
    others = [n for i, n in zip(agent_ids, names) if i != speaker_id]
    me = load_agent_profile(speaker_id).get("name") or speaker_id

    if not thread:
        other = others[0] if others else "them"
        return (
            f"Fire circle with {', '.join(others) if others else 'camp'}.\n"
            f"Topic in the air: {topic}\n\n"
            f"Open naturally. Address {other} by name, take a clear stance, leave room for them.\n"
            f"Just spoken words — no labels."
        )

    prev = thread[-1]
    prev_name = prev.get("name") or "?"
    prev_line = re.sub(r"\s+", " ", str(prev.get("line") or "")).strip()
    prev_idea = prev_line[:160] + ("…" if len(prev_line) > 160 else "")

    transcript_bits = []
    for t in thread[-6:]:
        who = t.get("name", "?")
        line = re.sub(r"\s+", " ", str(t.get("line") or "")).strip()
        idea = line[:140] + ("…" if len(line) > 140 else "")
        transcript_bits.append(f"{who}: {idea}")
    transcript = "\n".join(transcript_bits)

    turn_n = len(thread) + 1
    is_closing = turn_n >= 5 and len(thread) >= 4

    close_bit = ""
    if is_closing:
        close_bit = " Soft wrap-up is fine after you answer them."

    return (
        f"Fire circle: {', '.join(names)}. Topic: {topic}\n\n"
        f"So far:\n{transcript}\n\n"
        f"{prev_name} just said (answer the meaning, not the exact words):\n"
        f"\"{prev_idea}\"\n\n"
        f"Your turn — react, push back or build, keep the thread alive."
        f"{close_bit}"
    )


def total_converse_lines(agent_count: int, rounds: int) -> int:
    """Enough turns for a real back-and-forth without endless essays."""
    if agent_count < 2:
        return 2
    if agent_count == 2:
        # e.g. rounds=2 → 5 turns (A B A B A), rounds=3 → 7
        return max(5, min(8, rounds * 2 + 1))
    # trio: keep it tight
    return max(6, min(9, rounds * agent_count))