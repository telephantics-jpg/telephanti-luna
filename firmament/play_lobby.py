"""Shared browser play lobby — visitor avatars, positions, camp chatter."""

from __future__ import annotations

import asyncio
import logging
import time
import uuid
from typing import Any

log = logging.getLogger("luna.play_lobby")

VISITOR_COLORS = [
    "#60a5fa", "#f472b6", "#34d399", "#fb923c",
    "#a78bfa", "#facc15", "#22d3ee", "#e879f9",
    "#4ade80", "#f87171", "#38bdf8", "#c084fc",
]


class PlayLobby:
    """In-memory lobby for /firmament/play — syncs visitors and chatter across tabs."""

    MAX_CHATTER = 100
    VISITOR_STALE_SEC = 50.0

    def __init__(self) -> None:
        self.visitors: dict[str, dict] = {}
        self._ws_map: dict[Any, str] = {}
        self._clients: set[Any] = set()
        self._lock = asyncio.Lock()
        self.chatter: list[dict] = []
        self.npc_mode: str = "free"

    def _prune_stale(self) -> None:
        now = time.time()
        stale = [
            vid for vid, v in self.visitors.items()
            if now - float(v.get("last_seen", 0)) > self.VISITOR_STALE_SEC
        ]
        for vid in stale:
            self.visitors.pop(vid, None)

    def visitor_snapshot(self) -> list[dict]:
        self._prune_stale()
        out: list[dict] = []
        for v in self.visitors.values():
            out.append({
                "id": v["id"],
                "name": v.get("name", "Traveler"),
                "color": v.get("color", "#60a5fa"),
                "x": float(v.get("x", 0)),
                "y": float(v.get("y", 120)),
                "mood": v.get("mood", "happy"),
            })
        return out

    async def register(self, ws: Any) -> None:
        async with self._lock:
            self._clients.add(ws)

    async def unregister(self, ws: Any) -> None:
        vid = self._ws_map.pop(ws, None)
        async with self._lock:
            self._clients.discard(ws)
            if vid:
                self.visitors.pop(vid, None)
        if vid:
            await self.broadcast({"type": "play.visitor.left", "visitor_id": vid})
        await self.broadcast_state()

    async def send_to(self, ws: Any, message: dict) -> None:
        try:
            await ws.send_json(message)
        except Exception:
            await self.unregister(ws)

    async def broadcast(self, message: dict, *, exclude: Any | None = None) -> None:
        async with self._lock:
            clients = [c for c in self._clients if c is not exclude]
        dead: list[Any] = []
        for ws in clients:
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            await self.unregister(ws)

    async def broadcast_state(self) -> None:
        await self.broadcast({
            "type": "play.state",
            "visitors": self.visitor_snapshot(),
            "npc_mode": self.npc_mode,
            "chatter_count": len(self.chatter),
        })

    def add_chatter(
        self,
        speaker: str,
        text: str,
        mood: str = "neutral",
        *,
        visitor_id: str | None = None,
        broadcast: bool = True,
    ) -> dict | None:
        clean = (text or "").strip()
        if not clean:
            return None
        entry = {
            "speaker": (speaker or "Camp")[:48],
            "text": clean[:600],
            "mood": (mood or "neutral").lower()[:24],
            "t": time.time(),
            "visitor_id": visitor_id,
        }
        self.chatter.append(entry)
        while len(self.chatter) > self.MAX_CHATTER:
            self.chatter.pop(0)
        return entry

    async def push_chatter(
        self,
        speaker: str,
        text: str,
        mood: str = "neutral",
        *,
        visitor_id: str | None = None,
    ) -> dict | None:
        entry = self.add_chatter(speaker, text, mood, visitor_id=visitor_id)
        if entry:
            await self.broadcast({"type": "play.chatter", "line": entry})
        return entry

    async def join(
        self,
        ws: Any,
        visitor_id: str | None,
        name: str | None,
        color: str | None,
    ) -> dict:
        vid = (visitor_id or "").strip()[:64] or str(uuid.uuid4())[:10]
        display = (name or "").strip()[:24] or f"Traveler-{vid[:4]}"
        tint = (color or "").strip()[:16]
        if not tint or not tint.startswith("#"):
            tint = VISITOR_COLORS[len(self.visitors) % len(VISITOR_COLORS)]

        self.visitors[vid] = {
            "id": vid,
            "name": display,
            "color": tint,
            "x": 0.0,
            "y": 120.0,
            "mood": "happy",
            "last_seen": time.time(),
        }
        self._ws_map[ws] = vid

        welcome = {
            "type": "play.welcome",
            "visitor_id": vid,
            "visitor": dict(self.visitors[vid]),
            "visitors": self.visitor_snapshot(),
            "chatter": self.chatter[-50:],
            "npc_mode": self.npc_mode,
        }
        await self.send_to(ws, welcome)
        await self.broadcast(
            {"type": "play.visitor.joined", "visitor": dict(self.visitors[vid])},
            exclude=ws,
        )
        return welcome

    async def handle(self, ws: Any, raw: dict) -> dict | None:
        msg_type = str(raw.get("type") or "")

        if msg_type == "play.join":
            await self.join(ws, raw.get("visitor_id"), raw.get("name"), raw.get("color"))
            return None

        vid = self._ws_map.get(ws)
        if not vid:
            return {"type": "play.error", "error": "join first"}

        visitor = self.visitors.get(vid)
        if not visitor:
            return {"type": "play.error", "error": "visitor missing"}

        if msg_type == "play.move":
            visitor["x"] = float(raw.get("x", visitor["x"]))
            visitor["y"] = float(raw.get("y", visitor["y"]))
            visitor["last_seen"] = time.time()
            await self.broadcast({
                "type": "play.visitor.moved",
                "visitor_id": vid,
                "x": visitor["x"],
                "y": visitor["y"],
            }, exclude=ws)
            return None

        if msg_type == "play.chatter":
            entry = await self.push_chatter(
                str(raw.get("speaker") or visitor["name"]),
                str(raw.get("text") or ""),
                str(raw.get("mood") or "neutral"),
                visitor_id=vid,
            )
            return {"type": "play.chatter.ack", "ok": bool(entry)} if entry else None

        if msg_type == "play.npc_mode":
            mode = str(raw.get("mode") or "roam").lower()
            if mode in ("free", "roam", "follow", "stand"):
                self.npc_mode = mode
                await self.broadcast({"type": "play.npc_mode", "mode": mode})
            return {"type": "play.npc_mode", "mode": self.npc_mode}

        if msg_type == "play.ping":
            visitor["last_seen"] = time.time()
            return {"type": "play.pong", "visitor_id": vid}

        return {"type": "play.error", "error": f"unknown: {msg_type}"}


_lobby: PlayLobby | None = None


def get_play_lobby() -> PlayLobby:
    global _lobby
    if _lobby is None:
        _lobby = PlayLobby()
    return _lobby