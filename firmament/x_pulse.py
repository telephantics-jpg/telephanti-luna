"""𝕏 Pulse — live-ish headlines camp agents riff on (HN, Reddit, RSS fallback)."""

from __future__ import annotations

import logging
import random
import time
from typing import Any
from xml.etree import ElementTree

log = logging.getLogger("luna.firmament.x_pulse")

_CACHE: dict[str, Any] = {"items": [], "fetched_at": 0.0}
TTL_SEC = 900

FALLBACK_PULSE: list[dict[str, str]] = [
    {"text": "AI agents are the new group chat", "source": "camp", "url": ""},
    {"text": "Everyone's debating the same headline in three different moods", "source": "camp", "url": ""},
    {"text": "Your phone battery vs. the news cycle — who's winning?", "source": "camp", "url": ""},
    {"text": "Remote work, rent, and one weird viral clip — Tuesday energy", "source": "camp", "url": ""},
    {"text": "Climate report dropped; group chat immediately made a meme", "source": "camp", "url": ""},
    {"text": "New phone dropped — camp agents forming opinions already", "source": "camp", "url": ""},
    {"text": "Sports trade rumor somehow became everyone's personality", "source": "camp", "url": ""},
    {"text": "Someone said 'touch grass' and meant it unironically", "source": "camp", "url": ""},
]


def _fetch_hn(limit: int = 6) -> list[dict[str, str]]:
    import httpx

    items: list[dict[str, str]] = []
    try:
        r = httpx.get("https://hacker-news.firebaseio.com/v0/topstories.json", timeout=10.0)
        r.raise_for_status()
        ids = (r.json() or [])[:limit]
        for sid in ids:
            try:
                sr = httpx.get(
                    f"https://hacker-news.firebaseio.com/v0/item/{sid}.json",
                    timeout=8.0,
                )
                sr.raise_for_status()
                d = sr.json() or {}
                title = str(d.get("title") or "").strip()
                if not title:
                    continue
                url = str(d.get("url") or f"https://news.ycombinator.com/item?id={sid}")
                items.append({"text": title, "source": "hn", "url": url})
            except Exception:
                continue
    except Exception as exc:
        log.warning("HN pulse fetch failed: %s", exc)
    return items


def _fetch_reddit(limit: int = 6) -> list[dict[str, str]]:
    import httpx

    items: list[dict[str, str]] = []
    try:
        r = httpx.get(
            "https://www.reddit.com/r/worldnews+technology+news/hot.json?limit=12",
            headers={"User-Agent": "LunaCampPulse/1.0 (firmament camp)"},
            timeout=12.0,
        )
        r.raise_for_status()
        children = (r.json() or {}).get("data", {}).get("children", [])
        for child in children:
            if len(items) >= limit:
                break
            d = child.get("data") or {}
            if d.get("stickied"):
                continue
            title = str(d.get("title") or "").strip()
            if not title:
                continue
            permalink = str(d.get("permalink") or "")
            url = f"https://www.reddit.com{permalink}" if permalink else ""
            items.append({"text": title[:220], "source": "reddit", "url": url})
    except Exception as exc:
        log.warning("Reddit pulse fetch failed: %s", exc)
    return items


def _fetch_rss(limit: int = 4) -> list[dict[str, str]]:
    import httpx

    items: list[dict[str, str]] = []
    feeds = [
        "https://feeds.bbci.co.uk/news/world/rss.xml",
        "https://www.theverge.com/rss/index.xml",
    ]
    for feed_url in feeds:
        if len(items) >= limit:
            break
        try:
            r = httpx.get(feed_url, timeout=12.0, follow_redirects=True)
            r.raise_for_status()
            root = ElementTree.fromstring(r.content)
            for item in root.iter("item"):
                if len(items) >= limit:
                    break
                title_el = item.find("title")
                link_el = item.find("link")
                title = (title_el.text or "").strip() if title_el is not None else ""
                link = (link_el.text or "").strip() if link_el is not None else ""
                if title:
                    items.append({"text": title[:220], "source": "rss", "url": link})
        except Exception as exc:
            log.warning("RSS pulse %s failed: %s", feed_url, exc)
    return items


def refresh_pulse(force: bool = False) -> list[dict[str, str]]:
    now = time.time()
    if not force and _CACHE["items"] and now - float(_CACHE["fetched_at"]) < TTL_SEC:
        return list(_CACHE["items"])

    merged: list[dict[str, str]] = []
    seen: set[str] = set()
    for batch in (_fetch_hn(7), _fetch_reddit(7), _fetch_rss(5)):
        for item in batch:
            key = item["text"].lower()[:120]
            if key in seen:
                continue
            seen.add(key)
            merged.append(item)

    if len(merged) < 4:
        for fb in FALLBACK_PULSE:
            key = fb["text"].lower()
            if key not in seen:
                merged.append(dict(fb))
                seen.add(key)

    random.shuffle(merged)
    _CACHE["items"] = merged[:24]
    _CACHE["fetched_at"] = now
    return list(_CACHE["items"])


def get_pulse_feed() -> dict[str, Any]:
    items = refresh_pulse()
    return {
        "label": "𝕏 Pulse",
        "hint": "Headlines from the wider world — agents tweet their takes.",
        "items": items,
        "fetched_at": _CACHE["fetched_at"],
        "count": len(items),
    }


def pick_pulse_item() -> dict[str, str]:
    items = refresh_pulse()
    if not items:
        return dict(random.choice(FALLBACK_PULSE))
    return dict(random.choice(items))


def pulse_context_blurb(limit: int = 5) -> str:
    items = refresh_pulse()[:limit]
    if not items:
        return "Quiet pulse today — still plenty to talk about."
    bits = [f"• {it['text'][:90]}" for it in items]
    return "Today's pulse (react naturally, don't lecture): " + " ".join(bits)


def agent_tweet_payload(agent_id: str, headline: str = "") -> dict[str, Any]:
    from firmament.agent_roles import compose_agent_tweet, role_for_agent
    from firmament.brain import load_agent_profile

    item = pick_pulse_item() if not headline else {"text": headline, "source": "camp", "url": ""}
    prof = load_agent_profile(agent_id)
    name = prof.get("name") or agent_id
    tweet = compose_agent_tweet(agent_id, item["text"])
    return {
        "agent_id": agent_id,
        "name": name,
        "role": role_for_agent(agent_id),
        "tweet": tweet,
        "pulse": item,
        "mood": "think" if "?" in tweet else "happy",
    }