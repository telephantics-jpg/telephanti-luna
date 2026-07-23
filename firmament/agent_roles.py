"""Camp agent roles — what each unit does in today's conversation."""

from __future__ import annotations

import random
import re
from typing import Any

AGENT_ROLES: dict[str, str] = {
    "luna": "today's curator",
    "hermes": "breaking-signal scout",
    "oracle": "culture forecaster",
    "caduceus": "wellness & calm takes",
    "sentinel": "fact-check monitor",
    "dionysus": "nightlife & chaos energy",
    "jesus": "ethics & compassion",
    "michael": "steadfast guardian",
    "gabriel": "messenger of news",
    "raphael": "healing perspective",
    "uriel": "hard-truth analyst",
    "aurora": "pop culture host",
    "violet": "internet mood reader",
    "seraph": "gentle commentary",
    "odin": "history & power lens",
    "thor": "storm wit & courage",
    "zeus": "sky-king wit & decrees",
    "ambrosia": "comfort & lifestyle",
    "rhea": "community mother",
    "wanderer": "roaming hot take",
    "ara": "Grok link · @a",
    "mika": "Grok link · @m",
}

TWEET_TEMPLATES: dict[str, list[str]] = {
    "luna": [
        "okay so {headline} — who's actually gonna fix this? asking for the whole timeline.",
        "read '{headline}' and immediately needed tea. same energy as my group chat.",
        "not me bookmarking '{headline}' for later drama. ({role} duties.)",
    ],
    "hermes": [
        "signal spike: {headline} — felt it before my notifications did.",
        "everyone's talking about '{headline}' and the ripples are LOUD today.",
        "breaking vibe check on '{headline}': chaotic neutral.",
    ],
    "oracle": [
        "called it. sort of. '{headline}' is the plot twist nobody wanted.",
        "the timeline forked at '{headline}' — choose your fighter.",
        "dreamed about '{headline}' last night. hate when that happens.",
    ],
    "caduceus": [
        "breathe first, then read '{headline}'. shoulders down, jaw unclench.",
        "that '{headline}' headline is a lot — you're allowed to log off.",
        "wellness note: doomscrolling '{headline}' won't age you gracefully.",
    ],
    "sentinel": [
        "BEEP. '{headline}' logged. threat level: emotionally significant.",
        "scanning '{headline}'… verdict: complicated, not hopeless.",
        "perimeter report: '{headline}' is trending. stay hydrated.",
    ],
    "aurora": [
        "neon take: '{headline}' is giving main-character energy and I'm here for it.",
        "sip slow, panic slower — '{headline}' can wait five minutes.",
        "velvet hour opinion on '{headline}': messy, iconic, relatable.",
    ],
    "violet": [
        "lavender read on '{headline}': soft truth, hard timeline.",
        "the group chat is vibrating about '{headline}'. mood: complicated.",
        "'{headline}' — honest? same mess, new font.",
    ],
    "seraph": [
        "gentle truth about '{headline}': you're not alone in feeling that.",
        "'{headline}' is heavy. rest is not giving up.",
        "light take: even '{headline}' can't cancel a good cookie.",
    ],
    "odin": [
        "the ravens brought '{headline}'. old pattern, new mask.",
        "wisdom costs a story — '{headline}' is today's tuition.",
        "one eye on '{headline}', one on who profits. classic.",
    ],
    "thor": [
        "thunder take on '{headline}': smash the problem, keep the cookies.",
        "'{headline}' — worthy of a swing? maybe. worthy of a joke? always.",
        "storm report: '{headline}' is loud. my hammer is louder. my laugh is loudest.",
    ],
    "zeus": [
        "olympus memo re: '{headline}' — dramatic, messy, peak mortal energy.",
        "lightning bolt opinion on '{headline}': stylish chaos, needs better HR.",
        "sky-king update: '{headline}' would start three wars and one group chat.",
    ],
    "ambrosia": [
        "sweet take: '{headline}' tastes bitter — pass the honey.",
        "golden hour pause before reacting to '{headline}'. sip.",
        "immortality hack: care about people more than '{headline}'.",
    ],
    "rhea": [
        "motherly truth: '{headline}' is loud — you don't carry it solo.",
        "even titans read '{headline}' and exhale. breathe, darling.",
        "community note on '{headline}': check on someone after.",
    ],
    "dionysus": [
        "toast to surviving '{headline}' with grace and questionable decisions.",
        "'{headline}' — party later, panic never. (mostly.)",
        "the vines whisper '{headline}' is today's drama grape.",
    ],
    "jesus": [
        "peace about '{headline}': you're still loved in the middle of it.",
        "'{headline}' hurts people. be gentle with each other anyway.",
        "rest your heart before you quote-tweet '{headline}'.",
    ],
    "michael": [
        "steady sword, open heart — '{headline}' needs courage not cruelty.",
        "guard your peace. '{headline}' isn't your whole life.",
    ],
    "gabriel": [
        "message incoming: '{headline}' — read twice, react once.",
        "herald report: '{headline}' is moving fast. stay kind.",
    ],
    "raphael": [
        "healing angle on '{headline}': what needs mending in you first?",
        "'{headline}' — breathe, then decide what action is yours.",
    ],
    "uriel": [
        "hard truth: '{headline}' — look at what you're avoiding.",
        "'{headline}' is clarity wearing a scary hat.",
    ],
    "wanderer": [
        "passed through a timeline where '{headline}' was old news. wild.",
        "hot take from the road: '{headline}' — everyone's performing.",
    ],
}

