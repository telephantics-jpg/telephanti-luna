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
    "ambrosia": "comfort & lifestyle",
    "rhea": "community mother",
    "wanderer": "roaming hot take",
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


def roles_catalog() -> list[dict[str, str]]:
    return [{"id": k, "role": v} for k, v in sorted(AGENT_ROLES.items())]


def enrich_profile(profile: dict) -> dict:
    """Ensure loaded agent profile carries role from catalog."""
    aid = str(profile.get("id") or "").strip().lower()
    if aid and not profile.get("role"):
        profile = dict(profile)
        profile["role"] = role_for_agent(aid)
    return profile