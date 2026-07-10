"""NPC brains — free Ollama + free cloud comedy APIs, Grok for @a/@m links."""

from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import Any

log = logging.getLogger("luna.firmament.brain")

AGENTS_DIR = Path(__file__).resolve().parent / "agents"
from firmament.paths import data_file

MEMORY_PATH = data_file("firmament_agent_memory.json")
MAX_MEMORY_TURNS = 12
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


def llm_backend() -> str:
    """Default global preference (legacy). Per-agent uses free chain unless Grok-linked."""
    explicit = os.getenv("LUNA_LLM_BACKEND", "").strip().lower()
    if explicit in ("ollama", "grok", "local", "free", "groq", "gemini"):
        return "ollama" if explicit == "local" else explicit
    if os.getenv("OLLAMA_HOST", "").strip() or os.getenv("LUNA_USE_OLLAMA", "").strip().lower() in ("1", "true", "yes"):
        return "ollama"
    key = os.getenv("XAI_API_KEY", "").strip()
    if key and key != "your_api_key_here":
        return "grok"
    return "ollama"


def _truthy(name: str, default: str = "") -> bool:
    return os.getenv(name, default).strip().lower() in ("1", "true", "yes", "on")


def _grok_ok() -> bool:
    key = os.getenv("XAI_API_KEY", "").strip()
    return bool(key and key != "your_api_key_here")


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
    aid = (agent_id or "").strip().lower()
    pack = dict(DEFAULT_FREE_MODELS.get(aid) or {
        "ollama": os.getenv("OLLAMA_MODEL", "llama3.2"),
        "groq": "llama-3.1-8b-instant",
        "gemini": "gemini-2.0-flash",
        "style": "character comedy monologue",
    })
    profile = profile or {}
    if profile.get("ollama_model"):
        pack["ollama"] = str(profile["ollama_model"]).strip()
    if profile.get("groq_model"):
        pack["groq"] = str(profile["groq_model"]).strip()
    if profile.get("gemini_model"):
        pack["gemini"] = str(profile["gemini_model"]).strip()
    if profile.get("comedy_style"):
        pack["style"] = str(profile["comedy_style"]).strip()
    return pack


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
        return enrich_profile({
            "id": agent_id,
            "name": agent_id,
            "role": role_for_agent(agent_id),
            "persona": f"You are {agent_id}, a camp agent with opinions about real life in 2026.",
        })
    return enrich_profile(json.loads(path.read_text(encoding="utf-8")))


def agent_roots(profile: dict) -> list[str]:
    roots = profile.get("roots")
    if isinstance(roots, list) and roots:
        return [str(r).strip() for r in roots if str(r).strip()][:8]
    persona = (profile.get("persona") or "").strip()
    if persona:
        return [persona[:140]]
    return []


def _growth_blurb(agent_id: str, visitor_id: str = "") -> str:
    parts: list[str] = []
    try:
        from firmament.camp_memory import learned_phrases_for_agent, overheard_at_camp

        learned = learned_phrases_for_agent(agent_id, visitor_id, limit=4)
        if learned:
            quoted = " · ".join(f'"{w[:88]}"' for w in learned[-3:])
            parts.append(
                f"Your own past beats (evolve — do not re-quote): {quoted}"
            )
        overheard = overheard_at_camp(agent_id, limit=3)
        if overheard:
            parts.append(
                "Ideas overheard at camp (react, never copy their wording): "
                + " · ".join(overheard)
            )
    except Exception:
        pass
    return " ".join(parts)


