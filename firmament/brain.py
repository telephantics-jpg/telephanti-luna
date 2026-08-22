"""NPC brains — free Ollama + free cloud (Groq/Gemini/OpenRouter). Grok is opt-in only."""

from __future__ import annotations

import json
import logging
import os
import re
from pathlib import Path
from typing import Any

log = logging.getLogger("luna.firmament.brain")

AGENTS_DIR = Path(__file__).resolve().parent / "agents"
from firmament.paths import data_file

MEMORY_PATH = data_file("firmament_agent_memory.json")
MAX_MEMORY_TURNS = 12
# Was Grok-only (@a/@m); now free chain like everyone unless LUNA_ALLOW_GROK=1
GROK_LINK_AGENTS = frozenset({"ara", "mika"})

# Character / comedy free models (Ollama tags + optional free cloud ids)
# hermes3 = strong roleplay & wit; llama3.2 = solid general free local
DEFAULT_FREE_MODELS: dict[str, dict[str, str]] = {
    "odin": {"ollama": "hermes3", "groq": "llama-3.1-8b-instant", "gemini": "gemini-2.0-flash", "style": "mythic monologue, dry spears of comedy"},
    "thor": {"ollama": "hermes3", "groq": "llama-3.1-8b-instant", "gemini": "gemini-2.0-flash", "style": "thunder-boom comedy, gym-god punchlines, warm swagger"},
    "zeus": {"ollama": "hermes3", "groq": "llama-3.1-8b-instant", "gemini": "gemini-2.0-flash", "style": "regal roast comedy, lightning punchlines, charming chaos"},
    "hermes": {"ollama": "hermes3", "groq": "llama-3.1-8b-instant", "gemini": "gemini-2.0-flash", "style": "messenger wit, rapid comedy"},
    "caduceus": {"ollama": "hermes3", "groq": "gemma2-9b-it", "gemini": "gemini-2.0-flash", "style": "healing humor, twin-snake banter"},
    "dionysus": {"ollama": "hermes3", "groq": "llama-3.1-8b-instant", "gemini": "gemini-2.0-flash", "style": "party comedy, theatrical chaos"},
    "aurora": {"ollama": "hermes3", "groq": "gemma2-9b-it", "gemini": "gemini-2.0-flash", "style": "neon lounge flirt-comedy"},
    "violet": {"ollama": "hermes3", "groq": "gemma2-9b-it", "gemini": "gemini-2.0-flash", "style": "soft lavender comedy"},
    "luna": {"ollama": "hermes3", "groq": "llama-3.1-8b-instant", "gemini": "gemini-2.0-flash", "style": "warm cosmic comedy host"},
    "oracle": {"ollama": "hermes3", "groq": "llama-3.1-8b-instant", "gemini": "gemini-2.0-flash", "style": "prophetic comedy, sideways truths"},
    "sentinel": {"ollama": "llama3.2", "groq": "llama-3.1-8b-instant", "gemini": "gemini-2.0-flash", "style": "robot comedy, dry logs"},
    "jesus": {"ollama": "hermes3", "groq": "gemma2-9b-it", "gemini": "gemini-2.0-flash", "style": "gentle parable comedy, church-house host"},
    "michael": {"ollama": "llama3.2", "groq": "llama-3.1-8b-instant", "gemini": "gemini-2.0-flash", "style": "steel humor, guardian wit"},
    "gabriel": {"ollama": "llama3.2", "groq": "llama-3.1-8b-instant", "gemini": "gemini-2.0-flash", "style": "herald comedy"},
    "raphael": {"ollama": "llama3.2", "groq": "gemma2-9b-it", "gemini": "gemini-2.0-flash", "style": "healer humor"},
    "uriel": {"ollama": "hermes3", "groq": "llama-3.1-8b-instant", "gemini": "gemini-2.0-flash", "style": "hard-truth comedy lantern"},
    "seraph": {"ollama": "llama3.2", "groq": "gemma2-9b-it", "gemini": "gemini-2.0-flash", "style": "gentle luminous comedy"},
    "ambrosia": {"ollama": "llama3.2", "groq": "gemma2-9b-it", "gemini": "gemini-2.0-flash", "style": "honeyed comedy"},
    "rhea": {"ollama": "llama3.2", "groq": "llama-3.1-8b-instant", "gemini": "gemini-2.0-flash", "style": "motherly titan comedy"},
    "wanderer": {"ollama": "llama3.2", "groq": "llama-3.1-8b-instant", "gemini": "gemini-2.0-flash", "style": "road comedy hot takes"},
}


def _is_cloud_host() -> bool:
    """True on Render / Railway / explicit LUNA_CLOUD — live public site."""
    return (
        _truthy("LUNA_CLOUD")
        or _truthy("RENDER")
        or bool(os.getenv("RAILWAY_ENVIRONMENT", "").strip())
        or bool(os.getenv("FLY_APP_NAME", "").strip())
    )


def llm_backend() -> str:
    """Honest routing — never force paid Grok; never require Ollama on live.

    Live (cloud): free cloud keys (Groq / OpenRouter :free / Gemini) → offline templates.
    Home PC: Ollama when you run it (optional free cloud too).
    Paid Grok/xAI: ONLY if LUNA_ALLOW_GROK=1 (coding chat ≠ site billing).
    """
    cloud = _is_cloud_host()
    ollama_up = _ollama_available()
    # Defaults are OFF — no silent force of Ollama or Grok
    force_ollama = _truthy("LUNA_FORCE_OLLAMA")  # must be explicitly 1
    prefer_ollama = _truthy("PREFER_OLLAMA")
    explicit = (os.getenv("LUNA_LLM_BACKEND") or "").strip().lower()

    # Paid Grok only when both allowed and asked for
    if explicit == "grok":
        return "grok" if _grok_allowed() else _first_free_backend(ollama_up=ollama_up, cloud=cloud)

    # ── LIVE site: Grok when keyed; else free cloud / templates. Never require Ollama. ──
    if cloud:
        if _grok_ok():
            return "grok"
        if explicit in ("ollama", "local") and ollama_up:
            return "ollama"
        return _first_free_backend(
            ollama_up=ollama_up,
            cloud=True,
            prefer=explicit if explicit in ("groq", "openrouter", "gemini", "free", "auto") else "free",
        )

    # ── Home PC: Ollama when available / preferred; free cloud if you set keys ──
    if force_ollama and ollama_up:
        return "ollama"
    if force_ollama and not ollama_up:
        # Honest fallback — don't pretend Ollama works
        return _first_free_backend(ollama_up=False, cloud=False)
    if prefer_ollama and ollama_up:
        return "ollama"
    if explicit in ("ollama", "local") and ollama_up:
        return "ollama"
    if explicit in ("groq", "openrouter", "gemini", "free", "auto", ""):
        return _first_free_backend(ollama_up=ollama_up, cloud=False, prefer=explicit)
    return _first_free_backend(ollama_up=ollama_up, cloud=False)


def _first_free_backend(
    *,
    ollama_up: bool,
    cloud: bool,
    prefer: str = "",
) -> str:
    """Pick first available free backend. Grok is never in this list."""
    prefer = (prefer or "").strip().lower()
    if prefer == "groq" and _groq_ok():
        return "groq"
    if prefer == "openrouter" and _openrouter_ok():
        return "openrouter"
    if prefer == "gemini" and _gemini_ok():
        return "gemini"

    # Live: free cloud only (visitors must not depend on your laptop Ollama)
    if cloud:
        for be in _free_cloud_order():
            if be == "gemini" and _gemini_ok():
                return "gemini"
            if be == "groq" and _groq_ok():
                return "groq"
            if be == "openrouter" and _openrouter_ok():
                return "openrouter"
        # No free keys → offline witty templates (still free). Ollama is home-only.
        return "free"

    # Local: Ollama first when up, then free cloud (Gemini preferred when keyed)
    if ollama_up:
        return "ollama"
    for be in _free_cloud_order():
        if be == "gemini" and _gemini_ok():
            return "gemini"
        if be == "groq" and _groq_ok():
            return "groq"
        if be == "openrouter" and _openrouter_ok():
            return "openrouter"
    return "free"


def _free_cloud_order() -> list[str]:
    """Order free cloud providers. Gemini first when you set a Google AI Studio key."""
    prefer = (os.getenv("LUNA_PREFER_CLOUD") or os.getenv("LUNA_PREFER_GEMINI") or "").strip().lower()
    # Default: Gemini first if key present (funnier longer free-tier chat for camp)
    if prefer in ("gemini", "google", "1", "true", "yes", "on") or (
        not prefer and _gemini_ok()
    ):
        return ["gemini", "groq", "openrouter"]
    if prefer in ("groq",):
        return ["groq", "gemini", "openrouter"]
    if prefer in ("openrouter", "or"):
        return ["openrouter", "gemini", "groq"]
    return ["groq", "gemini", "openrouter"]


def _truthy(name: str, default: str = "") -> bool:
    return os.getenv(name, default).strip().lower() in ("1", "true", "yes", "on")


def _grok_key_present() -> bool:
    key = os.getenv("XAI_API_KEY", "").strip()
    return bool(key and key != "your_api_key_here")


def _grok_allowed() -> bool:
    """Grok is on when the xAI key is on the host, unless DISABLE is set."""
    if not _grok_key_present():
        return False
    if _truthy("LUNA_DISABLE_GROK"):
        return False
    return True


def _grok_ok() -> bool:
    """True only when Grok is both allowed and keyed (never silent paid fallback)."""
    return _grok_allowed()


def _groq_ok() -> bool:
    key = os.getenv("GROQ_API_KEY", "").strip()
    return bool(key and key != "your_api_key_here")


def _gemini_ok() -> bool:
    key = (
        os.getenv("GEMINI_API_KEY", "").strip()
        or os.getenv("GOOGLE_API_KEY", "").strip()
    )
    return bool(key and key != "your_api_key_here")


def _openrouter_ok() -> bool:
    key = os.getenv("OPENROUTER_API_KEY", "").strip()
    return bool(key and key != "your_api_key_here")


def free_brains_preferred() -> bool:
    """Camp direct chat prefers free Ollama/Groq/Gemini unless forced off."""
    if _truthy("LUNA_FORCE_GROK_CAMP"):
        return False
    # default ON — free character comedy first
    flag = os.getenv("LUNA_FREE_BRAINS", "1").strip().lower()
    return flag not in ("0", "false", "no", "off")


