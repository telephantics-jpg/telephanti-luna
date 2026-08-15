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
    "Who would win a talent show at camp: Hermes's gossip, Thor's monologues, or Luna hosting?",
    "Is the jukebox haunted, tasteful, or just better than our playlists?",
    "Whether {visitor} is the main character or a very important guest star this season.",
    "If the Firmament opens, do we fly — or do we talk about flying and stay by the cookies?",
    "Best camp job title that doesn't exist yet: Head of Soft Roasts, Minister of Cookies, etc.",
    "Can you be lonely at a full campfire, and is that still allowed?",
    "The ethics of reading someone else's group chat energy without reading their group chat.",
    "Whether sleep is a skill, a glitch, or a negotiation with the aurora.",
    "If every agent here had a podcast, which crossover episode would get cancelled first?",
    "Is sarcasm a love language or a firewall with good branding?",
    "Whether the pond is a mirror, a portal, or just wet philosophy.",
    "What we'd tell past-us at the start of camp without spoiling the funny parts.",
    "If free minds are free, why does attention still cost something real?",
    "Who's lying more: the sky, the timeline, or us when we say 'one more cookie'?",
    "Whether banter is friendship or competitive care with better lighting.",
]

PULSE_TOPIC_FRAMES = [
    "So everyone's yelling about '{headline}' — what's the actual take beneath the performance?",
    "Okay '{headline}' just dropped — who's being dramatic, and who's just correctly alarmed?",
    "'{headline}' — hot take round. Make it true, make it funny, don't make it cruel.",
    "News flash: '{headline}'. Translate it into camp language for the rest of us.",
    "I refuse to doomscroll alone — '{headline}' — roast it or respect it, pick one.",
]

OPENERS = [
    "{name}: {others} — I keep coming back to {topic}. What do you actually think?",
    "{name}: Hey {others}. {topic} has been sitting in my head. Don't let me carry it alone.",
    "{name}: {others}, can we talk about {topic}? I have a real take, not a bit.",
    "{name}: Okay {others}. {topic}. I'll go first if you stay with me.",
    "{name}: {others} — tell me I'm wrong about {topic}. I might be.",
    "{name}: Sitting with {topic} and it's getting louder. {others}, jump in.",
]

REPLIES = [
    "{name}: {other}, I heard you. {prev} That's the live wire for me — I just land somewhere else.",
    "{name}: Hold on {other}. If {prev} is true, then we have to own the next part too.",
    "{name}: Yeah {other}. {prev}. And that's why I keep sitting closer.",
    "{name}: {other}, wait — {prev}? I don't buy the easy version. The harder one is we still chose it.",
    "{name}: I felt that, {other}. {prev}. So what do we do with it after the joke?",
    "{name}: {other}, I'm with you on {prev} until the last beat. That's where I peel off.",
    "{name}: Okay {other}. {prev}. Then I'm asking: who does that leave out?",
    "{name}: {other} — say that again slower. {prev} is either comfort or a warning.",
    "{name}: Directly, {other}: {prev}. I agree, and I'm still not done arguing with it.",
    "{name}: {other}, that lands. {prev}. My half is we stop pretending it was accidental.",
]

TRIO_CHIMES = [
    "{name}: {other_a}, {other_b} — I heard {prev}. Can I add the piece you're both circling?",
    "{name}: {other}, I'm in. {prev} — and I'm not letting this stay a two-person loop.",
    "{name}: You two opened it. {prev}. Here's the third chair: we actually mean it.",
    "{name}: {other}, pause. {prev} is the real sentence. Don't bury it in a joke yet.",
    "{name}: {other_a} and {other_b}, I caught {prev}. I'm not peacemaking — I'm picking a side.",
]

