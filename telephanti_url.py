"""Resolve Luna base URL (telephanti.com when configured locally)."""

from __future__ import annotations

import os
import socket
from pathlib import Path

BASE = Path(__file__).parent
MARKER = BASE / ".telephanti_enabled"
DOMAIN = "telephanti.com"
FALLBACK_PORT = 8767


def hosts_has_telephanti() -> bool:
    if os.name != "nt":
        return False
    hosts = Path(os.environ.get("SystemRoot", r"C:\Windows")) / "System32" / "drivers" / "etc" / "hosts"
    try:
        text = hosts.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return False
    return DOMAIN in text and "127.0.0.1" in text


def telephanti_enabled() -> bool:
    return MARKER.exists() or hosts_has_telephanti()


def _local_telephanti_url() -> str:
    """Local dev only — prefer loopback; public domain must use HTTPS cloud."""
    return f"http://127.0.0.1:{FALLBACK_PORT}"


def cloud_telephanti_url() -> str:
    return "https://telephanti.com"


def luna_base_url() -> str:
    public = os.getenv("LUNA_PUBLIC_URL", "").strip().rstrip("/")
    if public:
        return public
    if telephanti_enabled() or hosts_has_telephanti():
        return _local_telephanti_url()
    return f"http://127.0.0.1:{FALLBACK_PORT}"


def luna_public_visit_url() -> str:
    public = os.getenv("LUNA_PUBLIC_URL", "").strip().rstrip("/")
    if public:
        return f"{public}/visit"
    return "https://telephanti.com/visit"


def luna_pet_url() -> str:
    return f"{luna_base_url()}/luna"


def proxy_port_open(port: int = 80) -> bool:
    try:
        with socket.create_connection(("127.0.0.1", port), timeout=0.4):
            return True
    except OSError:
        return False