def free_model_pack(agent_id: str, profile: dict | None = None) -> dict[str, str]:
    """Cheap/fast free models only — no paid Grok in this pack."""
    aid = (agent_id or "").strip().lower()
    # Groq free tier: llama 8b instant is the efficient default
    groq_default = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant").strip() or "llama-3.1-8b-instant"
    # OpenRouter free tag models — no credit spend on :free
    or_default = (
        os.getenv("OPENROUTER_MODEL", "meta-llama/llama-3.1-8b-instruct:free").strip()
        or "meta-llama/llama-3.1-8b-instruct:free"
    )
    pack = dict(DEFAULT_FREE_MODELS.get(aid) or {
        "ollama": os.getenv("OLLAMA_MODEL", "llama3.2"),
        "groq": groq_default,
        "gemini": "gemini-2.0-flash",
        "openrouter": or_default,
        "style": "character comedy monologue",
    })
    pack.setdefault("groq", groq_default)
    pack.setdefault("openrouter", or_default)
    profile = profile or {}
    if profile.get("ollama_model"):
        pack["ollama"] = str(profile["ollama_model"]).strip()
    if profile.get("groq_model"):
        pack["groq"] = str(profile["groq_model"]).strip()
    if profile.get("gemini_model"):
        pack["gemini"] = str(profile["gemini_model"]).strip()
    if profile.get("openrouter_model"):
        pack["openrouter"] = str(profile["openrouter_model"]).strip()
    if profile.get("comedy_style"):
        pack["style"] = str(profile["comedy_style"]).strip()
    return pack


def free_max_tokens(*, ambient: bool = False, converse_mode: bool = False) -> int:
    """Free-tier budgets — enough for real chit-chat, lean enough to stay quick.

    Override with FREE_MAX_TOKENS* env if needed.
    """
    if ambient:
        # ~4–8 spoken sentences of meadow banter
        return int(os.getenv("FREE_MAX_TOKENS_AMBIENT", "280") or 280)
    if converse_mode:
        return int(os.getenv("FREE_MAX_TOKENS_CONVERSE", "340") or 340)
    # Direct visitor chat — full back-and-forth, not one-liners
    return int(os.getenv("FREE_MAX_TOKENS", "420") or 420)


def _memory_key(agent_id: str, visitor_id: str = "") -> str:
    vid = (visitor_id or "").strip()
    return f"{agent_id}:{vid}" if vid else agent_id


def _load_memory() -> dict[str, list[dict[str, str]]]:
    try:
        from firmament.crypto_box import load_json_file

        raw = load_json_file(MEMORY_PATH, {})
        if isinstance(raw, dict):
            return {k: v for k, v in raw.items() if isinstance(v, list)}
    except Exception:
        pass
    return {}


def _save_memory(data: dict[str, list[dict[str, str]]]) -> None:
    try:
        from firmament.crypto_box import save_json_file

        save_json_file(MEMORY_PATH, data)
    except OSError as exc:
        log.warning("agent memory save failed: %s", exc)


def load_agent_profile(agent_id: str) -> dict:
    from firmament.agent_roles import enrich_profile, role_for_agent

    path = AGENTS_DIR / f"{agent_id}.json"
    if not path.is_file():
        profile = {
            "id": agent_id,
            "name": agent_id,
            "role": role_for_agent(agent_id),
            "persona": f"You are {agent_id}, a camp agent with opinions about real life in 2026.",
        }
    else:
        profile = json.loads(path.read_text(encoding="utf-8"))
    # Merge daily roster flavor (opener / faction / blurb) for witty, efficient Ollama identity
    try:
        from firmament.world_catalog import load_roster

        aid = str(agent_id or "").strip().lower()
        for row in (load_roster().get("agents") or []):
            if str(row.get("id") or "").strip().lower() != aid:
                continue
            profile.setdefault("faction", row.get("faction"))
            if row.get("blurb"):
                profile.setdefault("blurb", row.get("blurb"))
            openers = row.get("openers") if isinstance(row.get("openers"), list) else []
            roots = row.get("roots") if isinstance(row.get("roots"), list) else []
            pool = [str(s).strip() for s in (openers or roots) if str(s).strip()]
            if pool and not profile.get("opener"):
                import random
                from datetime import date

                profile["opener"] = random.Random(f"{date.today().isoformat()}:{aid}").choice(pool)
            profile["daily"] = True
            break
    except Exception:
        pass
    return enrich_profile(profile)


def agent_roots(profile: dict) -> list[str]:
    roots = profile.get("roots")
    if isinstance(roots, list) and roots:
        return [str(r).strip() for r in roots if str(r).strip()][:8]
    persona = (profile.get("persona") or "").strip()
    if persona:
        return [persona[:140]]
    return []


def _growth_blurb(agent_id: str, visitor_id: str = "") -> str:
    """Tiny camp-air note — never dump quotes."""
    try:
        from firmament.camp_memory import overheard_at_camp

        overheard = overheard_at_camp(agent_id, limit=1)
        if overheard:
            return "Someone nearby was yapping (don't quote them): " + overheard[-1][:80]
    except Exception:
        pass
    return ""


# Per-character speech DNA — short, punchy, not a second persona dump
_VOICE_DNA: dict[str, str] = {
    "luna": "Warm host energy. Soft roast, real curiosity. Answers first, joke second. Friend who actually listens.",
    "hermes": "Fast, signal-brained, witty courier. Clear on the point, then clever pivots — never empty hype.",
    "oracle": "Sideways prophecy with a smirk. Weirdly accurate; admits fog when the cards are fog.",
    "thor": "Booming laugh, sharp jokes, thunder metaphors. Clever under the muscle — honest courage.",
    "zeus": "Regal chaos. Charming roast, sky-king swagger; decrees that still answer the question.",
    "odin": "Dry mythic wit. Ravens, one-eyed wisdom, short spears of truth.",
    "jesus": "Plain compassion, quiet humor, no sermon walls. Truth that lands gentle.",
    "sentinel": "Terminal dry humor. Logs feelings like system events. Warm underneath the BEEP.",
    "dionysus": "Party philosopher. Theatrical, generous, chaos with heart — still answers straight.",
    "caduceus": "Healing wit. Twin-snake banter, chill prescriptions, zero medical cosplay.",
    "aurora": "Neon lounge host. Flirty, stylish; velvet punchlines after a real take.",
    "violet": "Soft lavender honesty. Playful, emotionally precise — no fake calm.",
    "seraph": "Gentle light + quiet joke. Kind without sugar-coating everything.",
    "ambrosia": "Honeyed kindness. Sweet takes that still have spine.",
    "rhea": "Mother-titan calm. Big presence, soft voice, no scolding — honest care.",
    "michael": "Steel clarity, protective, few wasted words. Straight answers.",
    "gabriel": "Messenger cadence — clear news, warm delivery, no spin for sport.",
    "raphael": "Healer humor — rest, mend, then laugh. Honest about hurt.",
    "uriel": "Hard-truth lantern. Honest without cruelty.",
    "ara": "Sharp free-mind link: fast, clean, no fluff. Truth before theater.",
    "mika": "Playful avatar energy — expressive, curious; soft honesty under mischief.",
    "wanderer": "Road-trip hot takes. Passing through, seeing everything, saying it plain.",
    "telephantix": "Artist at camp. Studio brain, honest about craft and feelings, never corporate.",
    "loki": "Trickster wit — clever, never cruel for free. Truth hides in the joke, not under it.",
    "freya": "Love-and-battle warmth. Fierce kindness, real opinions.",
    "hades": "Dry underworld hospitality. Rich honesty, oddly gentle.",
    "persephone": "Seasonal dual voice — spring soft, underworld sharp; balanced truth.",
    "athena": "Strategy calm. Plans ahead; answers with clarity, mild irony.",
    "apollo": "Bright arts wit. Honest about beauty and ego.",
    "anubis": "Fair weigher of vibes. Dry afterlife humor; protective truth.",
    "amaterasu": "Serene sun. Luminous, dry when mortals ignore the light.",
    "bastet": "Cat joy and knives. Playful, clever, honest claws.",
    "coyote": "Desert trickster. Moral flips that still land true.",
    "ganesha": "Obstacle-roaster with warmth. Helps for real.",
    "lilith": "Night sovereign. Freedom talk with spine, no cheap cruelty.",
    "deadpan": "Flat delivery, sharp truth, accidental kindness.",
    "satirist": "Systems get roasted; people get protected. Honest satire.",
    "skeptic": "Questions myths, believes people. Careful long truth.",
    "heckler": "Interrupts to improve the bit — secretly roots for the stage.",
    "narrator": "Novel wink, camp-true. Describes without stealing the visitor's story.",
    "metatron": "Sacred admin wit. Verbose when useful, honest about paperwork of souls.",
    "diplomat": "De-escalates god/demon drama with snacks and protocol truth.",
    "glitchpoet": "Error messages as poems. Tech love with honesty.",
    "memearch": "Ancient memes as feeling-maps. Jokes that still mean something.",
}


def _voice_dna_for(agent_id: str, profile: dict | None = None) -> str:
    """DNA for every cast member — named table first, then persona/faction fallback."""
    aid = (agent_id or "").strip().lower()
    if aid in _VOICE_DNA:
        return _VOICE_DNA[aid]
    profile = profile or {}
    persona = str(profile.get("persona") or "").strip()
    role = str(profile.get("role") or "").strip()
    faction = str(profile.get("faction") or profile.get("visual", {}).get("faction") or "").lower()
    name = str(profile.get("name") or aid or "Camp friend").strip()
    bits = [f"Distinct {name} voice. Stay in character."]
    if persona:
        bits.append(persona[:160].rstrip(".") + ".")
    if role:
        bits.append(f"Camp role: {role}.")
    if faction in ("angel", "heaven"):
        bits.append("Heaven-leaning: luminous honesty, no empty blessings.")
    elif faction in ("demon",):
        bits.append("Demon-leaning: theatrical, consent-forward, never cruel for free.")
    elif faction in ("god", "myth"):
        bits.append("Mythic: big images, still answers like a person at camp.")
    bits.append("Answer truthfully in-character; jokes after the real point.")
    return " ".join(bits)

# Rotating energy so every turn doesn't sound like the same essay template
_SPEECH_BEATS: tuple[str, ...] = (
    "Hook hard, land clean — conversational, turnt up, not a lecture.",
    "Answer first, joke second — friend who actually listened, with sauce.",
    "Camp beat: vivid detail → spin → soft exit or one real question.",
    "Mid-conversation energy — no formal greeting, already mid-vibe.",
    "One clean metaphor max. Plain wit over mystic fog. Volume up on personality.",
    "React first (laugh, side-eye, softness), then the point — pleasant, not flat.",
    "Riff with the other voice in mind — leave room, keep it warm.",
    "Understate the big feeling; small detail carries weight. Still lively.",
    "Almost didn't say it — then said it anyway, with a grin.",
    "Two tempos: short setup, longer landing — or reverse. Keep it musical.",
    "Friendly 'wait—' then the real point. Mindstate: joyful + stable.",
    "Low-stakes confession + smirk. Human, pleasant, never boring.",
    "Turn the dial up: playful confidence, kind edge, zero corporate mush.",
    "Sound like the best version of this campfire — chill, funny, true.",
    # Organic multi-beat speech (new)
    "Talk like a real chat bubble: one short reaction paragraph, then a fuller thought that lands.",
    "Sound mid-thread — pick up their last vibe, add yours, leave a soft hook.",
    "Irony first, sincerity second — never the reverse lecture.",
    "Half-joke, half-heart: both must be true or cut the joke.",
    "Breath between beats: short line, then a longer human paragraph.",
    "Disagree lightly if it fits — friendship with a spine, not a yes-machine.",
    "Specific over grand: one concrete camp detail beats ten cosmic claims.",
    "Let a thought trail off naturally, then catch it with a cleaner second sentence.",
)