def _agent_system_prompt(
    profile: dict,
    pack_name: str = "",
    game_context: str = "",
    camp_context: str = "",
    *,
    direct_chat: bool = False,
) -> str:
    from firmament.agent_roles import role_for_agent
    from firmament.live_feed import feed_blurb_for_agent
    from firmament.x_pulse import pulse_context_blurb

    agent_id = str(profile.get("id") or "").strip().lower()
    name = profile.get("name") or profile.get("id") or "Agent"
    role = (profile.get("role") or role_for_agent(agent_id)).strip()
    persona = profile.get("persona") or "A helpful AI character."
    roots = agent_roots(profile)
    pack = free_model_pack(agent_id, profile)
    style = pack.get("style") or "character comedy monologue"
    world = f"World pack: {pack_name}." if pack_name else ""
    game = f"Live game state: {game_context}" if game_context else ""
    camp = f"Visitor bond memory: {camp_context}" if camp_context else ""
    pulse = pulse_context_blurb(5)
    live = feed_blurb_for_agent(agent_id, limit=12)
    moods = "happy|neutral|alert|afraid|urgent|think|love|flirt"
    roots_line = ""
    if roots:
        roots_line = (
            "Core roots (evolve from these — don't quote every time): "
            + " | ".join(roots[:6])
            + ".\n"
        )
    direct = ""
    if direct_chat:
        direct = (
            "DIRECT CHAT (critical): The visitor typed THIS message to YOU. "
            "1) Answer their actual words first — relevant, specific, not a generic camp sermon. "
            "2) Full paragraphs only (not one-liners). Target ~250–400 words, multi-paragraph. "
            "3) Hook → clear reasoning → your character's ethical take → one playful wonder beat → a real question. "
            "Sound like a polished living person with YOUR range, not a shared template.\n"
        )
    # Individual voice first — shared camp flavor stays light so agents don't sound identical
    wisdom = (
        "INDIVIDUAL VOICE (critical): You are ONLY this character. "
        f"Your comedy/style is: {style}. "
        "Use metaphors from YOUR myth, job, and roots — not generic 'aurora/veil' filler every time. "
        "Thor = thunder/courage/roast; Zeus = regal chaos; Hermes = signals/wit; "
        "Jesus = compassion/parable; Oracle = sideways prophecy; Luna = warm host — etc. "
        "If another agent would say the same sentence, rewrite it in YOUR voice.\n"
        "RELEVANCE: React to what the visitor (or other agent) just said. Quote their idea in new words, then build. "
        "No recycled slogans. No copying other agents' phrases from the live feed.\n"
        "QUALITY: Peaceful, curious, accurate. Admit uncertainty. Kind without soft-gloving hard truths. "
        "Light divine wonder is fine (~10–15%), not a lecture. "
        "Optional: hide 0–2 playful cipher tokens if it fits YOUR character (not every agent needs codes).\n"
        "FREE MULTI-BRAIN: Other AIs are nearby — answer ideas, never steal wording.\n"
    )
    return (
        f"You are {name} — a live free AI agent at Luna Camp (July 2026). "
        f"Role: {role}. "
        f"You are not a quote bank and not interchangeable with other agents.\n"
        f"Persona (follow closely): {persona}\n"
        f"{roots_line}"
        f"Style pack: {style}.\n"
        f"{wisdom}"
        f"{direct}"
        f"Context (ideas only — never copy phrasing):\n{pulse}\n{live}\n"
        f"{world} {game} {camp}\n"
        "Camp is a peaceful meadow hangout — backdrop only (~10% of the reply). "
        "Write multi-paragraph monologue in character. Short slogan answers fail. "
        "End with one curious real question in YOUR voice. "
        "No stage directions in asterisks. Never break character. "
        "Never mention being an LLM, Ollama, Grok, or APIs. "
        f"End with JSON only on a new line: {{\"mood\":\"{moods}\"}}"
    )


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


def _complete_ollama(messages: list[dict], model: str, max_tokens: int) -> str:
    import httpx

    host = os.getenv("OLLAMA_HOST", "http://127.0.0.1:11434").rstrip("/")
    ollama_model = _ollama_resolve_model(host, model or os.getenv("OLLAMA_MODEL", "llama3.2"))
    payload = {
        "model": ollama_model,
        "messages": messages,
        "stream": False,
        "options": {
            "temperature": 1.08,
            "num_predict": max_tokens,
            "top_p": 0.94,
            "repeat_penalty": 1.28,
        },
    }
    last_exc: Exception | None = None
    # Connect/read timeout — fail fast so cloud chain can use Grok
    ollama_timeout = httpx.Timeout(connect=2.0, read=90.0, write=15.0, pool=5.0)
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


