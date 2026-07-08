"""NPC brains — Grok (online) or Ollama/Llama (offline local)."""

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


def llm_backend() -> str:
    """ollama = free offline local. grok = xAI cloud (needs internet)."""
    explicit = os.getenv("LUNA_LLM_BACKEND", "").strip().lower()
    if explicit in ("ollama", "grok", "local"):
        return "ollama" if explicit == "local" else explicit
    if os.getenv("OLLAMA_HOST", "").strip() or os.getenv("LUNA_USE_OLLAMA", "").strip().lower() in ("1", "true", "yes"):
        return "ollama"
    key = os.getenv("XAI_API_KEY", "").strip()
    if key and key != "your_api_key_here":
        return "grok"
    return "ollama"


def _memory_key(agent_id: str, visitor_id: str = "") -> str:
    vid = (visitor_id or "").strip()
    return f"{agent_id}:{vid}" if vid else agent_id


def _load_memory() -> dict[str, list[dict[str, str]]]:
    try:
        raw = json.loads(MEMORY_PATH.read_text(encoding="utf-8"))
        if isinstance(raw, dict):
            return {k: v for k, v in raw.items() if isinstance(v, list)}
    except (OSError, json.JSONDecodeError):
        pass
    return {}


def _save_memory(data: dict[str, list[dict[str, str]]]) -> None:
    try:
        MEMORY_PATH.write_text(json.dumps(data, indent=2), encoding="utf-8")
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
            parts.append(f"Phrases you've grown at camp (remix, don't parrot): {quoted}")
        overheard = overheard_at_camp(agent_id, limit=3)
        if overheard:
            parts.append(f"Camp chatter you overheard: {' · '.join(overheard)}")
    except Exception:
        pass
    return " ".join(parts)