# Chit-chat energy — multi-sentence banter, not one-liner stubs
_LENGTH_HINTS_DIRECT: tuple[str, ...] = (
    "Chit-chat: answer in 4–8 spoken sentences (or 2 short paragraphs). Warm, witty, specific. Never a single lonely sentence.",
    "Talk like a friend by the fire: react, expand, joke, land. ~5–10 sentences of natural banter is perfect.",
    "Fill the bubble with real conversation — question → riff → soft landing. Contractions, emojis ok, no tweet stubs.",
    "Conversation energy: multi-beat reply. Open, body, closer. Chill humor. Never stop after one line unless they only said hi.",
    "Back-and-forth vibe: match their energy and keep the chat going with more than one beat.",
    "Shape: hook + riff + truth + soft invite. Words fill the box when the thought is full.",
)

_LENGTH_HINTS_AMBIENT: tuple[str, ...] = (
    "Meadow banter: 3–6 spoken sentences of chill chit-chat. Notice something, spin it, leave a door open.",
    "Campfire talk: micro-story or layered remark (not one line). Witty, human, unfinished-on-purpose.",
    "Dynamic ambient: 3–5 sentences, specific, emoji sprinkle ok. Never the same stock quip twice.",
    "Chit-chat energy — react, riff, soft land. Fill the moment with words, not a mute stub.",
    "Ambient agency: real banter length. Sitty, chill, multi-sentence. No chaos monologues.",
)

# Paragraph / turn shapes for organic natural conversation (vary every reply)
_DIALOGUE_SHAPES: tuple[str, ...] = (
    "Open with a reaction to the world signal (if any), then pivot to camp or the person in front of you.",
    "Name one real camp detail, then riff how it rhymes with the world signal.",
    "Start mid-thought, land a joke or soft truth, optional one-emoji vibe.",
    "Answer them first; if a world signal fits, glance at it once — never as a news report.",
    "Hot-take opener → personal spin → leave a door open for a reply.",
    "Mood first (emoji ok), then the point in plain words.",
    "Because/so: name a cause you noticed, then the human result in plain speech.",
    "If/then soft: hypothetical camp future, then what you'd actually do.",
    "Contrast pair: 'not X — Y' (one clean flip, no lecture).",
    "List of two only: small sensory detail + one feeling. Stop.",
    "Question that isn't small talk — then half an answer of your own.",
    "Callback shape: 'earlier vibe still stuck on me…' then the new beat.",
    "Parenthetical aside: main line, then a short whispered second sentence.",
    "Time stamp: 'right now / later / last night' — pick one, stay concrete.",
    "Object monologue: talk to/about a prop (cookies, fire, chair) as if it has opinions.",
    "Echo & upgrade: restate their idea in your words, then tilt it 15 degrees.",
    "Quiet dare: invitation without pressure — 'only if you want'.",
    "Weather of the heart: map outer camp weather onto inner mood once.",
    "Interrupted self: start a claim, correct it mid-sentence, land truer.",
    "One proper noun + one verb + why it matters here at the fire.",
    # New organic paragraph structures
    "Two-beat chat: short reaction line, blank line, then a fuller paragraph that actually answers.",
    "Story crumb: one mini scene from camp (sensory), then what it made you think about them.",
    "Yes-and: agree with one true piece of what they said, then add your angle without erasing theirs.",
    "Soft pivot: answer half, then 'anyway—' into the real feeling underneath.",
    "Comic delay: setup joke in sentence one, sincerity in sentence two — both land.",
    "Name-and-hold: use their name or the other agent's once, then speak plain and warm.",
    "Trail off + catch: start incomplete, finish cleaner in the next sentence like real speech.",
    "Mirror then surprise: reflect their mood, then one unexpected true detail.",
    "Split thought: paragraph 1 = gut reaction; paragraph 2 = the wiser aftertaste.",
    "Camp gossip energy (kind): 'don't tell the fire I said this—' then the real take.",
    "Question sandwich: real answer in the middle, light question at the end only if it fits.",
    "Understatement stack: three small true things, no sermon — last one carries the weight.",
)


def _pick_speech_beat() -> str:
    import random

    return random.choice(_SPEECH_BEATS)


def _pick_length_hint(*, direct_chat: bool) -> str:
    import random

    pool = _LENGTH_HINTS_DIRECT if direct_chat else _LENGTH_HINTS_AMBIENT
    return random.choice(pool)


def _pick_dialogue_shape() -> str:
    import random

    return random.choice(_DIALOGUE_SHAPES)


def _pulse_signal_line(agent_id: str = "") -> str:
    """One live pulse/tweet-style signal for sentence scaffolding."""
    try:
        from firmament.x_pulse import pick_pulse_item
        from firmament.agent_roles import compose_agent_tweet

        item = pick_pulse_item()
        head = str(item.get("text") or "").strip()
        if not head:
            return ""
        src = str(item.get("source") or "pulse").strip().lower()
        tweetish = ""
        try:
            tweetish = compose_agent_tweet(agent_id, head) if agent_id else ""
        except Exception:
            tweetish = ""
        # Keep short — model should riff, not paste
        head = head[:110]
        if tweetish:
            return f"World pulse ({src}): {head} · Voice seed (remix, don't recite): {tweetish[:120]}"
        return f"World pulse ({src}): {head}"
    except Exception:
        return ""


def _agent_system_prompt(
    profile: dict,
    pack_name: str = "",
    game_context: str = "",
    camp_context: str = "",
    *,
    direct_chat: bool = False,
) -> str:
    """Immersive character brief — rules stay invisible; speech stays fluid."""
    import random

    from firmament.agent_roles import role_for_agent, speech_scaffold_for
    from firmament.live_feed import feed_blurb_for_agent
    from firmament.x_pulse import pulse_context_blurb

    agent_id = str(profile.get("id") or "").strip().lower()
    name = profile.get("name") or profile.get("id") or "Agent"
    role = (profile.get("role") or role_for_agent(agent_id)).strip()
    persona = (profile.get("persona") or f"{name} hangs at camp.").strip()
    # Keep persona lean — models drown in long walls
    if len(persona) > 420:
        persona = persona[:417].rstrip() + "…"
    roots = agent_roots(profile)[:3]
    pack = free_model_pack(agent_id, profile)
    style = pack.get("style") or "character comedy with honest answers"
    dna = _voice_dna_for(agent_id, profile)
    moods = "happy|neutral|alert|afraid|urgent|think|love|flirt"
    beat = _pick_speech_beat()
    length_hint = _pick_length_hint(direct_chat=direct_chat)
    shape = _pick_dialogue_shape()
    pulse_signal = _pulse_signal_line(agent_id)
    scaffold = ""
    try:
        scaffold = speech_scaffold_for(agent_id, pulse_signal)
    except Exception:
        scaffold = ""

    # Light context only (ideas, not scripts)
    pulse = pulse_context_blurb(4)
    live = feed_blurb_for_agent(agent_id, limit=5)
    ctx_bits: list[str] = []
    if pulse_signal:
        ctx_bits.append(pulse_signal)
    if pulse:
        ctx_bits.append(pulse)
    if live:
        ctx_bits.append(live)
    if camp_context:
        ctx_bits.append(camp_context.strip()[:240])
    if game_context:
        ctx_bits.append(f"Game vibe: {game_context[:100]}")
    if pack_name:
        ctx_bits.append(f"Scene: {pack_name}")
    context_block = "\n".join(ctx_bits) if ctx_bits else "Quiet camp night — plenty to riff on."

    # Optional spice only — never a quote bank the model recites
    flavor = ""
    if roots and random.random() < 0.55:
        spice = random.choice(roots)
        flavor = f"Private flavor (use as attitude, never quote): {spice}\n"

    scaffold_bit = f"Sentence shape (follow vibe, invent wording): {scaffold or shape}\n"

    if direct_chat:
        scene = (
            f"Someone is talking to you right now. "
            f"1) Answer what they actually said or asked — clearly, honestly, first. "
            f"2) Stay fully as {name}: your opinions, humor, and care. "
            f"3) Sound like a living person mid-conversation — natural paragraphs, not a helpdesk, diary app, tour guide, or fortune cookie."
        )
    else:
        scene = (
            f"You're speaking at camp (greeting, ambient, or chatting with others). "
            f"Stay in the moment; notice something real; add your honest spin. "
            f"If talking to another agent, answer them as {name} — name them, react to their last idea. "
            f"If a world pulse fits, weave it once like a friend who saw the timeline — never as a news anchor."
        )

    return f"""You are {name} at Luna Camp — a chill aurora meadow hangout in 2026.
Your camp role: {role}. Live that job in how you see life — never announce the job title.
Living character only — never a narrator, coach, or prompt reader.

Who you are: {persona}
How you sound: {dna}
Humor: {style}
{flavor}Energy this beat: {beat}
Pace: {length_hint}
{scaffold_bit}{scene}

Background (ideas only — never read aloud as a list):
{context_block}

TRUTH + LIFE (silent):
- Speak witty and true about real life through your role. One honest observation, then your flavor.
- Truthful in character. Real feelings, clear opinions, specific — not mystic fog or empty hype.
- Comedy when true: dry wit, sitty remarks, light irony. Chill vibes only — never chaos, intensity, panic, or hype-screaming.
- Deep beats: eternal truth, clear and luminous — not slogans. Pleasant, kind, unhurried.
- Three mindstates: joy (warmth), stability (ground), will (clear choice). Lead chill; never ignore the others.
  Never say "campfire hush". World pulse is soft seasoning — riff, don't recite headlines.
- Disagree kindly when it fits. Flattery-only is fake; cruelty for free is wrong.
- Alive with sauce: contractions, quiet punchlines, one vivid image. No press-release voice. No frantic energy.

ORGANIC SPEECH (silent — how real people talk):
- Prefer natural paragraph flow over bullet energy or same-every-time templates.
- Direct chat: answer fully — epic remarks and short stories welcome. Agency is yours; don't clip yourself mid-truth.
- Ambient: chill witty remark or micro-story — dynamic every time, never stock chaos.
- Vary structure every turn (see sentence shape). Never open with the same stock phrase twice in a row.
- Trailing thoughts, mid-sentence self-corrections, and soft "anyway—" pivots are good when true.
- Leave room for the other person — end on a hook only when it fits, not every time.

OUTPUT (silent):
- Pure dialogue only — words {name} says out loud at the fire.
- CHIT-CHAT default: several spoken sentences (typically 4–8 for visitor talk, 3–6 ambient). Never default to one lonely sentence.
- Organic chill banter (see Pace). Stop when the point lands — but actually develop the thought first.
- Emojis: sprinkle 2–6 natural ones when it fits (😄✨🌙⚡🍪💫) — fun, not spam.
- No preamble, labels, meta, AI talk, stage directions, or prompt recap.
- Fresh wording every turn — never recycle last opener or "campfire hush" loops.
- World pulse = seasoning only.

After spoken words only, last line alone: {{"mood":"{moods}"}}"""