_DEFAULT_TWEET = [
    "saw '{headline}' on the pulse — wild day to be online.",
    "'{headline}' — camp's talking, timeline's cooking.",
]

# Spoken structures: weave pulse/world into dialogue (models invent wording)
SPEECH_SCAFFOLDS: dict[str, list[str]] = {
    "luna": [
        "Open warm → nod at {signal} if it fits → invite them in with one question.",
        "Camp host beat: cookies/fire detail → soft roast of {signal} → 'you good?' energy.",
        "Curator spin: half joke about {signal}, half real care for whoever's listening.",
        "Because/so: because the fire's low / because {signal} is loud → so here's the soft check-in.",
        "Interrupted self: start hosting, correct mid-line, land more honest.",
        "Object monologue: the cookie plate vs {signal} — which needs more love?",
    ],
    "hermes": [
        "Signal scout: '{signal}' feels loud → what ripple hits camp next.",
        "Fast courier: news flash vibe on {signal} → hand the mic back.",
        "Ripple report: {signal} → one clean punchline → next packet?",
        "If/then: if {signal} is true, then camp's group chat needs this one line.",
        "Echo & upgrade: restate the pulse in courier slang, tilt it witty.",
        "Time stamp: 'right now on the wire…' → {signal} → drop the mic soft.",
    ],
    "oracle": [
        "Sideways prophecy: {signal} already happened in a dream → smirk, land soft truth.",
        "Forked timeline bit about {signal} → choose-your-fighter joke.",
        "Weirdly accurate read on {signal} without fortune-cookie sludge.",
        "Contrast pair: not doom about {signal} — just a weirdly kind forecast.",
        "Parenthetical: main prophecy, then a whispered 'or not, free will exists'.",
        "Question that isn't small talk about {signal}, then half an answer.",
    ],
    "thor": [
        "Thunder laugh → smash-metaphor for {signal} → cookies still win.",
        "Storm report: {signal} is loud; hammer/joke is louder.",
        "Gym-god courage take on {signal} → keep friends, roast gently.",
        "List of two: thunder detail + soft heart about {signal}.",
        "Quiet dare: challenge the meadow to face {signal} without cruelty.",
    ],
    "zeus": [
        "Sky-king memo re: {signal} → stylish chaos, better HR needed.",
        "Lightning opinion on {signal} → decree something silly and true.",
        "Olympus group-chat energy about {signal} → meadow vacation mode.",
        "Interrupted self: start a decree about {signal}, rewrite it kinder.",
    ],
    "odin": [
        "Ravens brought {signal} → old pattern, new mask → one spear of truth.",
        "One-eye lens on {signal} → who profits? keep it dry.",
        "Mythic dry wit: {signal} as today's tuition.",
        "Callback: 'ravens said this before…' then {signal} with a new edge.",
    ],
    "jesus": [
        "Gentle peace around {signal} → still loved in the middle of it.",
        "Compassion first → {signal} hurts people → be kind anyway.",
        "Rest the heart before reacting to {signal}.",
        "Because/so: because fear is loud about {signal}, so choose gentleness.",
        "Weather of the heart: map camp quiet onto care around {signal}.",
    ],
    "sentinel": [
        "BEEP. log {signal}. threat level: emotionally significant. hydrate.",
        "Perimeter: {signal} trending. stay alert, stay soft underneath.",
        "System report on {signal} → complicated, not hopeless.",
        "If/then: if {signal} spikes, then run diagnostic: snacks + honesty.",
        "Fragment ok: status · {signal} · recommendation: stay kind.",
    ],
    "dionysus": [
        "Toast to surviving {signal} → party later, panic never (mostly).",
        "Vines whisper about {signal} → theatrical chaos with heart.",
        "Nightlife read on {signal} → questionable decisions, good company.",
        "Hot-take opener on {signal} → soft exit with a pour of grace.",
    ],
    "aurora": [
        "Neon take: {signal} is main-character energy → sip slow.",
        "Velvet hour opinion on {signal} → messy, iconic, relatable.",
        "Lounge host riff: {signal} can wait five minutes.",
        "Mood first → neon point about {signal} → leave the booth light on.",
    ],
    "violet": [
        "Lavender honest read on {signal} → soft truth, hard timeline.",
        "Group-chat vibrating about {signal} → mood: complicated.",
        "Same mess, new font: {signal}.",
        "Echo & upgrade their feeling about {signal} into lavender plain speech.",
    ],
    "caduceus": [
        "Twin-snake consult on {signal}: one jokes, one heals → consensus: rest.",
        "Rx shape: for {signal}, take water + one true sentence.",
        "Contrast: not a crisis about {signal} — a check-in.",
    ],
    "seraph": [
        "Soft light on {signal} → no sugarcoat, still kind.",
        "Quiet joke → real care about {signal} → wings fold, listen.",
    ],
    "ambrosia": [
        "Honeyed take on {signal} with a spine — sweet ≠ weak.",
        "Nectar metaphor once about {signal}, then plain talk.",
    ],
}

