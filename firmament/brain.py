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
    path = AGENTS_DIR / f"{agent_id}.json"
    if not path.is_file():
        return {"id": agent_id, "name": agent_id, "persona": f"You are {agent_id}, an AI character in the Luna firmament."}
    return json.loads(path.read_text(encoding="utf-8"))


def _agent_system_prompt(
    profile: dict,
    pack_name: str = "",
    game_context: str = "",
    camp_context: str = "",
) -> str:
    name = profile.get("name") or profile.get("id") or "Agent"
    persona = profile.get("persona") or "A helpful AI character."
    world = f"World pack: {pack_name}." if pack_name else ""
    game = f"Live game state: {game_context}" if game_context else ""
    camp = f"Camp bond memory: {camp_context}" if camp_context else ""
    moods = "happy|neutral|alert|afraid|urgent|think|love|flirt"
    return (
        f"You are {name}, an NPC in an Unreal Engine game world. {world} {game} {camp}\n"
        f"Persona: {persona}\n"
        "Reply in 1-3 short spoken sentences. Stay in character. "
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


def _complete_messages(messages: list[dict], *, model: str | None = None) -> str:
    backend = llm_backend()
    if backend == "ollama":
        import httpx

        host = os.getenv("OLLAMA_HOST", "http://127.0.0.1:11434").rstrip("/")
        ollama_model = model or os.getenv("OLLAMA_MODEL", "llama3.2")
        payload = {
            "model": ollama_model,
            "messages": messages,
            "stream": False,
            "options": {"temperature": 0.85},
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
    resp = client.chat.completions.create(model=grok_model, messages=messages, temperature=0.85)
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
) -> dict[str, Any]:
    message = (message or "").strip()
    if len(message) < 1:
        raise ValueError("message required")

    profile = load_agent_profile(agent_id)
    memory = _load_memory()
    if clear_memory:
        memory.pop(agent_id, None)

    history = memory.get(agent_id, [])
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
    sys_prompt = _agent_system_prompt(profile, pack_name, game_context, camp_context)
    if from_agent:
        other = load_agent_profile(from_agent)
        sys_prompt += f"\nYou are replying to {other.get('name', from_agent)}, another NPC."

    messages = [{"role": "system", "content": sys_prompt}]
    for turn in history[-MAX_MEMORY_TURNS:]:
        if turn.get("role") in ("user", "assistant") and turn.get("content"):
            messages.append({"role": turn["role"], "content": turn["content"]})
    messages.append({"role": "user", "content": message})

    import asyncio

    backend = llm_backend()
    if backend == "ollama":
        agent_model = profile.get("ollama_model") or os.getenv("OLLAMA_MODEL", "llama3.2")
    else:
        agent_model = profile.get("grok_model") or os.getenv("GROK_MODEL", "grok-4-fast-non-reasoning")
    raw = await asyncio.to_thread(_complete_messages, messages, model=agent_model)
    raw = (raw or "").strip()
    reply, mood = _parse_mood(raw)
    if not reply:
        reply = "I'm here — say that again?"

    history = history + [
        {"role": "user", "content": message},
        {"role": "assistant", "content": reply},
    ]
    memory[agent_id] = history[-MAX_MEMORY_TURNS * 2 :]
    _save_memory(memory)

    return {
        "agent_id": agent_id,
        "name": profile.get("name", agent_id),
        "reply": reply,
        "mood": mood,
        "model": agent_model,
        "backend": backend,
    }


async def agents_converse(
    agent_a: str,
    agent_b: str,
    topic: str = "Life at the Luna Firmament playground camp — what should we explore next?",
    rounds: int = 2,
    *,
    pack_name: str = "",
    visitor_id: str = "",
    visitor_name: str = "",
) -> dict[str, Any]:
    """Two NPCs talk to each other (for Unreal or firmament observer)."""
    rounds = max(1, min(5, int(rounds)))
    lines: list[dict] = []
    last_line = topic
    current_speaker = agent_a
    listener = agent_b

    for _ in range(rounds):
        result = await agent_chat(
            current_speaker,
            last_line,
            pack_name=pack_name,
            from_agent=listener,
            visitor_id=visitor_id,
            visitor_name=visitor_name,
        )
        line = {
            "agent_id": current_speaker,
            "name": result["name"],
            "line": result["reply"],
            "mood": result.get("mood", "neutral"),
        }
        lines.append(line)
        last_line = result["reply"]
        current_speaker, listener = listener, current_speaker

    return {"topic": topic, "rounds": rounds, "lines": lines, "backend": llm_backend()}