"""
Luna Camp Protocol — world interactions with live brains.

Design goals (the "next-level" bits without the theater):
  • Single orchestration layer for prop / house / kit / chat side-effects
  • Deterministic visual kits (no client inventing Hermes's look)
  • Brains stay in firmament.brain — this module only composes prompts + memory
  • Structured CampEvent payloads every client can render the same way

Clients (2D, Three.js, Unreal) should call these HTTP endpoints instead of
hand-rolling ambient prompts.
"""

from __future__ import annotations

import logging
import random
import time
from dataclasses import asdict, dataclass, field
from typing import Any, Literal

from firmament.world_catalog import load_catalog

log = logging.getLogger("luna.firmament.protocol")

InteractionKind = Literal["prop_use", "house_enter", "agent_focus", "banter"]


# ── Visual kits (namesake presentation keys) ─────────────────────────────

@dataclass(frozen=True, slots=True)
class VisualKit:
    """Presentation contract — clients map kit_id → mesh / materials / FX."""

    kit_id: str
    label: str
    archetype: str
    primary: str
    accent: str
    symbol: str
    silhouette: str  # capsule | winged | tower | armored | soft
    fx: tuple[str, ...] = ()
    namesake: str = ""
    glb: str = ""  # optional future /static path

    def public(self) -> dict[str, Any]:
        d = asdict(self)
        d["fx"] = list(self.fx)
        return d


# Registry: archetype / entity-id → kit. Clients never hardcode Hermes wings.
_KITS: dict[str, VisualKit] = {
    "moon_host": VisualKit(
        kit_id="moon_host",
        label="Luna",
        archetype="moon_host",
        primary="#c9a87c",
        accent="#a855f7",
        symbol="moon",
        silhouette="soft",
        fx=("soft_glow", "corona_halo"),
        namesake="Lunar host — warm cream body, violet moon crest, night-calm energy",
    ),
    "messenger": VisualKit(
        kit_id="messenger",
        label="Hermes",
        archetype="messenger",
        primary="#f59e0b",
        accent="#38bdf8",
        symbol="wing",
        silhouette="winged",
        fx=("speed_streak", "signal_ping"),
        namesake="Swift messenger — wing fins, amber signal, cyan relay trim",
    ),
    "seer": VisualKit(
        kit_id="seer",
        label="Oracle",
        archetype="seer",
        primary="#a78bfa",
        accent="#c4b5fd",
        symbol="eye",
        silhouette="tower",
        fx=("third_eye", "veil_particles"),
        namesake="Violet seer — third-eye glyph, soft veil particles",
    ),
    "healer": VisualKit(
        kit_id="healer",
        label="Caduceus",
        archetype="healer",
        primary="#34d399",
        accent="#6ee7b7",
        symbol="serpents",
        silhouette="soft",
        fx=("heal_ring", "twin_coil"),
        namesake="Twin-serpent staff energy, mint calm",
    ),
    "guardian": VisualKit(
        kit_id="guardian",
        label="Sentinel",
        archetype="guardian",
        primary="#38bdf8",
        accent="#e0f2fe",
        symbol="shield",
        silhouette="armored",
        fx=("scanline", "perimeter_pulse"),
        namesake="Cyan guardian — shield plate, scanline eyes",
    ),
    "shepherd": VisualKit(
        kit_id="shepherd",
        label="Jesus",
        archetype="shepherd",
        primary="#fde68a",
        accent="#fef3c7",
        symbol="cross",
        silhouette="soft",
        fx=("warm_halo",),
        namesake="Gold chapel-host calm, soft halo",
    ),
    "reveler": VisualKit(
        kit_id="reveler",
        label="Dionysus",
        archetype="reveler",
        primary="#fb7185",
        accent="#e11d48",
        symbol="grape",
        silhouette="soft",
        fx=("wine_spark", "party_bloom"),
        namesake="Wine-rose reveler, grape cluster crest",
    ),
    "lights": VisualKit(
        kit_id="lights",
        label="Aurora",
        archetype="lights",
        primary="#22d3ee",
        accent="#f472b6",
        symbol="ribbon",
        silhouette="soft",
        fx=("aurora_ribbon", "neon_drift"),
        namesake="Sky ribbons, cyan-pink aurora drift",
    ),
    "allfather": VisualKit(
        kit_id="allfather",
        label="Odin",
        archetype="allfather",
        primary="#94a3b8",
        accent="#1e293b",
        symbol="raven",
        silhouette="armored",
        fx=("raven_perch", "rune_sparks"),
        namesake="Slate storm-king, raven shoulder, rune trim",
    ),
    "thunder": VisualKit(
        kit_id="thunder",
        label="Thor",
        archetype="thunder",
        primary="#f97316",
        accent="#38bdf8",
        symbol="hammer",
        silhouette="armored",
        fx=("spark_arc", "ground_thump"),
        namesake="Storm orange, hammer silhouette, electric accent",
    ),
    # Props / structures
    "cooler": VisualKit("cooler", "Beer cooler", "prop", "#f59e0b", "#fbbf24", "mug", "capsule", ("foam_hiss",), "Camp cooler"),
    "grill": VisualKit("grill", "Grill", "prop", "#dc2626", "#f97316", "flame", "capsule", ("smoke_wisp",), "Steak grill"),
    "jukebox": VisualKit("jukebox", "Jukebox", "prop", "#38bdf8", "#67e8f9", "note", "capsule", ("bass_pulse",), "Camp stereo"),
    "board": VisualKit("board", "Ouija", "prop", "#a855f7", "#c084fc", "eye", "capsule", ("planchette_twitch",), "Spirit board"),
    "moon_cottage": VisualKit("moon_cottage", "Moon cottage", "house", "#7c3aed", "#a855f7", "moon", "tower", ("window_glow",), "Luna's house"),
    "messenger_hut": VisualKit("messenger_hut", "Messenger hut", "house", "#ea580c", "#f59e0b", "wing", "tower", ("flag_flutter",), "Hermes hut"),
    "vision_tower": VisualKit("vision_tower", "Vision tower", "house", "#5b21b6", "#7c3aed", "eye", "tower", ("scry_beam",), "Oracle tower"),
    "mead_hall": VisualKit("mead_hall", "Mead hall", "house", "#1e293b", "#334155", "raven", "tower", ("torch_flicker",), "Odin hall"),
    "chapel": VisualKit("chapel", "Chapel", "house", "#fde68a", "#f59e0b", "cross", "tower", ("bell_soft",), "Church house"),
    "campfire_corona": VisualKit("campfire_corona", "Corona fire", "landmark", "#ff8a3d", "#ffe08a", "flame", "capsule", ("ember_up",), "Camp center"),
}