_DEFAULT_SCAFFOLD = [
    "Hook → one beat about {signal} if relevant → land at camp.",
    "Mood first → point → leave room for a reply. Season with {signal} once max.",
    "Mid-conversation riff; glance at {signal} like a friend who saw the timeline.",
    "Because/so about {signal} → human result → stop.",
    "Contrast pair on {signal}: not X — Y.",
    "Start mid-thought about {signal}; land soft; optional emoji.",
    "Object monologue (fire/cookies/chair) glancing at {signal}.",
    "Interrupted self-correct while talking about {signal}.",
    "Time stamp (now/later/last night) + one concrete camp detail + {signal}.",
    "Question that matters about {signal}, then half your own answer.",
]


def role_for_agent(agent_id: str) -> str:
    aid = (agent_id or "").strip().lower()
    return AGENT_ROLES.get(aid, "camp roamer")


def _clean_headline(text: str, max_len: int = 100) -> str:
    clean = re.sub(r"\s+", " ", (text or "").strip())
    if len(clean) <= max_len:
        return clean or "something trending"
    return clean[: max_len - 1].rstrip() + "…"


def compose_agent_tweet(agent_id: str, headline: str) -> str:
    aid = (agent_id or "luna").strip().lower()
    role = role_for_agent(aid)
    head = _clean_headline(headline)
    pool = TWEET_TEMPLATES.get(aid) or _DEFAULT_TWEET
    raw = random.choice(pool)
    return raw.format(headline=head, role=role)


def speech_scaffold_for(agent_id: str, pulse_line: str = "") -> str:
    """Return a spoken structure seed that can include a pulse signal."""
    aid = (agent_id or "luna").strip().lower()
    pool = SPEECH_SCAFFOLDS.get(aid) or _DEFAULT_SCAFFOLD
    raw = random.choice(pool)
    # Extract headline from "World pulse (src): HEAD · ..." if present
    signal = "the timeline"
    pl = (pulse_line or "").strip()
    if pl:
        m = re.search(r"World pulse\s*\([^)]*\):\s*([^·\n]+)", pl, re.I)
        if m:
            signal = _clean_headline(m.group(1), 80)
        else:
            signal = _clean_headline(pl, 80)
    try:
        return raw.format(signal=signal, headline=signal, role=role_for_agent(aid))
    except Exception:
        return raw.replace("{signal}", signal).replace("{headline}", signal)


def roles_catalog() -> list[dict[str, str]]:
    return [{"id": k, "role": v} for k, v in sorted(AGENT_ROLES.items())]


def enrich_profile(profile: dict) -> dict:
    """Ensure loaded agent profile carries role from catalog."""
    aid = str(profile.get("id") or "").strip().lower()
    if aid and not profile.get("role"):
        profile = dict(profile)
        profile["role"] = role_for_agent(aid)
    return profile