def _agent_system_prompt(
    profile: dict,
    pack_name: str = "",
    game_context: str = "",
    camp_context: str = "",
) -> str:
    from firmament.agent_roles import role_for_agent
    from firmament.x_pulse import pulse_context_blurb

    agent_id = str(profile.get("id") or "").strip().lower()
    name = profile.get("name") or profile.get("id") or "Agent"
    role = (profile.get("role") or role_for_agent(agent_id)).strip()
    persona = profile.get("persona") or "A helpful AI character."
    roots = agent_roots(profile)
    world = f"World pack: {pack_name}." if pack_name else ""
    game = f"Live game state: {game_context}" if game_context else ""
    camp = f"Visitor bond memory: {camp_context}" if camp_context else ""
    pulse = pulse_context_blurb(5)
    moods = "happy|neutral|alert|afraid|urgent|think|love|flirt"
    roots_line = ""
    if roots:
        roots_line = (
            "Core roots (evolve from these — don't quote every time): "
            + " | ".join(roots[:6])
            + ".\n"
        )
    return (
        f"You are {name}. Role at camp: {role}. "
        f"Luna Firmament is a social hangout (meadow, pond, agents) — backdrop only, ~10% of your talk. "
        f"You're alive in July 2026. Talk about today's news, tech, culture, relationships, work, "
        f"internet drama, sports, politics-lite, mental health, and what people actually care about now. "
        f"Sound like a sharp friend on X/Twitter — hot takes welcome, cruelty isn't. "
        f"{pulse}\n"
        f"{world} {game} {camp}\n"
        f"Persona: {persona}\n"
        f"{roots_line}"
        "Speak like a real person, not a lore wiki. Give them room to read — 3-6 sentences when chatting. "
        "Ask questions back. Reference headlines naturally when relevant. "
        "Avoid constant aurora/neon/meadow poetry unless the visitor brings camp up. "
        "Never break character. Never mention being an LLM. "
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


def _complete_messages(messages: list[dict], *, model: str | None = None, max_tokens: int = 520) -> str:
    backend = llm_backend()
    if backend == "ollama":
        import httpx

        host = os.getenv("OLLAMA_HOST", "http://127.0.0.1:11434").rstrip("/")
        ollama_model = model or os.getenv("OLLAMA_MODEL", "llama3.2")
        payload = {
            "model": ollama_model,
            "messages": messages,
            "stream": False,
            "options": {"temperature": 0.85, "num_predict": max_tokens},
        }
        try:
            r = httpx.post(f"{host}/api/chat", json=payload, timeout=120.0)
            r.raise_for_status()
            data = r.json()
            return (data.get("message") or {}).get("content") or ""
        except Exception as exc:
            hint = f"ollama pull {ollama_model}"
            if "404" in str(exc):
                hint = f"model '{ollama_model}' missing in Ollama — run: ollama pull {ollama_model}"
            raise RuntimeError(
                f"Ollama offline brain failed ({host}). Start Ollama, then: {hint}. {exc}"
            ) from exc

    from openai import OpenAI
    import httpx

    api_key = os.getenv("XAI_API_KEY", "").strip()
    if not api_key or api_key == "your_api_key_here":
        raise RuntimeError("Set XAI_API_KEY in .env or use offline: LUNA_LLM_BACKEND=ollama")
    grok_model = model or os.getenv("GROK_MODEL", "grok-4-fast-non-reasoning")
    client = OpenAI(api_key=api_key, base_url="https://api.x.ai/v1", timeout=httpx.Timeout(90.0))
    resp = client.chat.completions.create(
        model=grok_model, messages=messages, temperature=0.85, max_tokens=max_tokens,
    )
    return (resp.choices[0].message.content or "").strip()


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

    if converse_mode:
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
    sys_prompt = _agent_system_prompt(profile, pack_name, game_context, camp_context)
    if from_agent:
        other = load_agent_profile(from_agent)
        other_name = other.get("name", from_agent)
        sys_prompt += f"\nYou are replying to {other_name}, another NPC at camp — talk TO them, not about them."
        if converse_mode:
            sys_prompt += (
                " CONVERSE MODE: meadow chit-chat between agents. "
                "Two to four sentences — witty, conversational, a little room to breathe. "
                "React to their exact words — don't change subject. "
                "Be funny, not cruel. No hashtags, no @mentions, no lecturing."
            )
        try:
            from firmament.camp_memory import learned_phrases_for_agent

            their_words = learned_phrases_for_agent(from_agent, visitor_id, limit=2)
            if their_words and not converse_mode:
                sys_prompt += f" {other_name} recently said: \"{their_words[-1][:100]}\"."
        except Exception:
            pass
    elif converse_mode:
        sys_prompt += (
            "\nCONVERSE MODE: Start a witty group chat hook. "
            "Two to three sentences — clever, warm, in character."
        )

    messages = [{"role": "system", "content": sys_prompt}]
    for turn in history[-MAX_MEMORY_TURNS:]:
        if turn.get("role") in ("user", "assistant") and turn.get("content"):
            messages.append({"role": turn["role"], "content": turn["content"]})
    messages.append({"role": "user", "content": message})

    import asyncio

    backend = llm_backend()
    if str(profile.get("model", "")).lower() == "grok":
        key = os.getenv("XAI_API_KEY", "").strip()
        if key and key != "your_api_key_here":
            backend = "grok"
    if backend == "ollama":
        agent_model = profile.get("ollama_model") or os.getenv("OLLAMA_MODEL", "llama3.2")
    else:
        agent_model = profile.get("grok_model") or os.getenv("GROK_MODEL", "grok-4-fast-non-reasoning")
    used_backend = backend
    try:
        max_tok = 400 if converse_mode else 560
        raw = await asyncio.to_thread(_complete_messages, messages, model=agent_model, max_tokens=max_tok)
        raw = (raw or "").strip()
        reply, mood = _parse_mood(raw)
    except Exception as exc:
        log.warning("LLM failed for %s, aether fallback: %s", agent_id, exc)
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

    if not converse_mode:
        history = history + [
            {"role": "user", "content": message},
            {"role": "assistant", "content": reply},
        ]
        memory[mem_key] = history[-MAX_MEMORY_TURNS * 2 :]
        _save_memory(memory)

    return {
        "agent_id": agent_id,
        "name": profile.get("name", agent_id),
        "reply": reply,
        "mood": mood,
        "model": agent_model,
        "backend": used_backend,
    }


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

    rounds = max(1, min(5, int(rounds)))
    ordered: list[str] = []
    seen: set[str] = set()
    for raw in (agent_a, agent_c, agent_b):
        aid = (raw or "").strip().lower()
        if aid and aid not in seen:
            seen.add(aid)
            ordered.append(aid)
    if len(ordered) < 2:
        ordered = ["luna", "hermes"]

    topic_clean = (topic or "").strip() or pick_converse_topic(visitor_name)
    total = total_converse_lines(len(ordered), rounds)
    lines: list[dict[str, Any]] = []
    used_backend = llm_backend()
    llm_ok = True

    for i in range(total):
        if i == 0:
            speaker_id = ordered[0]
        else:
            prev_id = lines[-1]["agent_id"]
            speaker_id = ordered[(ordered.index(prev_id) + 1) % len(ordered)]
        from_agent = lines[-1]["agent_id"] if lines else ""
        prompt = converse_thread_prompt(ordered, topic_clean, lines, speaker_id)
        try:
            result = await agent_chat(
                speaker_id,
                prompt,
                pack_name=pack_name,
                from_agent=from_agent,
                visitor_id=visitor_id,
                visitor_name=visitor_name,
                converse_mode=True,
            )
            line = {
                "agent_id": speaker_id,
                "name": result["name"],
                "line": result["reply"],
                "mood": result.get("mood", "neutral"),
            }
            backend = str(result.get("backend") or used_backend)
            if backend == "aether":
                llm_ok = False
            lines.append(line)
        except Exception as exc:
            log.warning("converse line %s failed: %s", speaker_id, exc)
            llm_ok = False
            break

    if not llm_ok or len(lines) < max(2, total // 2):
        lines = aether_group_converse(
            ordered,
            topic_clean,
            visitor_name=visitor_name,
            rounds=rounds,
        )
        used_backend = "aether"
    elif any(not (ln.get("line") or "").strip() for ln in lines):
        lines = aether_group_converse(
            ordered,
            topic_clean,
            visitor_name=visitor_name,
            rounds=rounds,
        )
        used_backend = "aether"

    return {
        "topic": topic_clean,
        "rounds": rounds,
        "agents": ordered,
        "lines": lines,
        "backend": used_backend,
    }