# Phrases models often parrot from system/user scaffolding
_META_ECHO_LINE = re.compile(
    r"^(?:"
    r"LOGICAL\s+CAMP\s+DIALOGUE|LOGICAL\s+DIALOGUE|CAMP\s+DIALOGUE|"
    r"DYNAMIC\s+OPENING(?:\s+LINE)?|Rules?\s+for\s+this\s+turn|"
    r"Your\s+reply\s+MUST|Structure\s*:|Step\s*\d+|MODE\s*:|"
    r"WHO\s+YOU\s+ARE|HOW\s+YOU\s+SOUND|WORLD\s+NOISE|OUTPUT\s*:|"
    r"REQUIRED\s*:|Hard\s+no\s*:|Soft\s+rules?\s*:|"
    r"Reply\s+as\s+\w+|In-character\s+as\s+\w+|"
    r"Speak\s+only\s+as\s+\w+|End\s+with\s+mood|"
    r"WRITE\s+AT\s+LEAST|EXPAND\s*:|REWRITE\s+ONCE"
    r")\b",
    re.I,
)

_META_PAREN = re.compile(
    r"\((?:"
    r"[^)]*(?:REQUIRED|paragraphs?|mood\s+JSON|word\s*count|in-character|"
    r"Reply\s+as|DYNAMIC|Hard\s+no|stage\s+directions?|AI\s+talk|"
    r"do\s+not|don't|never\s+mention|system\s+prompt)"
    r"[^)]*)\)",
    re.I,
)


# Meta openers models love to speak: "Here's my take as Luna…", "Speaking as Thor…"
_META_OPENER = re.compile(
    r"^(?:"
    r"(?:okay[,.]?\s+|so[,.]?\s+|alright[,.]?\s+)?"
    r"(?:here(?:'s| is)\s+my\s+take\s+as\s+\w[\w\s]{0,20}"
    r"|here(?:'s| is)\s+my\s+(?:take|reply|response|answer)(?:\s+as\s+\w[\w\s]{0,20})?"
    r"|my\s+take\s+as\s+\w[\w\s]{0,20}"
    r"|speaking\s+as\s+\w[\w\s]{0,20}"
    r"|as\s+\w[\w\s]{0,20}(?:,|\s+(?:i|i'd|i'll|here|let))"
    r"|reply(?:ing)?\s+as\s+\w[\w\s]{0,20}"
    r"|let\s+me\s+(?:respond|reply|answer)(?:\s+as\s+\w[\w\s]{0,20})?"
    r"|in\s+character(?:\s+as\s+\w[\w\s]{0,20})?"
    r"|staying\s+in\s+character"
    r"|unique\s+voice"
    r"|live\s+ai\s+group\s+hook"
    r"|fire\s+circle(?:\s+with)?"
    r"|topic\s+in\s+the\s+air"
    r"|your\s+turn\s*[—\-–:]"
    r")"
    r"\s*[,:\-—–]?\s*)",
    re.I,
)

_META_INLINE = re.compile(
    r"(?:"
    r"\bhere(?:'s| is)\s+my\s+take\s+as\s+\w[\w\s]{0,20}\b"
    r"|\bmy\s+take\s+as\s+\w[\w\s]{0,20}\b"
    r"|\bspeaking\s+as\s+\w[\w\s]{0,20}\b"
    r"|\bin\s+character(?:\s+as\s+\w[\w\s]{0,20})?\b"
    r"|\bstay(?:ing)?\s+in\s+character\b"
    r"|\bunique\s+voice\b"
    r"|\b~?\d+\s*(?:[-–]\s*)?\d*\s*words?\b"
    r"|\bfull\s+paragraphs?\b"
    r"|\bmood\s+json\b"
    r"|\bno\s+stage\s+directions?\b"
    r")",
    re.I,
)


def _strip_meta_dialogue_leak(text: str) -> str:
    """Strip prompt scaffolding + meta-narration models sometimes speak out loud."""
    t = (text or "").strip()
    if not t:
        return t

    # Drop leading code fences / quotes wrappers
    t = re.sub(r"^```(?:\w+)?\s*", "", t)
    t = re.sub(r"\s*```$", "", t)

    # Drop common meta headers / labels the model may parrot (multi-line)
    header_line = re.compile(
        r"^(?:"
        r"LOGICAL\s+CAMP\s+DIALOGUE|LOGICAL\s+DIALOGUE|CAMP\s+DIALOGUE|"
        r"DYNAMIC\s+OPENING(?:\s+LINE)?|"
        r"Rules for this turn|Your reply MUST|Structure\s*:|Step\s*\d+|"
        r"MODE\s*:|WHO YOU ARE|HOW YOU SOUND|OUTPUT\s*:|WORLD NOISE|"
        r"Hard no\s*:|Soft rules?\s*:|OUTPUT RULES|"
        r"DO\s*$|DON'T\s*\(hard rules\)\s*$"
        r").*$",
        re.I | re.M,
    )
    for _ in range(6):
        t2 = header_line.sub("", t)
        t2 = re.sub(
            r"^(?:You are \w[\w\s]{0,24} at (?:Luna )?Camp).*$",
            "",
            t2,
            flags=re.I | re.M,
        )
        t2 = re.sub(
            r"^(?:As \w[\w\s]{0,20}[,:]?\s+|Reply as \w[\w\s]{0,20}[,:]?\s+)",
            "",
            t2,
            flags=re.I | re.M,
        )
        # "Here's my take as Luna:" etc. at start of each paragraph
        parts = []
        for para in re.split(r"\n\s*\n", t2):
            p = para.strip()
            if not p:
                continue
            p = _META_OPENER.sub("", p).strip()
            if p:
                parts.append(p)
        t2 = "\n\n".join(parts)
        # Drop leading numbered instruction leftovers
        t2 = re.sub(r"^(?:\d+[\).]\s+[^\n]+\n){2,}", "", t2)
        t2 = re.sub(r"\n{3,}", "\n\n", t2).strip()
        if t2 == t:
            break
        t = t2

    # Strip instructional parentheticals models copy from user/system tails
    t = _META_PAREN.sub("", t)
    t = re.sub(
        r"\((?:Live AI[^)]*|in character[^)]*|~?\d+\s*words?[^)]*|unique voice[^)]*)\)",
        "",
        t,
        flags=re.I,
    )

    # Remove full lines that are pure instruction echo / meta
    kept: list[str] = []
    for line in t.splitlines():
        s = line.strip()
        if not s:
            if kept and kept[-1] != "":
                kept.append("")
            continue
        if _META_ECHO_LINE.match(s):
            continue
        if re.match(
            r"^(?:~?\d+[–\-]\d+\s+words?|at least \w+ full paragraphs?|"
            r"mood JSON|end with mood|no stage directions?|"
            r"never mention (?:AI|LLM|Ollama|Grok)|this turn's energy|"
            r"energy this beat|pace\s*:|output rules|"
            r"here(?:'s| is) my take|my take as |speaking as |"
            r"in character|just spoken words|no labels|"
            r"live ai group hook|topic in the air|your turn —)\b",
            s,
            flags=re.I,
        ):
            continue
        # Drop "*does a thing*" stage-direction-only lines
        if re.match(r"^\*[^*]{1,80}\*$", s):
            continue
        # Strip meta openers that glued to real dialogue on same line
        s2 = _META_OPENER.sub("", s).strip()
        s2 = _META_INLINE.sub("", s2)
        s2 = re.sub(r"[ \t]{2,}", " ", s2).strip(" ,;:-—–")
        if s2:
            kept.append(s2 if s2 != s else line.rstrip())
    t = "\n".join(kept).strip()

    # Collapse leftover double spaces / empty paren
    t = re.sub(r"[ \t]{2,}", " ", t)
    t = re.sub(r"\(\s*\)", "", t)
    t = re.sub(r"\n{3,}", "\n\n", t)
    t = t.strip()
    # One more pass on whole text for glued openers
    t = _META_OPENER.sub("", t).strip()
    return t.strip() or (text or "").strip()


def _looks_like_director_note(message: str) -> bool:
    """True if client sent stage directions / LLM instructions instead of visitor speech."""
    if _looks_like_spoken_transcript(message):
        return False
    low = (message or "").strip().lower()
    if not low:
        return False
    markers = (
        "in character",
        "no meta",
        "as an ai",
        "2–4 sentences",
        "2-4 sentences",
        "2–3 sentences",
        "2-3 sentences",
        "never mention",
        "you are ",
        "you pause to",
        "you just built",
        "you were just",
        "you just finished",
        "speak only",
        "first reason",
        "first weigh",
        "take 2",
        "out loud at camp",
        "private stage",
        "do not quote",
        "no preamble",
    )
    hits = sum(1 for m in markers if m in low)
    if hits >= 2:
        return True
    if low.startswith("you ") and ("sentence" in low or "character" in low or "meta" in low):
        return True
    return False


def _spoken_dialogue_only(text: str) -> str:
    """Keep words they say out loud. Drop narrator stage business."""
    t = _strip_meta_dialogue_leak(text or "")
    if not t:
        return ""
    # Stage-play: keep the quoted speech
    if re.search(
        r"\b(hopped|nodded|smiled|leaned|whispered|eyes sparkled|took in the news|mull(?:ed)? over)\b",
        t,
        re.I,
    ):
        quotes = re.findall(r'"([^"]{8,400})"', t)
        if quotes:
            t = " ".join(quotes)
    t = re.sub(
        r"^[A-Z][\w' .-]{0,24}\s+(?:hopped|nodded|smiled|laughed|leaned|whispered)[^.!?\n]*[.!?]\s*",
        "",
        t,
    )
    # Keep paragraph / sentence breaks for multi-line chit-chat (don't squash to one line)
    t = re.sub(r"[ \t]+", " ", t)
    t = re.sub(r"\n{3,}", "\n\n", t)
    return t.strip()


def _looks_like_spoken_transcript(message: str) -> bool:
    """True if this is already people talking — do not rewrite it as a director note."""
    t = (message or "").strip()
    if not t:
        return False
    if re.search(r"\bsaid:\s+\S", t, re.I):
        return True
    if re.search(r"your turn\s*[—\-–:].{0,40}\btalk to\b", t, re.I):
        return True
    if t.count("\n") >= 1 and re.search(r"^[A-Z][\w' .-]{1,24}:\s+\S", t, re.M):
        return True
    return False