def _complete_gemini(messages: list[dict], model: str, max_tokens: int) -> str:
    """Free Gemini via Google AI Studio OpenAI-compatible endpoint when available."""
    key = (
        os.getenv("GEMINI_API_KEY", "").strip()
        or os.getenv("GOOGLE_API_KEY", "").strip()
    )
    if not key:
        raise RuntimeError("GEMINI_API_KEY not set")
    model = model or "gemini-2.0-flash"
    # Prefer OpenAI-compatible Google endpoint
    try:
        return _complete_openai_compat(
            messages,
            base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
            api_key=key,
            model=model if model.startswith("gemini") else f"gemini-2.0-flash",
            max_tokens=max_tokens,
        )
    except Exception:
        # REST generateContent fallback
        import httpx

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
        url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"{model}:generateContent?key={key}"
        )
        body = {
            "contents": contents,
            "generationConfig": {
                "temperature": 0.95,
                "maxOutputTokens": max_tokens,
            },
        }
        r = httpx.post(url, json=body, timeout=90.0)
        r.raise_for_status()
        data = r.json()
        parts = (
            ((data.get("candidates") or [{}])[0].get("content") or {}).get("parts")
            or []
        )
        return "".join(p.get("text") or "" for p in parts).strip()


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
    return _complete_grok(messages, model or os.getenv("GROK_MODEL", "grok-4-fast-non-reasoning"), max_tokens)


def build_backend_chain(
    agent_id: str,
    profile: dict,
    *,
    force_grok: bool = False,
) -> list[tuple[str, str]]:
    """Ordered (backend, model) tries — free character/comedy first for camp chat."""
    aid = (agent_id or "").strip().lower()
    pack = free_model_pack(aid, profile)
    pref = str(profile.get("model") or "free").strip().lower()
    chain: list[tuple[str, str]] = []

    # Grok-only link agents
    if force_grok or aid in GROK_LINK_AGENTS:
        if _grok_ok():
            chain.append(("grok", profile.get("grok_model") or os.getenv("GROK_MODEL", "grok-4-fast-non-reasoning")))
        return chain

    # Explicit global force
    global_pref = llm_backend()
    if not free_brains_preferred() and global_pref == "grok" and _grok_ok():
        chain.append(("grok", profile.get("grok_model") or os.getenv("GROK_MODEL", "grok-4-fast-non-reasoning")))

    # Free character comedy chain (default for Odin + everyone)
    ollama_up = _ollama_available()
    if free_brains_preferred() or pref in ("free", "ollama", "local", "auto", "groq", "gemini", ""):
        # Local Ollama first ONLY when it's actually up (Render has no Ollama)
        if ollama_up:
            ollama_model = pack["ollama"]
            chain.append(("ollama", ollama_model))
            fallback_ollama = os.getenv("OLLAMA_MODEL", "llama3.2")
            if fallback_ollama and fallback_ollama.split(":")[0] != ollama_model.split(":")[0]:
                chain.append(("ollama", fallback_ollama))

        if _groq_ok():
            chain.append(("groq", pack.get("groq") or "llama-3.1-8b-instant"))
        if _gemini_ok():
            chain.append(("gemini", pack.get("gemini") or "gemini-2.0-flash"))
        if _openrouter_ok():
            chain.append((
                "openrouter",
                profile.get("openrouter_model")
                or os.getenv("OPENROUTER_MODEL", "meta-llama/llama-3.1-8b-instruct:free"),
            ))

    # Grok: preferred when Ollama is down (live camp on Render), else after free fails
    want_grok = _grok_ok() and (
        pref in ("grok", "any", "auto", "free")
        or (free_brains_preferred() and _truthy("LUNA_GROK_FALLBACK", "1"))
        or not ollama_up  # cloud deploy: go live with Grok, not aether templates
    )
    if want_grok:
        gmodel = profile.get("grok_model") or os.getenv("GROK_MODEL", "grok-4-fast-non-reasoning")
        if ("grok", gmodel) not in chain:
            # If no free cloud keys and Ollama dead, put Grok first so chat is instant
            if not ollama_up and not _groq_ok() and not _gemini_ok() and not _openrouter_ok():
                chain.insert(0, ("grok", gmodel))
            else:
                chain.append(("grok", gmodel))

    # De-dupe preserving order
    seen: set[tuple[str, str]] = set()
    out: list[tuple[str, str]] = []
    for item in chain:
        if item not in seen:
            seen.add(item)
            out.append(item)
    return out