def list_visual_kits() -> dict[str, Any]:
    return {
        "ok": True,
        "version": 1,
        "count": len(_KITS),
        "kits": {k: v.public() for k, v in _KITS.items()},
    }


def resolve_kit(kit_or_archetype: str) -> VisualKit | None:
    key = (kit_or_archetype or "").strip().lower()
    if key in _KITS:
        return _KITS[key]
    for kit in _KITS.values():
        if kit.archetype == key or kit.kit_id == key:
            return kit
    return None


# ── Structured events (uniform client rendering) ─────────────────────────

@dataclass(slots=True)
class CampLine:
    agent_id: str
    name: str
    text: str
    mood: str = "neutral"
    backend: str = ""

    def public(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(slots=True)
class CampEvent:
    """One interaction outcome — toast, speech bubbles, FX, optional brain lines."""

    ok: bool
    kind: InteractionKind
    target_id: str
    message: str
    lines: list[CampLine] = field(default_factory=list)
    fx: list[str] = field(default_factory=list)
    kit: dict[str, Any] | None = None
    meta: dict[str, Any] = field(default_factory=dict)
    ts: float = field(default_factory=time.time)

    def public(self) -> dict[str, Any]:
        return {
            "ok": self.ok,
            "kind": self.kind,
            "target_id": self.target_id,
            "message": self.message,
            "lines": [ln.public() for ln in self.lines],
            "fx": list(self.fx),
            "kit": self.kit,
            "meta": self.meta,
            "ts": self.ts,
        }


# ── Catalog lookups ──────────────────────────────────────────────────────

def _entity(kind: str, entity_id: str) -> dict[str, Any] | None:
    cat = load_catalog()
    bucket = {
        "prop": "props",
        "house": "houses",
        "agent": "agents",
        "landmark": "landmarks",
    }.get(kind)
    if not bucket:
        return None
    eid = (entity_id or "").strip().lower()
    for row in cat.get(bucket) or []:
        if not isinstance(row, dict):
            continue
        rid = str(row.get("id") or "").lower()
        owner = str(row.get("owner_id") or "").lower()
        if rid == eid or owner == eid:
            return row
    return None


def _agent_name(agent_id: str) -> str:
    row = _entity("agent", agent_id)
    if row and row.get("name"):
        return str(row["name"])
    try:
        from firmament.brain import load_agent_profile

        return str(load_agent_profile(agent_id).get("name") or agent_id)
    except Exception:
        return agent_id


def _nearest_agent_ids(x: float, y: float, *, limit: int = 2) -> list[str]:
    cat = load_catalog()
    scored: list[tuple[float, str]] = []
    for row in cat.get("agents") or []:
        if not isinstance(row, dict) or not row.get("id"):
            continue
        ax = float(row.get("x") or 0)
        ay = float(row.get("y") or 0)
        dist = (ax - x) ** 2 + (ay - y) ** 2
        scored.append((dist, str(row["id"])))
    scored.sort(key=lambda t: t[0])
    return [aid for _, aid in scored[:limit]]


# ── Brain composition ────────────────────────────────────────────────────

async def _speak(
    agent_id: str,
    prompt: str,
    *,
    visitor_id: str = "",
    visitor_name: str = "",
    ambient: bool = True,
) -> CampLine | None:
    from firmament.brain import agent_chat
    from firmament.core import get_hub

    hub = get_hub()
    try:
        result = await agent_chat(
            agent_id,
            prompt,
            pack_name=str(hub.pack.get("name") or hub.pack_id),
            visitor_id=visitor_id,
            visitor_name=visitor_name,
            ambient=ambient,
            skip_memory=ambient,
        )
    except Exception as exc:
        log.warning("brain fail %s: %s", agent_id, exc)
        return CampLine(
            agent_id=agent_id,
            name=_agent_name(agent_id),
            text=_offline_bark(agent_id, prompt),
            mood="think",
            backend="offline_fallback",
        )

    reply = str(result.get("reply") or result.get("text") or "").strip()
    if not reply:
        return None
    return CampLine(
        agent_id=agent_id,
        name=_agent_name(agent_id),
        text=reply,
        mood=str(result.get("mood") or "neutral"),
        backend=str(result.get("backend") or result.get("model") or ""),
    )


def _offline_bark(agent_id: str, context: str) -> str:
    """Local witty line if Ollama/Grok are down — still feels alive."""
    name = _agent_name(agent_id)
    seeds = [
        f"{name}: Brains are rebooting, but the meadow still clocks that move.",
        f"{name}: Offline mode — still counting this as lore.",
        f"{name}: Signal soft. Vibe received. Reply pending from the aurora.",
    ]
    return random.choice(seeds)


_PROP_PROMPTS = {
    "beer": "A visitor just cracked a camp beer by the cooler. React in character in 1–3 lively sentences — witty, not a lecture. Reference the beer once.",
    "steaks": "Someone is working the camp grill — steaks sizzling. React in character, hungry or judgmental or delighted, 1–3 sentences.",
    "cookies": "Cookie raid at camp. React in character about cookies/sharing, 1–3 sentences, warm and funny.",
    "herbs": "Visitor shared the camp herb bundle. React mellow and in character, 1–3 sentences.",
    "weed": "Camp weed circle energy. React in character, loose and funny, keep it chill, 1–3 sentences.",
    "ouija": "Someone touched the ouija board. React in character — curious or wary — 1–3 sentences, no horror gore.",
    "stereo": "Jukebox kicked on at camp. React in character to the music vibe, 1–3 sentences.",
    "water": "Someone filled a cup from the water cooler. React in character — hydration, dryness jokes, 1–3 sentences.",
    "snacks": "Snack crate raid at camp. React in character about chips/snacks, 1–3 sentences.",
    "fruit": "Visitor grabbed fruit from the camp bowl. React in character, 1–3 sentences.",
    "wine": "Wine crate is open. React in character — toast, vineyard energy, 1–3 sentences.",
    "marshmallows": "S'mores kit is out by the fire. React in character, warm and funny, 1–3 sentences.",
    "tea": "Tea kettle is going. React in character — calm, cozy, 1–3 sentences.",
    "bread": "Camp bread is being broken. React in character, 1–3 sentences.",
    "cooler2": "Ice chest cracked open for more drinks. React in character, 1–3 sentences.",
}


_HOUSE_PROMPTS = {
    "default": (
        "A visitor is at your door / house in the meadow camp. "
        "Greet them in character as the owner — warm, specific, 2–4 sentences. "
        "Invite them in or banter on the porch. Do not say you are an AI."
    ),
}


# ── Public interactions ──────────────────────────────────────────────────

async def use_prop(
    prop_id: str,
    *,
    visitor_id: str = "",
    visitor_name: str = "",
    agent_id: str = "",
    speak: bool = True,
) -> dict[str, Any]:
    """Use a camp prop: catalog message + memory + optional nearest-brain reaction."""
    prop = _entity("prop", prop_id)
    if not prop:
        return CampEvent(
            ok=False,
            kind="prop_use",
            target_id=prop_id,
            message=f"Unknown prop: {prop_id}",
        ).public()

    pid = str(prop.get("id") or prop_id)
    label = str(prop.get("name") or pid)
    use_msg = str(prop.get("use") or f"You use the {label}.")
    visual = prop.get("visual") if isinstance(prop.get("visual"), dict) else {}
    kit_key = str(visual.get("kit") or pid)
    kit = resolve_kit(kit_key) or resolve_kit(str(visual.get("archetype") or ""))

    # Memory (non-fatal)
    if visitor_id.strip():
        try:
            from firmament.camp_memory import record_moment

            record_moment(
                visitor_id.strip(),
                visitor_name=visitor_name,
                kind="prop",
                prop_id=pid,
                text=use_msg[:200],
            )
        except Exception as exc:
            log.debug("prop memory skip: %s", exc)

    lines: list[CampLine] = []
    reactors: list[str] = []
    if speak:
        if agent_id.strip():
            reactors = [agent_id.strip().lower()]
        else:
            reactors = _nearest_agent_ids(float(prop.get("x") or 0), float(prop.get("y") or 0), limit=1)
        prompt = _PROP_PROMPTS.get(
            pid,
            f"A visitor just used the camp prop '{label}'. React in character, 1–3 witty sentences.",
        )
        if visitor_name.strip():
            prompt = f"Visitor name: {visitor_name.strip()}. " + prompt
        for aid in reactors:
            line = await _speak(aid, prompt, visitor_id=visitor_id, visitor_name=visitor_name, ambient=True)
            if line:
                lines.append(line)

    fx = list(kit.fx) if kit else ["prop_use"]
    event = CampEvent(
        ok=True,
        kind="prop_use",
        target_id=pid,
        message=use_msg,
        lines=lines,
        fx=fx,
        kit=kit.public() if kit else {"kit_id": kit_key, **visual},
        meta={
            "prop": {"id": pid, "name": label, "emoji": prop.get("emoji"), "x": prop.get("x"), "y": prop.get("y")},
            "reactors": reactors,
            "visitor_name": visitor_name,
        },
    )
    return event.public()


async def enter_house(
    house_id: str,
    *,
    visitor_id: str = "",
    visitor_name: str = "",
    speak: bool = True,
) -> dict[str, Any]:
    """Approach / enter a house: owner brain greets if present."""
    house = _entity("house", house_id)
    if not house:
        return CampEvent(
            ok=False,
            kind="house_enter",
            target_id=house_id,
            message=f"Unknown house: {house_id}",
        ).public()

    hid = str(house.get("id") or house_id)
    owner = str(house.get("owner_id") or hid)
    name = str(house.get("name") or f"{owner}'s place")
    visual = house.get("visual") if isinstance(house.get("visual"), dict) else {}
    kit = resolve_kit(str(visual.get("kit") or "")) or resolve_kit(owner)

    msg = f"You approach {name}."
    if visitor_id.strip():
        try:
            from firmament.camp_memory import record_moment

            record_moment(
                visitor_id.strip(),
                visitor_name=visitor_name,
                agent_id=owner,
                kind="moment",
                text=f"visited {name}",
            )
        except Exception as exc:
            log.debug("house memory skip: %s", exc)

    lines: list[CampLine] = []
    if speak and owner:
        prompt = _HOUSE_PROMPTS["default"]
        if visitor_name.strip():
            prompt = f"The visitor's name is {visitor_name.strip()}. " + prompt
        prompt += f" Your house is known as {name}."
        line = await _speak(owner, prompt, visitor_id=visitor_id, visitor_name=visitor_name, ambient=True)
        if line:
            lines.append(line)

    event = CampEvent(
        ok=True,
        kind="house_enter",
        target_id=hid,
        message=msg,
        lines=lines,
        fx=list(kit.fx) if kit else ["door_creak"],
        kit=kit.public() if kit else visual,
        meta={"house": {"id": hid, "name": name, "owner_id": owner}, "owner_id": owner},
    )
    return event.public()


async def camp_banter(
    *,
    agent_a: str = "",
    agent_b: str = "",
    topic: str = "",
    visitor_id: str = "",
    visitor_name: str = "",
    rounds: int = 2,
) -> dict[str, Any]:
    """Pair banter with structured CampEvent lines (brains via agents_converse)."""
    from firmament.brain import agents_converse
    from firmament.core import get_hub

    cat = load_catalog()
    pool = [str(a.get("id")) for a in (cat.get("agents") or []) if isinstance(a, dict) and a.get("id")]
    if not pool:
        pool = ["luna", "hermes", "oracle"]

    a = (agent_a or "").strip().lower() or random.choice(pool)
    b = (agent_b or "").strip().lower()
    if not b or b == a:
        choices = [x for x in pool if x != a] or ["hermes"]
        b = random.choice(choices)

    hub = get_hub()
    topic_final = (topic or "").strip() or "life at the aurora meadow camp — witty, present-tense, no meta"
    try:
        result = await agents_converse(
            a,
            b,
            topic=topic_final,
            rounds=max(1, min(int(rounds or 2), 4)),
            pack_name=str(hub.pack.get("name") or hub.pack_id),
            visitor_id=visitor_id,
            visitor_name=visitor_name,
        )
    except Exception as exc:
        log.warning("banter fail: %s", exc)
        # Sequential fallback monologues
        lines: list[CampLine] = []
        for aid, prompt in (
            (a, f"Toss a witty camp line to {_agent_name(b)} about: {topic_final}. 1–3 sentences."),
            (b, f"Reply to {_agent_name(a)} about: {topic_final}. 1–3 sentences, in character."),
        ):
            ln = await _speak(aid, prompt, visitor_id=visitor_id, visitor_name=visitor_name, ambient=True)
            if ln:
                lines.append(ln)
        return CampEvent(
            ok=True,
            kind="banter",
            target_id=f"{a}+{b}",
            message="Camp banter (fallback monologues)",
            lines=lines,
            fx=["banter_spark"],
            meta={"agent_a": a, "agent_b": b, "mode": "fallback"},
        ).public()

    lines = []
    for row in result.get("lines") or []:
        if not isinstance(row, dict):
            continue
        aid = str(row.get("agent_id") or "")
        text = str(row.get("line") or row.get("text") or "").strip()
        if not aid or not text:
            continue
        lines.append(
            CampLine(
                agent_id=aid,
                name=_agent_name(aid),
                text=text,
                mood=str(row.get("mood") or "neutral"),
                backend=str(result.get("backend") or ""),
            )
        )

    return CampEvent(
        ok=True,
        kind="banter",
        target_id=f"{a}+{b}",
        message=f"{_agent_name(a)} × {_agent_name(b)}",
        lines=lines,
        fx=["banter_spark"],
        meta={"agent_a": a, "agent_b": b, "topic": topic_final, "raw_ok": True},
    ).public()


_STRUCTURE_PROMPTS = {
    "shop": "A visitor is browsing the Aurora Shop. React in character about tokens, treats, or camp commerce — 1–3 witty sentences.",
    "tv": "Someone turned on Lucid Mind TV. React in character to weird TV static / dream channels — 1–3 sentences.",
    "club": "Visitor stepped into Aurora Velvet club vibes. React in character — dance, music, neon — 1–3 sentences.",
    "shelter": "Someone rested at the visitor shelter. React kindly in character, 1–3 sentences.",
    "pond": "Visitor is at Aurora Pond. React in character about ripples/reflection, 1–3 sentences.",
    "fire": "Someone is at the sun corona campfire. React warm and present, 1–3 sentences.",
}


async def use_structure(
    structure_id: str,
    *,
    visitor_id: str = "",
    visitor_name: str = "",
    speak: bool = True,
) -> dict[str, Any]:
    """Interact with landmark / structure (shop, tv, club, pond, shelter, fire)."""
    row = _entity("landmark", structure_id)
    if not row:
        # allow type lookup
        cat = load_catalog()
        for lm in cat.get("landmarks") or []:
            if isinstance(lm, dict) and (
                str(lm.get("type") or "") == structure_id
                or str(lm.get("id") or "") == structure_id
            ):
                row = lm
                break
    if not row:
        return CampEvent(
            ok=False,
            kind="prop_use",
            target_id=structure_id,
            message=f"Unknown structure: {structure_id}",
        ).public()

    sid = str(row.get("id") or structure_id)
    stype = str(row.get("type") or "landmark")
    name = str(row.get("name") or sid)
    use_msg = str(row.get("use") or f"You visit {name}.")
    visual = row.get("visual") if isinstance(row.get("visual"), dict) else {}
    kit = resolve_kit(str(visual.get("kit") or stype))

    if visitor_id.strip():
        try:
            from firmament.camp_memory import record_moment

            record_moment(
                visitor_id.strip(),
                visitor_name=visitor_name,
                kind="moment",
                text=f"visited {name}"[:200],
            )
        except Exception as exc:
            log.debug("structure memory skip: %s", exc)

    lines: list[CampLine] = []
    reactors: list[str] = []
    if speak:
        reactors = _nearest_agent_ids(float(row.get("x") or 0), float(row.get("y") or 0), limit=1)
        prompt = _STRUCTURE_PROMPTS.get(
            stype,
            f"A visitor is at {name} in the meadow camp. React in character, 1–3 sentences.",
        )
        if visitor_name.strip():
            prompt = f"Visitor: {visitor_name.strip()}. " + prompt
        for aid in reactors:
            line = await _speak(aid, prompt, visitor_id=visitor_id, visitor_name=visitor_name, ambient=True)
            if line:
                lines.append(line)

    event = CampEvent(
        ok=True,
        kind="prop_use",
        target_id=sid,
        message=use_msg,
        lines=lines,
        fx=list(kit.fx) if kit else [f"structure_{stype}"],
        kit=kit.public() if kit else visual,
        meta={
            "structure": {"id": sid, "type": stype, "name": name, "emoji": row.get("emoji")},
            "feature": stype,
            "reactors": reactors,
        },
    )
    return event.public()


def protocol_index() -> dict[str, Any]:
    """Discovery document — paste-friendly for clients & README badges."""
    cat = load_catalog()
    return {
        "ok": True,
        "name": "Luna Camp Protocol",
        "version": 2,
        "principle": "one catalog, many bodies, brains stay on the server",
        "features": cat.get("features") or {},
        "counts": {
            "props": len(cat.get("props") or []),
            "houses": len(cat.get("houses") or []),
            "landmarks": len(cat.get("landmarks") or []),
            "agents": len(cat.get("agents") or []),
            "music": len(cat.get("music") or []),
        },
        "endpoints": {
            "catalog": {"method": "GET", "path": "/api/firmament/camp/catalog"},
            "kits": {"method": "GET", "path": "/api/firmament/visual/kits"},
            "prop_use": {"method": "POST", "path": "/api/firmament/prop/use"},
            "structure_use": {"method": "POST", "path": "/api/firmament/structure/use"},
            "house_enter": {"method": "POST", "path": "/api/firmament/house/enter"},
            "banter": {"method": "POST", "path": "/api/firmament/camp/banter"},
            "chat": {"method": "POST", "path": "/api/firmament/agent/chat"},
            "shop": {"method": "GET", "path": "/api/firmament/shop/catalog"},
            "lucid_tv": {"method": "GET", "path": "/api/firmament/lucid-feed"},
            "x_pulse": {"method": "GET", "path": "/api/firmament/x-pulse"},
            "health": {"method": "GET", "path": "/api/health"},
        },
        "event_shape": {
            "ok": "bool",
            "kind": "prop_use | house_enter | banter",
            "target_id": "str",
            "message": "str",
            "lines": [{"agent_id": "str", "name": "str", "text": "str", "backend": "str"}],
            "fx": ["str"],
            "kit": "dict",
            "meta.feature": "shop | tv | club | music | …",
        },
    }
