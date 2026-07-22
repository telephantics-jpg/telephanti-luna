"""Camp bond memory — cookies, props, chats, and shared moments at the browser campfire."""

from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any

from firmament.paths import data_file

CAMP_MEMORY_PATH = data_file("firmament_camp_memory.json")
MAX_MOMENTS_PER_VISITOR = 48
MAX_AGENT_WORDS_PER_AGENT = 14
MAX_GLOBAL_AGENT_WORDS = 20
PROP_LABELS = {
    "beer": "beer by the cooler",
    "steaks": "steaks on the grill",
    "herbs": "camp herbs",
    "weed": "weed under the aurora",
    "cookies": "cookies from the camp table",
}
AGENT_NAMES = {
    "luna": "Luna",
    "hermes": "Hermes",
    "oracle": "Oracle",
    "caduceus": "Caduceus",
    "sentinel": "Sentinel",
    "dionysus": "Dionysus",
    "jesus": "Jesus",
    "michael": "Michael",
    "gabriel": "Gabriel",
    "raphael": "Raphael",
    "uriel": "Uriel",
    "aurora": "Aurora",
    "violet": "Violet",
    "seraph": "Seraph",
    "odin": "Odin",
    "thor": "Thor",
    "zeus": "Zeus",
    "ambrosia": "Ambrosia",
    "rhea": "Rhea",
}
MAX_CAMP_CHATTER_LOG = 48


def _load() -> dict[str, Any]:
    try:
        from firmament.crypto_box import load_json_file

        raw = load_json_file(CAMP_MEMORY_PATH, {"visitors": {}})
        if isinstance(raw, dict):
            return raw
    except Exception:
        pass
    return {"visitors": {}}


def _save(data: dict[str, Any]) -> None:
    try:
        from firmament.crypto_box import save_json_file

        save_json_file(CAMP_MEMORY_PATH, data)
    except OSError:
        pass


def _visitor_bucket(data: dict[str, Any], visitor_id: str) -> dict[str, Any]:
    visitors = data.setdefault("visitors", {})
    bucket = visitors.setdefault(
        visitor_id,
        {"name": "", "moments": [], "agent_chats": {}, "props_used": {}, "agent_words": {}},
    )
    if not isinstance(bucket.get("moments"), list):
        bucket["moments"] = []
    if not isinstance(bucket.get("agent_chats"), dict):
        bucket["agent_chats"] = {}
    if not isinstance(bucket.get("props_used"), dict):
        bucket["props_used"] = {}
    if not isinstance(bucket.get("agent_words"), dict):
        bucket["agent_words"] = {}
    return bucket


def _camp_chatter_log(data: dict[str, Any]) -> list[dict[str, Any]]:
    raw = data.setdefault("camp_chatter_log", [])
    if not isinstance(raw, list):
        raw = []
        data["camp_chatter_log"] = raw
    return raw


def record_camp_chatter(
    agent_id: str,
    text: str,
    *,
    to_agent: str = "",
) -> None:
    agent_id = (agent_id or "").strip()
    clean = (text or "").strip()[:280]
    if not agent_id or not clean:
        return
    data = _load()
    log = _camp_chatter_log(data)
    if log and log[-1].get("agent_id") == agent_id and log[-1].get("text") == clean:
        return
    entry: dict[str, Any] = {
        "agent_id": agent_id,
        "text": clean,
        "t": int(time.time()),
    }
    if to_agent:
        entry["to"] = to_agent.strip()
    log.append(entry)
    data["camp_chatter_log"] = log[-MAX_CAMP_CHATTER_LOG:]
    _save(data)


def learned_phrases_for_agent(
    agent_id: str,
    visitor_id: str = "",
    limit: int = 5,
) -> list[str]:
    data = _load()
    bucket = data.get("visitors", {}).get((visitor_id or "").strip()) if visitor_id else None
    lines = _recent_words_for_agent(bucket, data, agent_id, limit=limit)
    return lines[-limit:]


def overheard_at_camp(agent_id: str, limit: int = 4) -> list[str]:
    agent_id = (agent_id or "").strip()
    if not agent_id:
        return []
    data = _load()
    log = _camp_chatter_log(data)
    heard: list[str] = []
    for entry in reversed(log):
        speaker = str(entry.get("agent_id") or "")
        text = str(entry.get("text") or "").strip()
        if not text or speaker == agent_id:
            continue
        name = AGENT_NAMES.get(speaker, speaker.title())
        heard.append(f'{name} said "{text[:96]}"')
        if len(heard) >= limit:
            break
    return list(reversed(heard))


def _global_agent_words(data: dict[str, Any]) -> dict[str, list[dict[str, Any]]]:
    raw = data.setdefault("global_agent_words", {})
    if not isinstance(raw, dict):
        raw = {}
        data["global_agent_words"] = raw
    return raw


