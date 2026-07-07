"""Camp token wallet and aurora shop for browser firmament play."""

from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any

from firmament.paths import data_file

WALLET_PATH = data_file("firmament_wallets.json")
STARTING_TOKENS = 15

SHOP_CATALOG: list[dict[str, Any]] = [
    {
        "id": "cookies",
        "name": "Cookie crate",
        "emoji": "🍪",
        "cost": 3,
        "desc": "Sweet fuel for late-night camp chatter.",
        "kind": "prop",
        "prop_id": "cookies",
    },
    {
        "id": "beer",
        "name": "Aurora lager",
        "emoji": "🍺",
        "cost": 4,
        "desc": "Cold beer from the cooler — Hermes approves.",
        "kind": "prop",
        "prop_id": "beer",
    },
    {
        "id": "herbs",
        "name": "Herb bundle",
        "emoji": "🌿",
        "cost": 5,
        "desc": "Mellow camp herbs — everyone chills out.",
        "kind": "prop",
        "prop_id": "herbs",
    },
    {
        "id": "aura_charm",
        "name": "Aurora charm",
        "emoji": "✨",
        "cost": 8,
        "desc": "Psychic shimmer — ripples pulse brighter for a while.",
        "kind": "effect",
        "effect": "psychic_boost",
    },
    {
        "id": "shelter_key",
        "name": "Shelter key",
        "emoji": "🗝",
        "cost": 12,
        "desc": "Unlock the visitor shelter for a cozy rest.",
        "kind": "unlock",
        "unlock": "shelter",
    },
    {
        "id": "weird_hat",
        "name": "Trippy hat",
        "emoji": "🎩",
        "cost": 6,
        "desc": "Your avatar wears impossible geometry for a bit.",
        "kind": "cosmetic",
        "cosmetic": "trippy_hat",
    },
    {
        "id": "ouija_charge",
        "name": "Veil charge",
        "emoji": "🔮",
        "cost": 10,
        "desc": "One free Ouija contact — the board hums louder.",
        "kind": "unlock",
        "unlock": "ouija_charge",
    },
    {
        "id": "stereo_boost",
        "name": "Bass bloom",
        "emoji": "🎵",
        "cost": 7,
        "desc": "Telephantix goes full aurora rave — louder waves & bass bloom.",
        "kind": "effect",
        "effect": "music_boost",
    },
]

EARN_RATES = {
    "chat": 2,
    "converse": 1,
    "prop": 1,
    "visit": 3,
    "ouija": 2,
}


def _load_all() -> dict[str, dict]:
    try:
        raw = json.loads(WALLET_PATH.read_text(encoding="utf-8"))
        if isinstance(raw, dict):
            return {k: v for k, v in raw.items() if isinstance(v, dict)}
    except (OSError, json.JSONDecodeError):
        pass
    return {}


def _save_all(data: dict[str, dict]) -> None:
    try:
        WALLET_PATH.write_text(json.dumps(data, indent=2), encoding="utf-8")
    except OSError:
        pass


def _default_wallet() -> dict:
    return {
        "tokens": STARTING_TOKENS,
        "inventory": [],
        "unlocks": [],
        "cosmetics": [],
        "updated_at": time.time(),
    }


def get_wallet(visitor_id: str) -> dict:
    vid = (visitor_id or "").strip()
    if not vid:
        return {**_default_wallet(), "visitor_id": ""}
    data = _load_all()
    wallet = data.get(vid)
    if not wallet:
        wallet = _default_wallet()
        data[vid] = wallet
        _save_all(data)
    out = {**_default_wallet(), **wallet, "visitor_id": vid}
    out["tokens"] = max(0, int(out.get("tokens", STARTING_TOKENS)))
    return out


def earn_tokens(visitor_id: str, reason: str = "chat", amount: int | None = None) -> dict:
    vid = (visitor_id or "").strip()
    if not vid:
        raise ValueError("visitor_id required")
    amt = int(amount if amount is not None else EARN_RATES.get(reason, 1))
    if amt < 1:
        amt = 1
    data = _load_all()
    wallet = {**_default_wallet(), **data.get(vid, _default_wallet())}
    wallet["tokens"] = int(wallet.get("tokens", STARTING_TOKENS)) + amt
    wallet["last_earn"] = reason
    wallet["updated_at"] = time.time()
    data[vid] = wallet
    _save_all(data)
    return {**wallet, "visitor_id": vid, "earned": amt, "reason": reason}


def buy_item(visitor_id: str, item_id: str) -> dict:
    vid = (visitor_id or "").strip()
    item_id = (item_id or "").strip().lower()
    if not vid:
        raise ValueError("visitor_id required")
    item = next((i for i in SHOP_CATALOG if i["id"] == item_id), None)
    if not item:
        raise ValueError(f"unknown item: {item_id}")

    data = _load_all()
    wallet = {**_default_wallet(), **data.get(vid, _default_wallet())}
    cost = int(item["cost"])
    tokens = int(wallet.get("tokens", STARTING_TOKENS))
    if tokens < cost:
        raise ValueError(f"need {cost} tokens, have {tokens}")

    wallet["tokens"] = tokens - cost
    inv = list(wallet.get("inventory") or [])
    inv.append({"id": item_id, "at": time.time()})
    wallet["inventory"] = inv[-40:]

    if item.get("kind") == "unlock" and item.get("unlock"):
        unlocks = list(wallet.get("unlocks") or [])
        if item["unlock"] not in unlocks:
            unlocks.append(item["unlock"])
        wallet["unlocks"] = unlocks
    if item.get("kind") == "cosmetic" and item.get("cosmetic"):
        cosmetics = list(wallet.get("cosmetics") or [])
        if item["cosmetic"] not in cosmetics:
            cosmetics.append(item["cosmetic"])
        wallet["cosmetics"] = cosmetics

    wallet["updated_at"] = time.time()
    data[vid] = wallet
    _save_all(data)
    return {
        "ok": True,
        "visitor_id": vid,
        "item": item,
        "wallet": wallet,
        "spent": cost,
    }


def catalog() -> list[dict]:
    return list(SHOP_CATALOG)