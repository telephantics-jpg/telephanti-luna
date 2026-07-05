"""Luna Firmament — moddable world runtime for multi-agent avatars (UE5 bridge)."""

from __future__ import annotations

import asyncio
import json
import logging
import time
from pathlib import Path
from typing import Any

log = logging.getLogger("luna.firmament")

from firmament.paths import ROOT as BASE, data_file

FIRMAMENT_DIR = BASE / "firmament"
PACKS_DIR = FIRMAMENT_DIR / "packs"
AGENTS_DIR = FIRMAMENT_DIR / "agents"
STATE_PATH = data_file("firmament_state.json")

DEFAULT_PACK_ID = "aurora_playground"


def _read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def _write_json(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data, indent=2), encoding="utf-8")


class FirmamentHub:
    """Shared world state — Python brain, Unreal body, web observers."""

    def __init__(self) -> None:
        self.pack_id = DEFAULT_PACK_ID
        self.pack: dict = {}
        self.agents: dict[str, dict] = {}
        self.hallucination: dict = {}
        self.tick = 0
        self.started_at = time.time()
        self._clients: set[Any] = set()
        self._lock = asyncio.Lock()
        self.reload_pack(DEFAULT_PACK_ID)

    def list_packs(self) -> list[dict]:
        out = []
        for path in sorted(PACKS_DIR.glob("*.json")):
            try:
                data = _read_json(path)
                out.append({
                    "id": data.get("id") or path.stem,
                    "name": data.get("name", path.stem),
                    "description": data.get("description", ""),
                })
            except (OSError, json.JSONDecodeError):
                continue
        return out

    def load_agent_defs(self, pack: dict) -> dict[str, dict]:
        agents: dict[str, dict] = {}
        for entry in pack.get("agents", []):
            agent_id = entry.get("id")
            if not agent_id:
                continue
            agent_path = AGENTS_DIR / f"{agent_id}.json"
            if agent_path.is_file():
                try:
                    base = _read_json(agent_path)
                except (OSError, json.JSONDecodeError):
                    base = {"id": agent_id, "name": agent_id}
            else:
                base = {"id": agent_id, "name": agent_id}
            merged = {**base, **entry}
            merged.setdefault("position", entry.get("spawn", [0.5, 0.2, 0.0]))
            merged.setdefault("state", "idle")
            merged.setdefault("mood", "happy")
            agents[agent_id] = merged
        return agents

    def reload_pack(self, pack_id: str) -> dict:
        if pack_id == "zombie_outbreak":
            log.info("zombie_outbreak blocked — using aurora_playground")
            pack_id = DEFAULT_PACK_ID
        path = PACKS_DIR / f"{pack_id}.json"
        if not path.is_file():
            raise FileNotFoundError(f"Firmament pack not found: {pack_id}")
        pack = _read_json(path)
        self.pack_id = pack.get("id") or pack_id
        self.pack = pack
        self.agents = self.load_agent_defs(pack)
        self.hallucination = {
            "enabled": bool(pack.get("hallucination", {}).get("enabled")),
            "intensity": float(pack.get("hallucination", {}).get("intensity", 0.35)),
            "seed": int(pack.get("hallucination", {}).get("seed", 42)),
            "prompt": pack.get("hallucination", {}).get("prompt_template", ""),
            "last_at": 0.0,
        }
        self._persist()
        return self.snapshot()

    def _persist(self) -> None:
        try:
            _write_json(STATE_PATH, self.snapshot())
        except OSError as exc:
            log.warning("firmament state write failed: %s", exc)

    def snapshot(self) -> dict:
        return {
            "pack_id": self.pack_id,
            "pack": self.pack,
            "agents": self.agents,
            "hallucination": self.hallucination,
            "tick": self.tick,
            "uptime_sec": round(time.time() - self.started_at, 1),
            "clients": len(self._clients),
        }

    async def register(self, ws: Any) -> None:
        async with self._lock:
            self._clients.add(ws)
        await self.send_to(ws, {"type": "firmament.snapshot", "data": self.snapshot()})

    async def unregister(self, ws: Any) -> None:
        async with self._lock:
            self._clients.discard(ws)

    async def send_to(self, ws: Any, message: dict) -> None:
        try:
            await ws.send_json(message)
        except Exception:
            await self.unregister(ws)

    async def broadcast(self, message: dict) -> None:
        async with self._lock:
            clients = list(self._clients)
        dead: list[Any] = []
        for ws in clients:
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            await self.unregister(ws)

    async def handle_message(self, raw: dict) -> dict | None:
        msg_type = raw.get("type", "")
        if msg_type == "firmament.ping":
            return {"type": "firmament.pong", "tick": self.tick}
        if msg_type == "firmament.load_pack":
            pack_id = str(raw.get("pack_id") or DEFAULT_PACK_ID)
            snap = self.reload_pack(pack_id)
            await self.broadcast({"type": "firmament.pack_loaded", "data": snap})
            return {"type": "firmament.pack_loaded", "data": snap}
        if msg_type == "firmament.agent.action":
            agent_id = str(raw.get("agent_id") or "")
            action = str(raw.get("action") or "idle")
            payload = raw.get("payload") or {}
            if agent_id not in self.agents:
                return {"type": "firmament.error", "error": f"unknown agent: {agent_id}"}
            agent = self.agents[agent_id]
            agent["state"] = action
            if "mood" in payload:
                agent["mood"] = payload["mood"]
            if "position" in payload:
                agent["position"] = payload["position"]
            if "line" in payload:
                agent["last_line"] = payload["line"]
            agent["updated_at"] = time.time()
            self.tick += 1
            self._persist()
            event = {"type": "firmament.agent.updated", "agent_id": agent_id, "agent": agent}
            await self.broadcast(event)
            return event
        if msg_type == "firmament.hallucinate":
            prompt = str(raw.get("prompt") or self.hallucination.get("prompt") or "")
            intensity = float(raw.get("intensity", self.hallucination.get("intensity", 0.35)))
            self.hallucination.update({
                "enabled": True,
                "intensity": intensity,
                "prompt": prompt,
                "last_at": time.time(),
                "seed": int(raw.get("seed", self.hallucination.get("seed", 42))),
            })
            self.tick += 1
            self._persist()
            event = {"type": "firmament.hallucination", "data": dict(self.hallucination)}
            await self.broadcast(event)
            return event
        if msg_type == "firmament.agent.chat":
            agent_id = str(raw.get("agent_id") or "luna")
            text = str(raw.get("message") or raw.get("text") or "").strip()
            if not text:
                return {"type": "firmament.error", "error": "message required"}
            try:
                from firmament.brain import agent_chat

                result = await agent_chat(
                    agent_id,
                    text,
                    pack_name=str(self.pack.get("name") or self.pack_id),
                )
            except Exception as exc:
                return {"type": "firmament.error", "error": str(exc)}
            self.apply_chat_to_agent(agent_id, "assistant", result["reply"], result.get("mood", "happy"))
            if agent_id in self.agents:
                self.agents[agent_id]["state"] = "speak"
            event = {
                "type": "firmament.agent.spoke",
                "agent_id": agent_id,
                "agent": self.agents.get(agent_id),
                "reply": result["reply"],
                "mood": result.get("mood", "happy"),
            }
            await self.broadcast(event)
            return event
        if msg_type == "firmament.game.event":
            from firmament.game_state import apply_event

            event = str(raw.get("event") or "")
            payload = raw.get("payload") or {}
            if not event:
                return {"type": "firmament.error", "error": "event required"}
            state = apply_event(event, payload)
            self.tick += 1
            out = {"type": "firmament.game.updated", "state": state}
            await self.broadcast(out)
            return out
        if msg_type == "firmament.tick":
            self.tick += 1
            return {"type": "firmament.tick", "tick": self.tick}
        return {"type": "firmament.error", "error": f"unknown type: {msg_type}"}

    def apply_chat_to_agent(self, agent_id: str, role: str, text: str, mood: str = "happy") -> None:
        if agent_id not in self.agents:
            return
        agent = self.agents[agent_id]
        agent["state"] = "speak" if role == "assistant" else "listen"
        agent["mood"] = mood
        agent["last_line"] = text[:240]
        agent["updated_at"] = time.time()
        self.tick += 1
        self._persist()


_hub: FirmamentHub | None = None


def get_hub() -> FirmamentHub:
    global _hub
    if _hub is None:
        _hub = FirmamentHub()
    return _hub