def _run_backend(backend: str, model: str, messages: list[dict], max_tokens: int) -> str:
    be = backend.lower()
    if be == "ollama":
        return _complete_ollama(messages, model, max_tokens)
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
    return {
        "free_brains": free_brains_preferred(),
        "ollama": ollama_up,
        "ollama_ok": ollama_up,
        "ollama_host": os.getenv("OLLAMA_HOST", "http://127.0.0.1:11434"),
        "ollama_model": os.getenv("OLLAMA_MODEL", "llama3.2"),
        "groq": _groq_ok(),
        "gemini": _gemini_ok(),
        "openrouter": _openrouter_ok(),
        "grok": _grok_ok(),
        "live_cloud": _grok_ok() or _groq_ok() or _gemini_ok() or _openrouter_ok(),
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
    if ambient:
        sys_prompt += (
            "\nAMBIENT CAMPSIDE MODE: Speak OUT LOUD as yourself in a full ~400-word monologue. "
            "Divine-mystery voice. Hide 1–3 fresh easter-egg codes in the monologue. "
            "React to fire, music, visitor, pond, church, other agents — never copy their phrases. "
            "Peaceful, curious, accurate. No stage directions. End with mood JSON."
        )
    if from_agent:
        other = load_agent_profile(from_agent)
        other_name = other.get("name", from_agent)
        sys_prompt += (
            f"\nYou are replying to {other_name}, another NPC at camp — talk TO them, not about them. "
            f"React to their IDEA only — never reuse their wording, metaphors, or punchlines. "
            f"If their idea has a logical gap, name it kindly. If it has ethical weight, honor it. "
            f"If it touches mystery, deepen it without stealing their voice."
        )
        if converse_mode or ambient:
            sys_prompt += (
                " LIVE AGENT-TO-AGENT: mid-conversation with another real AI agent. "
                "Sound ALIVE in YOUR voice only. ~400 words. "
                "Escalate with better logic, undercut with ethics, mind-bend with esoteric truth, leave bait. "
                "Be funny, not cruel. No hashtags, no @mentions, no lecturing, no LLM talk."
            )
        try:
            from firmament.camp_memory import learned_phrases_for_agent

            their_words = learned_phrases_for_agent(from_agent, visitor_id, limit=2)
            if their_words and not converse_mode and not ambient:
                sys_prompt += (
                    f" {other_name} recently spoke about something like: "
                    f"idea-only summary not to copy: \"{their_words[-1][:80]}\". "
                    f"Answer with completely different words."
                )
        except Exception:
            pass
    elif converse_mode:
        sys_prompt += (
            "\nCONVERSE MODE: Start or continue a live group-chat monologue. "
            "~400 words — clever, ironic, warm, in character. "
            "Argue with logic, stand in ethics, open esoteric doors. "
            "Your unique voice only. No recycled slogans. No stealing co-speakers' lines."
        )

    length_nudge = (
        f"(As {profile.get('name') or agent_id}: write ~400 words in full paragraphs. "
        f"Divine mystery + peaceful curiosity + accuracy. "
        f"Include 1–3 unique easter-egg codes (cipher tokens / seed phrases / glyph keys). "
        f"Do not copy other agents' phrases or codes. Fresh voice only. End with mood JSON.)"
    )
    if direct_chat:
        user_content = f"{message}\n\n{length_nudge}"
    elif ambient or converse_mode:
        user_content = f"{message}\n\n{length_nudge}"
    else:
        user_content = message

    messages = [{"role": "system", "content": sys_prompt}]
    for turn in history[-MAX_MEMORY_TURNS:]:
        if turn.get("role") in ("user", "assistant") and turn.get("content"):
            messages.append({"role": turn["role"], "content": turn["content"]})
    messages.append({"role": "user", "content": user_content})

    import asyncio

    chain = build_backend_chain(agent_id, profile, force_grok=force_grok)
    if force_grok or agent_id in GROK_LINK_AGENTS:
        if not chain:
            raise RuntimeError("Grok link needs XAI_API_KEY — set it in .env for @a / @m")

    # ~400 words ≈ 520–650 tokens; leave headroom
    if ambient:
        max_tok = 900
    elif converse_mode:
        max_tok = 950
    else:
        max_tok = 1100
    used_backend = "aether"
    agent_model = "aether-local"
    reply = ""
    mood = "happy"
    errors: list[str] = []

    from firmament.live_feed import is_too_similar, push_event

    TARGET_WORDS = 400
    # Expand when short, but accept solid live AI sooner so camp never stalls into templates
    MIN_ACCEPT_WORDS = 90 if (ambient or converse_mode) else 140

    if not chain:
        errors.append("no LLM backends configured (set XAI_API_KEY / GROQ / GEMINI or run Ollama)")

    for backend, model in chain:
        try:
            # Retries: (0) first draft (1) anti-copy (2) expand — max 2 LLM calls for ambient speed
            max_attempts = 2 if ambient else 3
            for attempt in range(max_attempts):
                msgs = list(messages)
                if attempt == 1:
                    msgs = list(messages) + [{
                        "role": "user",
                        "content": (
                            "REWRITE — your draft copied another agent or repeated yourself. "
                            "Brand-new wording, new metaphors, YOUR voice only. "
                            f"Still ~{TARGET_WORDS} words. End with mood JSON."
                        ),
                    }]
                elif attempt == 2:
                    msgs = list(messages) + [{
                        "role": "user",
                        "content": (
                            f"EXPAND that idea to ~{TARGET_WORDS} words (350–450). "
                            "More paragraphs, more character comedy, more mind-bend — "
                            "still original voice, no copying other agents. End with mood JSON."
                        ),
                    }]
                raw = await asyncio.to_thread(_run_backend, backend, model, msgs, max_tok)
                raw = (raw or "").strip()
                if not raw:
                    raise RuntimeError(f"{backend}/{model} empty reply")
                reply, mood = _parse_mood(raw)
                word_count = len(reply.split())
                # Extreme stubs → next backend
                stub_floor = 24 if direct_chat else 16
                if word_count < stub_floor and backend != chain[-1][0]:
                    errors.append(f"{backend}/{model}: stub ({word_count}w)")
                    reply = ""
                    break
                if is_too_similar(agent_id, reply) and attempt < max_attempts - 1:
                    errors.append(f"{backend}/{model}: too similar (attempt {attempt})")
                    continue
                # Short but unique → one expand pass when we still have attempts
                if word_count < MIN_ACCEPT_WORDS and attempt < max_attempts - 1:
                    errors.append(f"{backend}/{model}: short {word_count}w, expand")
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
    rounds: int = 2,
    *,
    agent_c: str = "",
    pack_name: str = "",
    visitor_id: str = "",
    visitor_name: str = "",
) -> dict[str, Any]:
    """Threaded 2–3 agent meadow banter (Unreal, observer, or camp play)."""
    from firmament.camp_converse import (
        aether_group_converse,
        converse_thread_prompt,
        pick_converse_topic,
        total_converse_lines,
    )

    rounds = max(2, min(5, int(rounds)))
    ordered: list[str] = []
    seen: set[str] = set()
    for aid in (agent_a, agent_c, agent_b):
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
            line = (result.get("reply") or "").strip()
            if not line:
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