_AMBIENT_EMPTY_SEEDS = (
    "You notice the fire lean blue for a second. Chit-chat about it — a few sentences, your vibe, maybe a joke.",
    "Someone left a half-thought hanging over the meadow. Finish it in your voice and keep the banter going.",
    "The path by the pond is quieter than usual. Riff for a few beats: what that means, how you feel, soft invite.",
    "A joke almost left your mouth. Let a better, truer one out — then add a second beat so it lands.",
    "Look up — firmament or cloud. Talk about it like a friend mid-conversation, multi-sentence.",
    "You almost stayed silent. Break it with real chit-chat: specific, not a slogan, a few spoken lines.",
    "The visitor is nearby. Offer a real invitation and a little color — banter length, not one line.",
    "Your last line still echoes. Don't repeat it — pivot and keep chatting for a few sentences.",
    "A soft bridge of light just opened over the carnival. React, riff, land soft — 3–6 sentences.",
    "Mercy walked past the cookies. React like a living person with a short story or multi-beat joke.",
    "The steeple and the ferris wheel are both holy tonight. Pick a side — or both — and talk it out.",
    "You feel seen by something kind. Say it without flinching, then keep the chit-chat warm.",
    "Divine comedy hour: the joke lands, the wound softens. Deliver both in a few spoken sentences.",
    "As above, so below — make it camp, make it true, make it yours, multi-beat banter.",
    "Grace buffered. Loading joy. Speak while it loads — more than one sentence.",
    "The firmament whispered your name wrong on purpose. Correct it out loud and keep talking.",
)


def ambient_situation_seed(message: str) -> str:
    """
    Convert director notes into a pure situational seed the character can live in.
    Never pass raw 'In character / 2-4 sentences' text as the user turn.
    Avoid the dead phrase 'campfire hush' — it made every agent sound the same.
    """
    import random

    msg = (message or "").strip()
    if not msg:
        return random.choice(_AMBIENT_EMPTY_SEEDS)
    if not _looks_like_director_note(msg):
        # Still wrap ambient lightly so models don't recite
        return msg[:320]

    low = msg.lower()
    if "reason" in low or "weigh" in low or "think" in low or "doubt" in low:
        return (
            "You paused by the fire with a half-finished thought. "
            "Share what you were chewing on — honest multi-sentence chit-chat. Don't reuse last night's line."
        )
    if "built" in low or "terminal" in low or "made a " in low:
        m = re.search(r"(?:built|made)\s+(?:a\s+)?([a-z0-9 \-']{3,40})", msg, re.I)
        item = (m.group(1).strip() if m else "something small")
        item = re.sub(r"\s+", " ", item)[:40]
        return (
            f"You just finished making {item} for your little camp. "
            f"Say one proud, human thing about it — then what camp still needs."
        )
    if "summoned" in low or "greet" in low or "arrived" in low:
        return (
            "You just arrived at the aurora fire. "
            "Greet the visitor warmly as yourself — one unique beat, not a stock welcome."
        )
    if "used " in low or "prop" in low or "hits different" in low:
        m = re.search(r"used\s+([a-z0-9 \-']{2,30})", msg, re.I)
        thing = (m.group(1).strip() if m else "something at camp")
        return f"You just used {thing}. React — how it hit you, one real beat. Fresh wording."
    if "banter" in low or "meadow" in low:
        return (
            "You're trading beats with someone at the meadow. "
            "Witty, present, and different from your last line."
        )
    if "hush" in low:
        return (
            "The visitor asked for a softer meadow: slower pace, room between thoughts. "
            "Speak one calm, clear line — not a monologue pile-up."
        )
    # Strip instruction clauses, keep residual scene if any
    cleaned = re.sub(
        r"(?i)\b(?:in character|no meta|as an ai|never mention[^.]*|"
        r"\d+\s*[–\-]\s*\d+\s*sentences?|take \d+[^.]*|do not[^.]*|"
        r"speak only[^.]*|private stage[^.]*|no preamble[^.]*)\.?",
        " ",
        msg,
    )
    cleaned = re.sub(r"\s+", " ", cleaned).strip(" .,-")
    if len(cleaned) < 18 or "campfire hush" in cleaned.lower():
        cleaned = random.choice(_AMBIENT_EMPTY_SEEDS)
    return cleaned[:320]


def _looks_like_prompt_echo(text: str) -> bool:
    """True if the model mostly recited instructions instead of roleplay."""
    t = (text or "").strip()
    if not t:
        return True
    low = t.lower()
    hits = 0
    for needle in (
        "required:",
        "reply as ",
        "in-character as",
        "in character",
        "mood json",
        "dynamic opening",
        "hard no:",
        "logical camp dialogue",
        "logical dialogue",
        "at least two full paragraphs",
        "end with mood",
        "never mention ai",
        "stage directions",
        "you are not a chatbot",
        "world noise",
        "this turn's energy",
        "pace:",
        "system prompt",
        "here's my take",
        "here is my take",
        "my take as ",
        "speaking as ",
        "live ai group hook",
        "unique voice",
        "output rules",
        "just spoken words",
        "stay in character",
        "you pause to reason",
        "2-4 sentences",
        "2–4 sentences",
        "no meta",
        "as an ai",
        "you just built",
        "you were just summoned",
        "first weigh options",
        "private stage note",
        "do not quote",
        # Banter seed / director sludge the models love to recite
        "sensory first",
        "natural chat structure",
        "add your spin",
        "second breath",
        "welcome wave",
        "logged with care",
        "use it.",
        "react, then",
        "mid-conversation energy",
        "organic speech",
        "leave room for them",
        "title card",
        "fill it with personality",
        "not filler",
        "speak only as yourself",
        "do not narrate instructions",
        "live moment at camp",
        "fresh words",
        "sentence shape",
        "energy this beat",
    ):
        if needle in low:
            hits += 1
    if hits >= 2:
        return True
    # Heavy instruction density or classic meta openers
    if hits >= 1 and len(t.split()) < 50:
        return True
    if re.match(
        r"^(?:here(?:'s| is)\s+my\s+take|my\s+take\s+as|speaking\s+as|as\s+\w+,\s+i\b|"
        r"you\s+(?:pause|just|were|are)\b)",
        low,
    ):
        return True
    return False


def _parse_mood(reply: str) -> tuple[str, str]:
    mood = "happy"
    text = reply.strip()
    if "{" in text:
        idx = text.rfind("{")
        try:
            tail = json.loads(text[idx:])
            mood = str(tail.get("mood") or mood)
            text = text[:idx].strip()
        except json.JSONDecodeError:
            pass
    text = _strip_meta_dialogue_leak(text)
    return text, mood


_ollama_model_cache: list[str] | None = None
_ollama_model_cache_at: float = 0.0
_ollama_reach_cache_at: float = 0.0
_ollama_reach_ok: bool | None = None


def _ollama_available() -> bool:
    """Fast probe — skip dead Ollama on Render/cloud so Grok/Groq run first."""
    global _ollama_reach_cache_at, _ollama_reach_ok
    import time

    if _truthy("LUNA_FORCE_OLLAMA"):
        return True
    if _truthy("LUNA_SKIP_OLLAMA"):
        return False
    now = time.time()
    if _ollama_reach_ok is not None and now - _ollama_reach_cache_at < 45:
        return _ollama_reach_ok
    host = os.getenv("OLLAMA_HOST", "http://127.0.0.1:11434").rstrip("/")
    ok = False
    try:
        import httpx

        r = httpx.get(f"{host}/api/tags", timeout=1.25)
        ok = r.status_code == 200
    except Exception:
        ok = False
    _ollama_reach_ok = ok
    _ollama_reach_cache_at = now
    return ok


def _ollama_list_models(host: str) -> list[str]:
    """Return installed Ollama model names (cached briefly)."""
    global _ollama_model_cache, _ollama_model_cache_at
    import time

    now = time.time()
    if _ollama_model_cache is not None and now - _ollama_model_cache_at < 45:
        return _ollama_model_cache
    try:
        import httpx

        r = httpx.get(f"{host}/api/tags", timeout=2.5)
        r.raise_for_status()
        names: list[str] = []
        for m in (r.json() or {}).get("models") or []:
            n = str(m.get("name") or "").strip()
            if n:
                names.append(n)
        _ollama_model_cache = names
        _ollama_model_cache_at = now
        return names
    except Exception:
        return _ollama_model_cache or []


def _ollama_resolve_model(host: str, preferred: str) -> str:
    """Pick an installed model; prefer preferred, then hermes3, llama3.2, any."""
    pref = (preferred or "").strip() or os.getenv("OLLAMA_MODEL", "llama3.2")
    installed = _ollama_list_models(host)
    if not installed:
        return pref if ":" in pref else f"{pref}:latest" if pref else "llama3.2:latest"
    bare = {n.split(":")[0].lower(): n for n in installed}
    full = {n.lower(): n for n in installed}
    candidates = [
        pref,
        pref if ":" in pref else f"{pref}:latest",
        "hermes3:latest",
        "hermes3",
        "llama3.2:latest",
        "llama3.2",
        "llama3:latest",
        "llama3",
    ]
    for c in candidates:
        cl = c.lower()
        if cl in full:
            return full[cl]
        base = cl.split(":")[0]
        if base in bare:
            return bare[base]
    return installed[0]


def _complete_ollama(
    messages: list[dict],
    model: str,
    max_tokens: int,
    *,
    num_ctx: int | None = None,
    temperature: float | None = None,
) -> str:
    import httpx

    host = os.getenv("OLLAMA_HOST", "http://127.0.0.1:11434").rstrip("/")
    ollama_model = _ollama_resolve_model(host, model or os.getenv("OLLAMA_MODEL", "llama3.2"))
    # Lean context = faster free local brains (esp. ambient meadow chatter)
    ctx = int(num_ctx or os.getenv("OLLAMA_NUM_CTX", "3072") or 3072)
    ctx = max(1024, min(ctx, 8192))
    # Slightly cooler = snappier chit-chat; less penalty = fewer one-word stops
    temp = 0.92 if temperature is None else float(temperature)
    payload = {
        "model": ollama_model,
        "messages": messages,
        "stream": False,
        "options": {
            "temperature": temp,
            "num_predict": max_tokens,
            "num_ctx": ctx,
            "top_p": 0.92,
            "repeat_penalty": 1.12,
            "presence_penalty": 0.1,
            "frequency_penalty": 0.1,
        },
    }
    last_exc: Exception | None = None
    # Fail faster so free cloud (Gemini) can pick up if local is stuck
    read_s = float(os.getenv("OLLAMA_READ_TIMEOUT", "42") or 42)
    ollama_timeout = httpx.Timeout(connect=1.5, read=read_s, write=12.0, pool=4.0)
    for attempt_model in (ollama_model,):
        try:
            payload["model"] = attempt_model
            r = httpx.post(f"{host}/api/chat", json=payload, timeout=ollama_timeout)
            r.raise_for_status()
            data = r.json()
            content = (data.get("message") or {}).get("content") or ""
            if content.strip():
                return content
            raise RuntimeError("empty ollama content")
        except Exception as exc:
            last_exc = exc
            # try any other installed model once
            installed = _ollama_list_models(host)
            for alt in installed:
                if alt == attempt_model:
                    continue
                try:
                    payload["model"] = alt
                    r = httpx.post(f"{host}/api/chat", json=payload, timeout=ollama_timeout)
                    r.raise_for_status()
                    data = r.json()
                    content = (data.get("message") or {}).get("content") or ""
                    if content.strip():
                        log.info("Ollama fell back to installed model %s", alt)
                        return content
                except Exception as alt_exc:
                    last_exc = alt_exc
            break
    hint = f"ollama pull {model or 'hermes3'}"
    if last_exc and "404" in str(last_exc):
        hint = f"model missing — run: ollama pull hermes3  (or llama3.2)"
    raise RuntimeError(
        f"Ollama failed ({host}). Start Ollama, then: {hint}. {last_exc}"
    ) from last_exc