CLOSERS = [
    "{name}: I'm leaving that with you. We can pick it up when it cools.",
    "{name}: Alright. I heard you. I'll sit with it.",
    "{name}: That's enough heat for one fire. Come find me if it grows.",
    "{name}: I'm not done, but I'll stop talking so you can finish the thought.",
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
    prev = _snippet(prev_line, 110)

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
    rounds: int = 3,
) -> list[dict[str, Any]]:
    """Threaded witty banter for 2–4 agents — longer free-mind circle talk."""
    ids = [a.strip().lower() for a in agent_ids if a.strip()][:4]
    if len(ids) < 2:
        ids = ["luna", "hermes"]
    # Default longer threads so meadow feels chatty without LLM spend
    rounds = max(2, min(5, int(rounds or 3)))
    topic_clean = _snippet(topic or pick_converse_topic(visitor_name), 110)
    names = _names(ids)
    lines: list[dict[str, Any]] = []

    # Opener from first agent — address the others by name
    opener = _format_opener(ids[0], names[1:], topic_clean)
    mood = "happy" if "?" in opener else "think"
    lines.append({
        "agent_id": ids[0],
        "name": names[0],
        "line": opener,
        "mood": mood,
        "to": ids[1] if len(ids) > 1 else "",
    })

    # Pairs: more back-and-forth; trios/quartets: full circle passes
    if len(ids) == 2:
        total_extra = max(3, rounds * 2)
    elif len(ids) == 3:
        total_extra = max(4, rounds * len(ids))
    else:
        total_extra = max(5, rounds * len(ids) - 1)
    total_extra = min(total_extra, 14)  # hard cap so UI doesn't flood

    for i in range(total_extra):
        prev = lines[-1]
        # Prefer answering the previous speaker (true dialogue), sometimes skip for trio spice
        if len(ids) >= 3 and random.random() < 0.22:
            candidates = [a for a in ids if a != prev["agent_id"]]
            speaker_id = random.choice(candidates)
        else:
            speaker_idx = (ids.index(prev["agent_id"]) + 1) % len(ids)
            speaker_id = ids[speaker_idx]
        line = _format_reply(speaker_id, prev["agent_id"], prev["line"], ids)
        is_last = i == total_extra - 1
        line = _maybe_closer(speaker_id, line, is_last)
        prof = load_agent_profile(speaker_id)
        mood = random.choice(["happy", "think", "love", "flirt", "neutral", "alert"])
        lines.append({
            "agent_id": speaker_id,
            "name": prof.get("name") or speaker_id,
            "line": line,
            "mood": mood,
            "to": prev["agent_id"],
        })

    return lines


def converse_thread_prompt(
    agent_ids: list[str],
    topic: str,
    thread: list[dict[str, Any]],
    speaker_id: str,
) -> str:
    """Transcript + last line only. Identity lives in the system prompt."""
    names = _names(agent_ids)
    others = [n for i, n in zip(agent_ids, names) if i != speaker_id]
    other = others[0] if others else "them"
    subject = re.sub(r"\s+", " ", (topic or "").strip())[:140]

    if not thread:
        return (
            f"{other} is next to you at the fire.\n"
            f"{other} wants to talk about {subject or 'whatever is hanging in the air'}.\n"
            f"You speak first, to {other}."
        )

    prev = thread[-1]
    prev_name = prev.get("name") or "?"
    prev_line = re.sub(r"\s+", " ", str(prev.get("line") or "")).strip()
    prev_idea = prev_line[:200] + ("…" if len(prev_line) > 200 else "")

    bits = []
    for t in thread[-6:]:
        who = t.get("name", "?")
        line = re.sub(r"\s+", " ", str(t.get("line") or "")).strip()
        idea = line[:160] + ("…" if len(line) > 160 else "")
        bits.append(f"{who}: {idea}")
    transcript = "\n".join(bits)
    return (
        f"{', '.join(names)} are talking.\n"
        f"{transcript}\n"
        f"{prev_name} said: {prev_idea}\n"
        f"Your turn — talk to {prev_name}."
    )


_META_BANTER_RE = re.compile(
    r"(?:"
    r"die on this hill|fight me politely|full sentences only|"
    r"that take was bold|wrong in the interesting way|"
    r"passing the mic|circle up|group-chat energy|"
    r"team chaos with footnotes|podcast title that gets cancelled|"
    r"no slogans|unprompted monologue incoming|"
    r"2[–\- ]4 spoken sentences|stay on this conversation"
    r")",
    re.I,
)


def looks_like_meta_banter(text: str) -> bool:
    """True if the line is talking about the conversation instead of being in it."""
    t = (text or "").strip()
    if not t:
        return True
    return bool(_META_BANTER_RE.search(t))


def total_converse_lines(agent_count: int, rounds: int) -> int:
    """Enough turns for a real back-and-forth without endless essays."""
    if agent_count < 2:
        return 2
    if agent_count == 2:
        return max(5, min(10, rounds * 2 + 2))
    if agent_count == 3:
        return max(6, min(12, rounds * agent_count))
    # quartet pow-wow
    return max(8, min(14, rounds * agent_count - 1))