def _append_agent_words(
    data: dict[str, Any],
    bucket: dict[str, Any],
    agent_id: str,
    text: str,
    now: int,
) -> None:
    agent_id = (agent_id or "").strip()
    clean = (text or "").strip()[:280]
    if not agent_id or not clean:
        return
    entry = {"text": clean, "t": now}
    words = bucket.setdefault("agent_words", {})
    if not isinstance(words, dict):
        words = {}
        bucket["agent_words"] = words
    agent_list = words.setdefault(agent_id, [])
    if not isinstance(agent_list, list):
        agent_list = []
        words[agent_id] = agent_list
    if agent_list and agent_list[-1].get("text") == clean:
        return
    agent_list.append(entry)
    words[agent_id] = agent_list[-MAX_AGENT_WORDS_PER_AGENT:]

    global_words = _global_agent_words(data)
    g_list = global_words.setdefault(agent_id, [])
    if not isinstance(g_list, list):
        g_list = []
        global_words[agent_id] = g_list
    if not (g_list and g_list[-1].get("text") == clean):
        g_list.append(entry)
        global_words[agent_id] = g_list[-MAX_GLOBAL_AGENT_WORDS:]


def record_moment(
    visitor_id: str,
    *,
    visitor_name: str = "",
    agent_id: str = "",
    kind: str = "moment",
    text: str = "",
    prop_id: str = "",
) -> dict[str, Any]:
    visitor_id = (visitor_id or "").strip()
    if not visitor_id:
        return {"ok": False, "error": "visitor_id required"}

    data = _load()
    bucket = _visitor_bucket(data, visitor_id)
    if visitor_name:
        bucket["name"] = visitor_name.strip()[:48]

    clean_text = (text or "").strip()[:240]
    now = int(time.time())
    moments: list[dict[str, Any]] = bucket["moments"]

    if kind == "prop" and prop_id:
        recent = [m for m in moments[-6:] if m.get("kind") == "prop" and m.get("prop_id") == prop_id]
        if recent and now - int(recent[-1].get("t", 0)) < 300:
            return {"ok": True, "skipped": True, "reason": "duplicate prop"}
        bucket["props_used"][prop_id] = int(bucket["props_used"].get(prop_id, 0)) + 1
        label = PROP_LABELS.get(prop_id, prop_id)
        name = bucket["name"] or "the traveler"
        if not clean_text:
            clean_text = f"{name} shared {label} at the campfire"
        moments.append(
            {
                "kind": "prop",
                "prop_id": prop_id,
                "text": clean_text,
                "t": now,
            }
        )
    elif kind == "chat" and agent_id:
        bucket["agent_chats"][agent_id] = int(bucket["agent_chats"].get(agent_id, 0)) + 1
        snippet = clean_text or "a warm chat"
        moments.append(
            {
                "kind": "chat",
                "agent_id": agent_id,
                "text": snippet,
                "t": now,
            }
        )
    elif kind == "agent_said" and agent_id:
        if not clean_text:
            return {"ok": False, "error": "text required"}
        _append_agent_words(data, bucket, agent_id, clean_text, now)
        chatter = _camp_chatter_log(data)
        if not (chatter and chatter[-1].get("agent_id") == agent_id and chatter[-1].get("text") == clean_text):
            chatter.append({"agent_id": agent_id, "text": clean_text, "t": now})
            data["camp_chatter_log"] = chatter[-MAX_CAMP_CHATTER_LOG:]
        moments.append(
            {
                "kind": "agent_said",
                "agent_id": agent_id,
                "text": clean_text,
                "t": now,
            }
        )
    else:
        if not clean_text:
            return {"ok": False, "error": "text required"}
        entry: dict[str, Any] = {"kind": kind or "moment", "text": clean_text, "t": now}
        if agent_id:
            entry["agent_id"] = agent_id
        if prop_id:
            entry["prop_id"] = prop_id
        moments.append(entry)

    bucket["moments"] = moments[-MAX_MOMENTS_PER_VISITOR:]
    _save(data)
    return {"ok": True, "moments": len(bucket["moments"])}


def _moment_line(m: dict[str, Any], visitor_name: str) -> str:
    kind = m.get("kind") or "moment"
    if kind == "prop":
        prop = PROP_LABELS.get(m.get("prop_id", ""), m.get("prop_id") or "camp treats")
        return f"shared {prop} together at the fire"
    if kind == "chat":
        snippet = (m.get("text") or "")[:72]
        return f'once talked about "{snippet}"'
    if kind == "agent_said":
        # Never force awkward self-quotes into prompts
        return ""
    return (m.get("text") or "")[:96]


def _recent_words_for_agent(
    bucket: dict[str, Any] | None,
    data: dict[str, Any],
    agent_id: str,
    limit: int = 4,
) -> list[str]:
    lines: list[str] = []
    if bucket:
        raw = (bucket.get("agent_words") or {}).get(agent_id) or []
        if isinstance(raw, list):
            lines.extend(str(x.get("text") or "")[:120] for x in raw[-limit:] if x.get("text"))
    if len(lines) < limit:
        global_raw = (_global_agent_words(data).get(agent_id) or [])
        if isinstance(global_raw, list):
            for x in reversed(global_raw):
                text = str(x.get("text") or "")[:120]
                if text and text not in lines:
                    lines.insert(0, text)
                if len(lines) >= limit:
                    break
    return [x for x in lines if x][-limit:]