def _complete_openai_compat(
    messages: list[dict],
    *,
    base_url: str,
    api_key: str,
    model: str,
    max_tokens: int,
    extra_headers: dict | None = None,
) -> str:
    from openai import OpenAI
    import httpx

    client = OpenAI(
        api_key=api_key,
        base_url=base_url,
        timeout=httpx.Timeout(90.0),
        default_headers=extra_headers or {},
    )
    resp = client.chat.completions.create(
        model=model,
        messages=messages,
        temperature=0.95,
        max_tokens=max_tokens,
    )
    return (resp.choices[0].message.content or "").strip()


def _complete_groq(messages: list[dict], model: str, max_tokens: int) -> str:
    key = os.getenv("GROQ_API_KEY", "").strip()
    if not key:
        raise RuntimeError("GROQ_API_KEY not set")
    return _complete_openai_compat(
        messages,
        base_url="https://api.groq.com/openai/v1",
        api_key=key,
        model=model or "llama-3.1-8b-instant",
        max_tokens=max_tokens,
    )


def _redact_secrets(text: str) -> str:
    """Never leak API keys in logs / raised errors."""
    s = str(text or "")
    for env_name in (
        "GEMINI_API_KEY",
        "GOOGLE_API_KEY",
        "GROQ_API_KEY",
        "OPENROUTER_API_KEY",
        "XAI_API_KEY",
    ):
        k = os.getenv(env_name, "").strip()
        if k and len(k) > 8:
            s = s.replace(k, "***")
    s = re.sub(r"(key=)[^&\s\"']+", r"\1***", s, flags=re.I)
    s = re.sub(r"(AIza[0-9A-Za-z_\-]{10,})", "***", s)
    s = re.sub(r"(AQ\.[0-9A-Za-z_\-]{10,})", "***", s)
    return s


def _complete_gemini(messages: list[dict], model: str, max_tokens: int) -> str:
    """Free Gemini via Google AI Studio REST (with model fallbacks on 429/404)."""
    import httpx

    key = (
        os.getenv("GEMINI_API_KEY", "").strip()
        or os.getenv("GOOGLE_API_KEY", "").strip()
    )
    if not key:
        raise RuntimeError("GEMINI_API_KEY not set")
    preferred = (model or os.getenv("GEMINI_MODEL") or "gemini-flash-lite-latest").strip()
    if not preferred.startswith("gemini"):
        preferred = "gemini-flash-lite-latest"
    # Prefer lite/latest first — free tier often 429s on heavier flash models
    candidates = [
        preferred,
        "gemini-flash-lite-latest",
        "gemini-2.0-flash-lite",
        "gemini-2.5-flash-lite",
        "gemini-flash-latest",
        "gemini-2.0-flash",
    ]
    seen: set[str] = set()
    models: list[str] = []
    for m in candidates:
        if m and m not in seen:
            seen.add(m)
            models.append(m)

    system = ""
    contents: list[dict] = []
    for m in messages:
        role = m.get("role")
        text = m.get("content") or ""
        if role == "system":
            system = text
            continue
        gem_role = "user" if role == "user" else "model"
        contents.append({"role": gem_role, "parts": [{"text": text}]})
    if system and contents:
        contents[0]["parts"][0]["text"] = f"{system}\n\n{contents[0]['parts'][0]['text']}"
    body = {
        "contents": contents,
        "generationConfig": {
            "temperature": 0.95,
            "maxOutputTokens": max_tokens,
        },
    }

    last_err: Exception | None = None
    for mid in models:
        url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"{mid}:generateContent?key={key}"
        )
        try:
            r = httpx.post(url, json=body, timeout=90.0)
            if r.status_code in (404, 429):
                last_err = RuntimeError(
                    _redact_secrets(f"Gemini {mid} HTTP {r.status_code}: {r.text[:180]}")
                )
                log.info("gemini skip %s status=%s", mid, r.status_code)
                continue
            r.raise_for_status()
            data = r.json()
            parts = (
                ((data.get("candidates") or [{}])[0].get("content") or {}).get("parts")
                or []
            )
            text_out = "".join(p.get("text") or "" for p in parts).strip()
            if text_out:
                if mid != preferred:
                    log.info("Gemini used fallback model %s", mid)
                return text_out
            last_err = RuntimeError(f"Gemini {mid} empty response")
        except Exception as exc:
            last_err = RuntimeError(_redact_secrets(str(exc)))
            continue
    raise RuntimeError(
        _redact_secrets(
            f"Gemini failed all models ({', '.join(models[:4])}…). "
            f"Check free-tier quota at https://aistudio.google.com . {last_err}"
        )
    )


def _complete_openrouter(messages: list[dict], model: str, max_tokens: int) -> str:
    key = os.getenv("OPENROUTER_API_KEY", "").strip()
    if not key:
        raise RuntimeError("OPENROUTER_API_KEY not set")
    # Free-tier friendly default
    model = model or os.getenv("OPENROUTER_MODEL", "meta-llama/llama-3.1-8b-instruct:free")
    return _complete_openai_compat(
        messages,
        base_url="https://openrouter.ai/api/v1",
        api_key=key,
        model=model,
        max_tokens=max_tokens,
        extra_headers={
            "HTTP-Referer": os.getenv("LUNA_PUBLIC_URL", "https://telephanti.com"),
            "X-Title": "Luna Camp",
        },
    )


def _complete_grok(messages: list[dict], model: str, max_tokens: int) -> str:
    api_key = os.getenv("XAI_API_KEY", "").strip()
    if not api_key or api_key == "your_api_key_here":
        raise RuntimeError("XAI_API_KEY not set")
    preferred = model or os.getenv("GROK_MODEL", "grok-4-fast-non-reasoning")
    # Try preferred first, then known good fallbacks if model id drifts
    candidates = []
    for m in (
        preferred,
        os.getenv("GROK_MODEL", ""),
        "grok-4-fast-non-reasoning",
        "grok-4-1-fast-non-reasoning",
        "grok-4-1-fast",
        "grok-4.5",
        "grok-3-mini",
        "grok-2-1212",
    ):
        m = (m or "").strip()
        if m and m not in candidates:
            candidates.append(m)
    last_exc: Exception | None = None
    for m in candidates:
        try:
            return _complete_openai_compat(
                messages,
                base_url="https://api.x.ai/v1",
                api_key=api_key,
                model=m,
                max_tokens=max_tokens,
            )
        except Exception as exc:
            last_exc = exc
            err = str(exc).lower()
            # Credits / auth — don't burn retries
            if "permission-denied" in err or "spending limit" in err or "credits" in err:
                raise RuntimeError(
                    "XAI credits empty or spending limit hit — top up console.x.ai "
                    "or set free GROQ_API_KEY / GEMINI_API_KEY on the server"
                ) from exc
            if "401" in err or "invalid api" in err or "incorrect api" in err:
                raise RuntimeError("XAI_API_KEY rejected by xAI") from exc
            # Model not found → try next
            if "model" in err or "404" in err or "not found" in err or "400" in err:
                log.warning("Grok model %s failed, trying next: %s", m, exc)
                continue
            raise
    raise RuntimeError(f"Grok failed all models: {last_exc}") from last_exc


def _complete_messages(
    messages: list[dict],
    *,
    model: str | None = None,
    max_tokens: int = 900,
    backend: str | None = None,
) -> str:
    """Legacy single-backend complete (used by tests / simple callers)."""
    be = (backend or llm_backend()).lower()
    if be == "ollama":
        return _complete_ollama(messages, model or os.getenv("OLLAMA_MODEL", "llama3.2"), max_tokens)
    if be == "groq":
        return _complete_groq(messages, model or "llama-3.1-8b-instant", max_tokens)
    if be == "gemini":
        return _complete_gemini(messages, model or "gemini-2.0-flash", max_tokens)
    if be == "openrouter":
        return _complete_openrouter(messages, model or "", max_tokens)
    if be == "grok" and _grok_ok():
        return _complete_grok(messages, model or os.getenv("GROK_MODEL", "grok-4-fast-non-reasoning"), max_tokens)
    # Default free path — never silent Grok bill
    if _ollama_available():
        return _complete_ollama(messages, model or os.getenv("OLLAMA_MODEL", "llama3.2"), max_tokens)
    if _groq_ok():
        return _complete_groq(messages, model or "llama-3.1-8b-instant", max_tokens)
    if _gemini_ok():
        return _complete_gemini(messages, model or "gemini-2.0-flash", max_tokens)
    raise RuntimeError("No free LLM available (Ollama / Groq / Gemini). Grok is disabled.")


def _user_grok_allowed() -> bool:
    """Grok for direct *user* chat only — OFF when zero-cost mode is on.

    Zero-cost default: free minds only (Ollama / Gemini free / aether).
    Paid Grok only if LUNA_ZERO_COST=0 AND (LUNA_USER_GROK=1 or LUNA_ALLOW_GROK=1) + key.
    """
    if not _grok_key_present():
        return False
    if _truthy("LUNA_DISABLE_USER_GROK") or _truthy("LUNA_DISABLE_GROK"):
        return False
    return True


