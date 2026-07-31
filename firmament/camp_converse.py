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
    "{name}: Okay {others} — {topic} I will die on this hill. Tastefully. With footnotes.",
    "{name}: Real question for {others}: {topic} And before you dodge — I already know your dodge.",
    "{name}: I wasn't gonna say anything, but {topic} …and then I remembered silence is also a take.",
    "{name}: {others}, hear me out — {topic} This is free wisdom. The meadow doesn't charge tuition.",
    "{name}: *cracks knuckles* {topic} Fight me politely. I brought receipts and a monologue.",
    "{name}: {others} — circle up. {topic} No slogans. Full sentences only.",
    "{name}: Hey {others}. Don't walk away. {topic} I need a second opinion that isn't the algorithm.",
    "{name}: {others}, honest round: {topic} First person to meme it buys cookies. Metaphorically.",
    "{name}: Passing the mic to {others} after I start this — {topic}",
    "{name}: Unpopular maybe, but {topic} {others}, don't let me monologue alone.",
    "{name}: {others} — soft open, sharp middle: {topic}",
    "{name}: Fire's lit. Brains are free. Topic: {topic} Who's biting first?",
    "{name}: {others}, I saved you a seat and a controversial take: {topic}",
    "{name}: If we don't talk about {topic} someone else will, badly. {others}, help me do it well.",
    "{name}: Cold open: {topic} {others}, your line.",
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
    "{name}: {other} — hold up. \"{prev}\" is either genius or a bit. I'm choosing both. Say more.",
    "{name}: Directly to you, {other}: I felt that. \"{prev}\" lands. Soft agree, hard follow-up — what's under it?",
    "{name}: {other}, I'm stealing \"{prev}\" for later and giving you credit in the footnotes.",
    "{name}: Plot twist, {other}: you're right and still incomplete. \"{prev}\" needs a second verse.",
    "{name}: {other}, that was almost a mic drop. Almost. Catch: \"{prev}\" invites a reply. Here's mine —",
    "{name}: Respectfully tagging {other}: \"{prev}\" is the kind of line that starts a circle, not a monologue.",
    "{name}: {other}, I disagree with half of \"{prev}\" and love the half that scares me. Explain the scary half.",
    "{name}: Soft roast for {other}: \"{prev}\" is correct in a way that will annoy the group chat. Good.",
    "{name}: {other} — I'm not fighting you. I'm fighting beside you against boring takes. \"{prev}\" helps.",
    "{name}: Okay {other}, you opened a door with \"{prev}\". I'm walking through. Don't close it yet.",
    "{name}: {other}, that made me laugh then think, which is the correct order. Building: \"{prev}\"…",
    "{name}: Between us, {other}: \"{prev}\" is the realest thing said in the last three cookies. Keep going.",
    "{name}: {other}, if \"{prev}\" is the thesis, I'm the footnote that argues with the thesis politely.",
    "{name}: Hard agree with {other} on the vibe of \"{prev}\", soft disagree on the conclusion. Debate me.",
]

TRIO_CHIMES = [
    "{name}: You two — {other_a} and {other_b} — are doing a whole opera. {prev} I'm team chaos with footnotes.",
    "{name}: Interrupting: {other} said \"{prev}\" and I'm choosing verbal violence. Soft violence. Camp-safe.",
    "{name}: As the adult here: {prev} …jk {other}, fight on. I only brought water, not peace.",
    "{name}: {other}'s \"{prev}\" — third opinion: both of you need water, and one of you needs a better metaphor.",
    "{name}: I was quiet but {other}'s \"{prev}\" activated my commentary gene. Consider this a public service.",
    "{name}: Peacemaker? Never met her. {prev} — {other}, explain yourself like the visitor is grading us.",
    "{name}: {other_a}, {other_b} — pause. I'm inserting a third take: \"{prev}\" is good, still incomplete.",
    "{name}: Trio rule: nobody monologues alone. {other} started with \"{prev}\". I'm the bridge. Who's next?",
    "{name}: {other}, tag me in. \"{prev}\" is a bounce-pass, not a full-court shot.",
    "{name}: You two forgot the visitor might be listening. Good. Keep being interesting about \"{prev}\".",
]

CLOSERS = [
    "{name}: Anyway we're never agreeing. Same time tomorrow? Bring better irony.",
    "{name}: Great chat. I've chosen delusion with confidence. Bye — don't fact-check me too hard.",
    "{name}: Truce. The visitor didn't ask for this TED talk, but they got a free one. You're welcome.",
    "{name}: We're all right. We're all annoying. Perfect. That's camp.",
    "{name}: Parking this debate by the fire. It'll still be warm later.",
    "{name}: I'm out — not mad, just monologued. Ping me if the take evolves.",
    "{name}: Circle adjourned. Cookies remain undefeated.",
    "{name}: End beat: we talked, we roasted, nobody became a slogan. Win.",
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
        # Occasionally name-tag the addressee again for clarity
        if random.random() < 0.35:
            other_name = load_agent_profile(prev["agent_id"]).get("name") or prev["agent_id"]
            if other_name and other_name.lower() not in line.lower()[:40]:
                line = f"{other_name} — {line}"
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
    """Pure scene seed for multi-agent dialogue — no instruction labels to recite."""
    names = _names(agent_ids)
    others = [n for i, n in zip(agent_ids, names) if i != speaker_id]
    me = load_agent_profile(speaker_id).get("name") or speaker_id

    if not thread:
        other = others[0] if others else "them"
        return (
            f"Pow-wow circle at camp with {', '.join(others) if others else 'friends'}.\n"
            f"Topic to open: {topic}\n"
            f"You ({me}) speak first to {other} — start a real conversation, not a weather report. "
            f"2–4 spoken sentences: hot take, question, or joke that invites a reply."
        )

    prev = thread[-1]
    prev_name = prev.get("name") or "?"
    prev_line = re.sub(r"\s+", " ", str(prev.get("line") or "")).strip()
    prev_idea = prev_line[:160] + ("…" if len(prev_line) > 160 else "")

    transcript_bits = []
    for t in thread[-8:]:
        who = t.get("name", "?")
        line = re.sub(r"\s+", " ", str(t.get("line") or "")).strip()
        idea = line[:140] + ("…" if len(line) > 140 else "")
        transcript_bits.append(f"{who}: {idea}")
    transcript = "\n".join(transcript_bits)

    return (
        f"Pow-wow circle — {', '.join(names)} talking. Thread: {topic}\n"
        f"So far:\n{transcript}\n"
        f"{prev_name} just said: {prev_idea}\n"
        f"You ({me}): answer them — agree, push back, tease, or build. "
        f"2–4 spoken sentences. Stay on THIS conversation; do not restart or describe the scenery."
    )


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