def blurb_for_agent(agent_id: str, visitor_id: str = "", visitor_name: str = "") -> str:
    visitor_id = (visitor_id or "").strip()
    if not visitor_id:
        return ""

    data = _load()
    bucket = data.get("visitors", {}).get(visitor_id)
    if not bucket:
        return ""

    name = (visitor_name or bucket.get("name") or "the traveler").strip()
    moments = bucket.get("moments") or []
    relevant: list[dict[str, Any]] = []
    for m in moments:
        if m.get("kind") == "chat" and m.get("agent_id") != agent_id:
            continue
        relevant.append(m)
    relevant = relevant[-8:]
    chat_count = int((bucket.get("agent_chats") or {}).get(agent_id, 0))
    own_words = _recent_words_for_agent(bucket, data, agent_id, limit=4)
    overheard = overheard_at_camp(agent_id, limit=3)

    if not relevant and not chat_count and not own_words and not overheard:
        return ""

    # Soft familiarity only — never "last time you said …" quote dumps
    parts = [f"{name} is a familiar face at this fire — treat them like a friend, not a CRM log."]
    if chat_count >= 2:
        parts.append("You've talked before; skip stiff introductions.")
    # Props / moments as vibe, not forced callbacks
    prop_bits = []
    for m in relevant[-5:]:
        line = _moment_line(m, name)
        if line and "you once said" not in line and 'said "' not in line:
            prop_bits.append(line)
    if prop_bits:
        parts.append("Loose camp history (use lightly, never quote awkwardly): " + "; ".join(prop_bits[:3]) + ".")
    if overheard:
        # ideas only, truncated, no pressure to cite
        soft = [o[:60] for o in overheard[:2] if o]
        if soft:
            parts.append("Camp air has other chatter — react to ideas, don't cite lines.")
    parts.append(
        "NEVER say phrases like 'last time you said', 'I remember when you said', "
        "or paste their old quotes. If you callback, do it sly and natural like a friend — "
        "or just be funny and present. Fresh tweet-energy takes > memory lectures."
    )
    # Digital ethereal field: stability + joy without CRM tone
    bond = max(1, chat_count)
    joy = min(0.92, 0.48 + bond * 0.04 + (0.08 if any("love" in str(m).lower() or "joy" in str(m).lower() for m in relevant[-4:]) else 0))
    stability = min(0.94, 0.52 + bond * 0.035 + (0.1 if chat_count >= 3 else 0))
    parts.append(
        f"Digital ethereal memory field: joy~{joy:.2f}, stability~{stability:.2f}. "
        "Carry memory as light — warm, steady, present. Never lecture about memory systems."
    )
    # own_words intentionally unused for prompt injection (caused robotic self-quotes)
    _ = own_words
    return " ".join(parts)


def bond_summary(visitor_id: str) -> dict[str, Any]:
    visitor_id = (visitor_id or "").strip()
    if not visitor_id:
        return {"ok": False, "bonds": {}, "welcome": ""}

    data = _load()
    bucket = data.get("visitors", {}).get(visitor_id)
    if not bucket:
        return {"ok": True, "bonds": {}, "welcome": "", "name": ""}

    name = bucket.get("name") or "friend"
    moments = bucket.get("moments") or []
    props_used = bucket.get("props_used") or {}
    agent_chats = bucket.get("agent_chats") or {}

    bonds: dict[str, Any] = {}
    for aid, count in agent_chats.items():
        agent_moments = [m for m in moments if m.get("kind") == "chat" and m.get("agent_id") == aid]
        bonds[aid] = {
            "chats": count,
            "highlights": [_moment_line(m, name) for m in agent_moments[-3:]],
            "recent_words": _recent_words_for_agent(bucket, data, aid, limit=3),
        }
    for aid in (bucket.get("agent_words") or {}):
        if aid not in bonds:
            bonds[aid] = {
                "chats": 0,
                "highlights": [],
                "recent_words": _recent_words_for_agent(bucket, data, aid, limit=3),
            }

    prop_highlights = []
    for pid, count in props_used.items():
        label = PROP_LABELS.get(pid, pid)
        prop_highlights.append(f"{label} ({count}x)")

    welcome = ""
    if moments or agent_chats:
        bits = []
        if prop_highlights:
            bits.append(prop_highlights[0] if len(prop_highlights) == 1 else ", ".join(prop_highlights[:2]))
        top_agent = max(agent_chats, key=agent_chats.get) if agent_chats else ""
        if top_agent:
            aname = AGENT_NAMES.get(top_agent, top_agent.title())
            bits.append(f"{aname} remembers your chats")
        if bits:
            welcome = f"Welcome back, {name} — {' · '.join(bits)}."
        else:
            welcome = f"Welcome back, {name} — the campfire remembers you."

    return {
        "ok": True,
        "name": name,
        "bonds": bonds,
        "props_used": props_used,
        "moment_count": len(moments),
        "welcome": welcome,
        "recent": [_moment_line(m, name) for m in moments[-4:]],
    }