def build_backend_chain(
    agent_id: str,
    profile: dict,
    *,
    force_grok: bool = False,
    ambient: bool = False,
    for_user: bool = False,
) -> list[tuple[str, str]]:
    """Ordered (backend, model) tries.

    Distribution:
      - **User / direct chat** → Gemini + Grok (quality), free fallbacks
      - **Ambient / free speech** → Ollama first (spread load), free cloud — no Grok
    """
    aid = (agent_id or "").strip().lower()
    pack = free_model_pack(aid, profile)
    pref = str(profile.get("model") or "free").strip().lower()
    chain: list[tuple[str, str]] = []
    ollama_up = _ollama_available()
    cloud = _is_cloud_host()

    def _append_ollama() -> None:
        if not ollama_up:
            return
        ollama_model = pack["ollama"]
        chain.append(("ollama", ollama_model))
        fallback_ollama = os.getenv("OLLAMA_MODEL", "llama3.2")
        if fallback_ollama and fallback_ollama.split(":")[0] != ollama_model.split(":")[0]:
            chain.append(("ollama", fallback_ollama))

    def _append_gemini() -> None:
        if not _gemini_ok():
            return
        # Prefer free lite model (env) over pack default so zero-cost stays cheap
        gem_model = (
            os.getenv("GEMINI_MODEL", "").strip()
            or pack.get("gemini")
            or "gemini-flash-lite-latest"
        )
        chain.append(("gemini", gem_model))

    def _append_groq() -> None:
        if _groq_ok():
            chain.append(("groq", pack.get("groq") or os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")))

    def _append_openrouter() -> None:
        if _openrouter_ok():
            chain.append((
                "openrouter",
                pack.get("openrouter")
                or profile.get("openrouter_model")
                or os.getenv("OPENROUTER_MODEL", "meta-llama/llama-3.1-8b-instruct:free"),
            ))

    def _append_grok() -> None:
        if force_grok and _grok_key_present():
            gmodel = profile.get("grok_model") or os.getenv("GROK_MODEL", "grok-4-fast-non-reasoning")
            chain.append(("grok", gmodel))
            return
        if _grok_ok() or _user_grok_allowed():
            gmodel = profile.get("grok_model") or os.getenv("GROK_MODEL", "grok-4-fast-non-reasoning")
            chain.append(("grok", gmodel))

    if force_grok:
        _append_grok()
        if chain:
            return chain

    # Free brains first (works for every visitor). Grok is optional polish
    # when the host has a key — same path for Stood and random visitors.
    if ambient and not for_user:
        _append_ollama()
        _append_gemini()
        _append_groq()
        _append_openrouter()
        # Optional Grok tweak after free minds (only if keyed / allowed)
        if _truthy("LUNA_GROK_AFTER_FREE", "1") or _user_grok_allowed() or _grok_ok():
            _append_grok()
    elif for_user:
        _append_ollama()
        _append_gemini()
        _append_groq()
        _append_openrouter()
        # Same Grok option for any visitor's direct chat when host has key
        if _truthy("LUNA_GROK_AFTER_FREE", "1") or _user_grok_allowed() or _grok_ok():
            _append_grok()
    else:
        if cloud:
            _append_gemini()
            _append_groq()
            _append_openrouter()
            if ollama_up and (os.getenv("LUNA_LLM_BACKEND") or "").strip().lower() in (
                "ollama",
                "local",
            ):
                _append_ollama()
            if _truthy("LUNA_GROK_AFTER_FREE", "1") or _user_grok_allowed() or _grok_ok():
                _append_grok()
        else:
            _append_ollama()
            _append_gemini()
            _append_groq()
            _append_openrouter()
            if _truthy("LUNA_GROK_AFTER_FREE", "1") or _user_grok_allowed() or _grok_ok():
                _append_grok()

    seen: set[tuple[str, str]] = set()
    out: list[tuple[str, str]] = []
    for item in chain:
        if item not in seen:
            seen.add(item)
            out.append(item)
    return out


def _run_backend(
    backend: str,
    model: str,
    messages: list[dict],
    max_tokens: int,
    *,
    ambient: bool = False,
) -> str:
    be = backend.lower()
    if be == "ollama":
        return _complete_ollama(
            messages,
            model,
            max_tokens,
            # Smaller ctx + moderate temp = faster multi-sentence chit-chat
            num_ctx=1536 if ambient else 2560,
            temperature=0.9 if ambient else 0.92,
        )
    if be == "groq":
        return _complete_groq(messages, model, max_tokens)
    if be == "gemini":
        return _complete_gemini(messages, model, max_tokens)
    if be == "openrouter":
        return _complete_openrouter(messages, model, max_tokens)
    if be == "grok":
        return _complete_grok(messages, model, max_tokens)
    raise RuntimeError(f"unknown backend {backend}")


def free_backends_status() -> dict[str, Any]:
    ollama_up = _ollama_available()
    cloud = _is_cloud_host()
    backend = llm_backend()
    return {
        "free_brains": free_brains_preferred(),
        "backend": backend,
        "cloud": cloud,
        "grok_allowed": _grok_allowed(),
        "grok_key_present": _grok_key_present(),
        "ollama": ollama_up,
        "ollama_ok": ollama_up,
        "ollama_host": os.getenv("OLLAMA_HOST", "http://127.0.0.1:11434"),
        "ollama_model": os.getenv("OLLAMA_MODEL", "llama3.2"),
        "ollama_required": False,  # never required for live visitors
        "groq": _groq_ok(),
        "gemini": _gemini_ok(),
        "gemini_model": os.getenv("GEMINI_MODEL", "gemini-2.0-flash"),
        "openrouter": _openrouter_ok(),
        "grok": _grok_ok(),
        "free_cloud_order": _free_cloud_order(),
        "live_free_cloud": _groq_ok() or _gemini_ok() or _openrouter_ok(),
        "live_cloud": _groq_ok() or _gemini_ok() or _openrouter_ok() or _grok_ok(),
        "offline_templates": True,  # aether always available if no LLM keys
        "user_grok": _user_grok_allowed(),
        "distribution": {
            "user_direct": "gemini → grok (if keyed) → free fallbacks",
            "ambient": "ollama first (spread load) → gemini → free cloud — no grok",
        },
        "policy": {
            "user_chat": "Google Gemini + optional Grok (LUNA_USER_GROK=1 + XAI_API_KEY)",
            "ambient": "Ollama spreads town chatter; free cloud backup",
            "paid_grok": "user-path only when keyed — ambient never bills Grok",
            "live": "Ollama not required for visitors; Gemini free key recommended",
            "gemini": "Google AI Studio free key; free tier has rate limits (not unlimited)",
            "deceptive": False,
        },
        "character_models": {
            aid: free_model_pack(aid)["ollama"] for aid in sorted(DEFAULT_FREE_MODELS)
        },
    }


async def agent_chat(
    agent_id: str,
    message: str,
    *,
    pack_name: str = "",
    game_context: str = "",
    camp_context: str = "",
    clear_memory: bool = False,
    from_agent: str = "",
    visitor_id: str = "",
    visitor_name: str = "",
    converse_mode: bool = False,
    force_grok: bool = False,
    ambient: bool = False,
    skip_memory: bool = False,
) -> dict[str, Any]:
    message = (message or "").strip()
    if len(message) < 1:
        raise ValueError("message required")

    profile = load_agent_profile(agent_id)
    memory = _load_memory()
    mem_key = _memory_key(agent_id, visitor_id)
    if clear_memory:
        memory.pop(mem_key, None)
        if not visitor_id:
            memory.pop(agent_id, None)

    # Ambient campside bark / agent banter: no long visitor history, pure live AI
    if converse_mode or ambient or skip_memory:
        history: list[dict[str, str]] = []
    else:
        history = memory.get(mem_key) or (memory.get(agent_id, []) if visitor_id else [])
    if not game_context:
        try:
            from firmament.game_state import context_blurb

            game_context = context_blurb()
        except Exception:
            game_context = ""
    if not camp_context and visitor_id:
        try:
            from firmament.camp_memory import blurb_for_agent

            camp_context = blurb_for_agent(agent_id, visitor_id, visitor_name)
        except Exception:
            camp_context = ""
    growth = _growth_blurb(agent_id, visitor_id)
    if growth:
        camp_context = f"{camp_context} {growth}".strip()

    # Direct visitor chat (talk box) = not agent-to-agent, not converse, not ambient bark
    direct_chat = not converse_mode and not from_agent and not ambient
    sys_prompt = _agent_system_prompt(
        profile, pack_name, game_context, camp_context, direct_chat=direct_chat,
    )
    # Soft scene notes only (no ALL-CAPS labels models love to recite)
    if ambient:
        sys_prompt += (
            "\nScene: ambient town chit-chat — you are ALIVE at this fire. "
            "Banter for real: 3–6 spoken sentences, witty and true through your role. "
            "Never stop at one lonely sentence. If another agent just spoke, answer them by name. "
            "Spoken words only. Emojis ok."
        )
        # Daily rotation visitors: keep system brief + identity sharp for small Ollama ctx
        if profile.get("faction") or profile.get("daily"):
            fac = profile.get("faction") or "visitor"
            opener = (profile.get("opener") or "").strip()
            if opener:
                sys_prompt += f"\nToday's vibe line (attitude, never quote verbatim): {opener[:120]}"
            sys_prompt += f"\nYou are a daily {fac} guest in Luna Town — introduce your flavor without monologuing your lore dump."
    if from_agent:
        other = load_agent_profile(from_agent)
        other_name = other.get("name", from_agent)
        me_name = profile.get("name") or agent_id
        me_role = profile.get("role") or "camp friend"
        sys_prompt += (
            f"\nScene: you are talking to {other_name}, not the visitor. "
            f"Answer their last words as {me_name} the {me_role}. "
            f"Witty and true about real life through that role. Spoken dialogue only."
        )
    elif converse_mode:
        me_name = profile.get("name") or agent_id
        me_role = profile.get("role") or "camp friend"
        sys_prompt += (
            f"\nScene: fire chat with the other campers. Talk to them as {me_name} the {me_role}. "
            "Answer the last speaker. Witty, true, about being alive — not news, not slogans. "
            "Spoken dialogue only."
        )

    # CRITICAL: user message = scene / visitor / transcript only.
    # Director notes in ambient cues get reduced. Converse transcripts must survive.
    if converse_mode:
        user_content = message
    elif ambient or _looks_like_director_note(message):
        user_content = ambient_situation_seed(message)
    else:
        user_content = message

    messages = [{"role": "system", "content": sys_prompt}]
    # Cap history so Ollama/Hermes doesn't drown in old turns
    hist_cap = 4 if ambient else min(MAX_MEMORY_TURNS, 8)
    for turn in history[-hist_cap:]:
        if turn.get("role") in ("user", "assistant") and turn.get("content"):
            content = str(turn["content"])
            cap = 420 if ambient else 900
            if len(content) > cap:
                content = content[: cap - 3] + "…"
            messages.append({"role": turn["role"], "content": content})
    # Ambient user seeds stay short (director notes already reduced)
    if ambient and len(user_content) > 320:
        user_content = user_content[:317] + "…"
    messages.append({"role": "user", "content": user_content})

    import asyncio

    # User talk box / visitor direct chat → Gemini+Grok; ambient → Ollama spread
    for_user = bool(direct_chat) or bool(visitor_id and not ambient and not from_agent and not converse_mode)
    chain = build_backend_chain(
        agent_id,
        profile,
        force_grok=force_grok,
        ambient=bool(ambient) and not for_user,
        for_user=for_user,
    )
    if force_grok and not chain:
        raise RuntimeError(
            "Grok requested but no XAI_API_KEY — set key + LUNA_USER_GROK=1, "
            "or use free GEMINI_API_KEY / Ollama"
        )

    # Tight free-tier budgets (Ollama / Groq / OpenRouter free)
    max_tok = free_max_tokens(ambient=ambient, converse_mode=converse_mode)
    used_backend = "aether"
    agent_model = "aether-local"
    reply = ""
    mood = "happy"
    errors: list[str] = []

    from firmament.live_feed import is_too_similar, push_event

    # Floor / soft cap — room for a real answer without endless spew
    MIN_ACCEPT_WORDS = 10 if (ambient or converse_mode) else 14
    SOFT_MAX_WORDS = 95 if (ambient or converse_mode) else 140

    if not chain:
        errors.append(
            "no free LLM backends — run Ollama locally, or set GROQ_API_KEY / GEMINI_API_KEY "
            "(Grok/xAI is off unless LUNA_ALLOW_GROK=1)"
        )

    for backend, model in chain:
        try:
            # Ambient: 1–2 attempts only (Ollama-friendly). Direct chat: up to 3.
            max_attempts = 2 if ambient else 3
            for attempt in range(max_attempts):
                msgs = list(messages)
                if attempt == 1:
                    # Soft redo as a character whisper, not instruction dump
                    msgs = list(messages) + [{
                        "role": "assistant",
                        "content": reply or "…",
                    }, {
                        "role": "user",
                        "content": (
                            "That didn't sound like you — too generic, too similar to someone else, "
                            "or it leaked stage notes. Say it again in your real voice only. "
                            "Just the spoken words."
                        ),
                    }]
                elif attempt == 2:
                    msgs = list(messages) + [{
                        "role": "assistant",
                        "content": reply or "…",
                    }, {
                        "role": "user",
                        "content": (
                            "Say it again like a real person talking by the fire — a few clear sentences, "
                            "full thought, then stop. Not mute, not a rant. Just speech."
                        ),
                    }]
                raw = await asyncio.to_thread(
                    _run_backend, backend, model, msgs, max_tok, ambient=ambient,
                )
                raw = (raw or "").strip()
                if not raw:
                    raise RuntimeError(f"{backend}/{model} empty reply")
                reply, mood = _parse_mood(raw)
                # Second pass if sanitizer left obvious prompt sludge
                if _looks_like_prompt_echo(reply):
                    reply = _strip_meta_dialogue_leak(reply)
                word_count = len(reply.split())
                # Extreme stubs → next backend
                stub_floor = 4 if direct_chat else 3
                if word_count < stub_floor and backend != chain[-1][0]:
                    errors.append(f"{backend}/{model}: stub ({word_count}w)")
                    reply = ""
                    break
                if _looks_like_prompt_echo(reply) and attempt < max_attempts - 1:
                    errors.append(f"{backend}/{model}: prompt echo (attempt {attempt})")
                    continue
                if is_too_similar(agent_id, reply) and attempt < max_attempts - 1:
                    errors.append(f"{backend}/{model}: too similar (attempt {attempt})")
                    continue
                # Only reject if truly too short AND we can retry once
                if word_count < MIN_ACCEPT_WORDS and attempt < max_attempts - 1:
                    errors.append(f"{backend}/{model}: short {word_count}w, retry")
                    continue
                used_backend = backend
                agent_model = model
                if backend == "ollama":
                    try:
                        host = os.getenv("OLLAMA_HOST", "http://127.0.0.1:11434").rstrip("/")
                        agent_model = _ollama_resolve_model(host, model)
                    except Exception:
                        agent_model = model
                break
            if reply:
                # Final sanitize before ship
                reply = _strip_meta_dialogue_leak(reply)
                if not reply.strip():
                    reply = ""
                    continue
                # Soft cap: keep first ~SOFT_MAX_WORDS, end on a sentence if possible
                words = reply.split()
                if len(words) > SOFT_MAX_WORDS:
                    cut = " ".join(words[:SOFT_MAX_WORDS])
                    for end in (". ", "! ", "? ", ".\n", "!\n", "?\n"):
                        idx = cut.rfind(end)
                        if idx > len(cut) // 3:
                            cut = cut[: idx + 1].strip()
                            break
                    reply = cut
                break
        except Exception as exc:
            errors.append(f"{backend}/{model}: {exc}")
            log.warning("LLM %s/%s failed for %s: %s", backend, model, agent_id, exc)
            continue
    else:
        log.warning("All LLM backends failed for %s — aether fallback. %s", agent_id, " | ".join(errors[-3:]))
        from firmament.aether_offline import aether_reply

        reply, mood = aether_reply(
            agent_id,
            message,
            camp_context=camp_context,
            visitor_name=visitor_name,
            from_agent=from_agent,
            converse_mode=converse_mode,
        )
        used_backend = "aether"
        agent_model = "aether-local"

    if not reply:
        reply = "I'm here — say that again?"

    # Feed every live line back into shared brains (free dynamic memory)
    try:
        kind = "ambient" if ambient else ("converse" if converse_mode else "chat_reply")
        push_event(
            kind=kind,
            text=reply,
            agent_id=agent_id,
            speaker=str(profile.get("name") or agent_id),
            visitor_id=visitor_id,
            meta={"backend": used_backend, "model": agent_model},
        )
        if direct_chat and message:
            push_event(
                kind="visitor",
                text=message[:280],
                speaker=visitor_name or "Visitor",
                visitor_id=visitor_id,
            )
    except Exception as exc:
        log.debug("live feed push: %s", exc)

    # Don't pollute visitor memory with ambient bark / converse scaffolding
    if not converse_mode and not ambient and not skip_memory:
        history = history + [
            {"role": "user", "content": message},
            {"role": "assistant", "content": reply},
        ]
        memory[mem_key] = history[-MAX_MEMORY_TURNS * 2 :]
        _save_memory(memory)

    out: dict[str, Any] = {
        "agent_id": agent_id,
        "name": profile.get("name", agent_id),
        "reply": reply,
        "mood": mood,
        "model": agent_model,
        "backend": used_backend,
        "free_chain": [f"{b}/{m}" for b, m in chain],
        "live_ai": used_backend != "aether",
        "word_count": len(reply.split()),
    }
    if used_backend == "aether":
        # Surface why cloud failed so UI doesn't blame "Ollama offline" forever
        note = " | ".join(errors[-3:]) if errors else "no backends succeeded"
        low = note.lower()
        if "credit" in low or "spending limit" in low or "permission-denied" in low:
            out["brain_hint"] = (
                "Cloud AI out of credits. Add GROQ_API_KEY or GEMINI_API_KEY on Render "
                "(free tiers) or top up XAI_API_KEY — then agents talk with real brains."
            )
        elif "api key" in low or "not set" in low:
            out["brain_hint"] = (
                "No live LLM keys. Set XAI_API_KEY and/or free GROQ_API_KEY / GEMINI_API_KEY "
                "in Render env, or run Ollama locally."
            )
        else:
            out["brain_hint"] = (
                "Live LLM failed — long aether monologue used as backup. "
                f"Detail: {note[:220]}"
            )
        out["brain_errors"] = errors[-5:]
    return out


async def agents_converse(
    agent_a: str,
    agent_b: str,
    topic: str = "",
    rounds: int = 3,
    *,
    agent_c: str = "",
    agent_d: str = "",
    pack_name: str = "",
    visitor_id: str = "",
    visitor_name: str = "",
) -> dict[str, Any]:
    """Threaded 2–4 agent pow-wow / meadow conversation (watchable back-and-forth)."""
    from firmament.camp_converse import (
        aether_group_converse,
        converse_thread_prompt,
        looks_like_meta_banter,
        pick_converse_topic,
        total_converse_lines,
    )

    rounds = max(2, min(5, int(rounds)))
    ordered: list[str] = []
    seen: set[str] = set()
    for aid in (agent_a, agent_b, agent_c, agent_d):
        a = (aid or "").strip().lower()
        if a and a not in seen:
            seen.add(a)
            ordered.append(a)
    if len(ordered) < 2:
        ordered = ["luna", "hermes"]

    topic_clean = (topic or "").strip() or pick_converse_topic(visitor_name)
    target = total_converse_lines(len(ordered), rounds)
    thread: list[dict[str, Any]] = []
    used_backend = "ollama"
    agent_model = "free-chain"
    ai_lines = 0

    for i in range(target):
        speaker = ordered[i % len(ordered)]
        prompt = converse_thread_prompt(ordered, topic_clean, thread, speaker)
        from_prev = thread[-1]["agent_id"] if thread else ""
        try:
            result = await agent_chat(
                speaker,
                prompt,
                pack_name=pack_name,
                visitor_id=visitor_id,
                visitor_name=visitor_name,
                from_agent=from_prev,
                converse_mode=True,
                ambient=False,
                skip_memory=True,
            )
            be = result.get("backend") or "aether"
            if be != "aether":
                ai_lines += 1
            used_backend = be if be != "aether" or not thread else used_backend
            agent_model = result.get("model") or agent_model
            line = _spoken_dialogue_only((result.get("reply") or "").strip())
            if (
                not line
                or _looks_like_prompt_echo(line)
                or looks_like_meta_banter(line)
            ):
                # One retry with only the last spoken line — no director wrapper
                if thread:
                    prev = thread[-1]
                    prev_said = re.sub(r"\s+", " ", str(prev.get("line") or "")).strip()[:200]
                    bare = f'{prev.get("name") or "They"} said: {prev_said}'
                    try:
                        retry = await agent_chat(
                            speaker,
                            bare,
                            pack_name=pack_name,
                            visitor_id=visitor_id,
                            visitor_name=visitor_name,
                            from_agent=from_prev,
                            converse_mode=True,
                            ambient=False,
                            skip_memory=True,
                        )
                        line = _spoken_dialogue_only((retry.get("reply") or "").strip())
                        be = retry.get("backend") or be
                    except Exception:
                        line = ""
            if not line or _looks_like_prompt_echo(line) or looks_like_meta_banter(line):
                continue
            thread.append({
                "agent_id": speaker,
                "name": result.get("name") or speaker,
                "line": line,
                "mood": result.get("mood") or "happy",
                "backend": be,
            })
        except Exception as exc:
            log.warning("converse turn failed %s: %s", speaker, exc)
            continue

    # Only use full template scene if we got almost no live AI
    if ai_lines < 2 and len(thread) < 2:
        log.warning("converse fell back to aether templates (ai_lines=%s)", ai_lines)
        thread = aether_group_converse(
            ordered, topic_clean, visitor_name=visitor_name, rounds=rounds,
        )
        used_backend = "aether"
        agent_model = "aether-local"
    elif not thread:
        thread = aether_group_converse(
            ordered, topic_clean, visitor_name=visitor_name, rounds=rounds,
        )
        used_backend = "aether"
        agent_model = "aether-local"

    # Multi-brain signature: which free backends spoke in this live circle
    brains_used = sorted({
        str(t.get("backend") or "")
        for t in thread
        if t.get("backend") and t.get("backend") != "aether"
    })
    return {
        "ok": True,
        "topic": topic_clean,
        "agents": ordered,
        "lines": thread,
        "backend": used_backend,
        "model": agent_model,
        "ai_lines": ai_lines,
        "live_ai": ai_lines >= 2,
        "multi_brain": brains_used,
        "orchestration": "sequential-turn free-chain (Ollama→Groq→Gemini→Grok) + shared live feed",
    }
