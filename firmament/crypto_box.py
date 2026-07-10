"""Camp crypto — at-rest + transit envelopes (stdlib only).

At rest: HMAC-SHA256 counter stream + encrypt-then-MAC (LUNA1).
Transit: same primitive, base64 JSON envelopes for browser Web-compatible sealing.
Master key: data/.luna_master_key (auto-created) or LUNA_MASTER_KEY env.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
import os
import struct
import threading
from pathlib import Path
from typing import Any

from firmament.paths import DATA, ensure_dirs

log = logging.getLogger("luna.firmament.crypto")

MAGIC = b"LUNA1"
KEY_PATH = DATA / ".luna_master_key"
TRANSIT_SALT = b"luna-firmament-transit-v1"
REST_SALT = b"luna-firmament-rest-v1"

# Sensitive camp files — encrypted on disk when crypto is on
SENSITIVE_NAMES = frozenset({
    "firmament_agent_memory.json",
    "firmament_camp_memory.json",
    "firmament_wallets.json",
    "firmament_psychic_state.json",
    "firmament_game_state.json",
    "firmament_state.json",
})

_lock = threading.Lock()
_master_cache: bytes | None = None


def crypto_enabled() -> bool:
    """At-rest + transit encryption. Off only if LUNA_CRYPTO=0/false/off."""
    flag = os.getenv("LUNA_CRYPTO", "1").strip().lower()
    return flag not in ("0", "false", "no", "off")


def _b64e(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def _b64d(text: str) -> bytes:
    pad = "=" * (-len(text) % 4)
    return base64.urlsafe_b64decode((text + pad).encode("ascii"))


def _derive(master: bytes, salt: bytes, label: bytes) -> bytes:
    return hashlib.pbkdf2_hmac("sha256", master, salt + label, 120_000, dklen=32)


def _load_or_create_master() -> bytes:
    global _master_cache
    with _lock:
        if _master_cache is not None:
            return _master_cache
        env_key = os.getenv("LUNA_MASTER_KEY", "").strip()
        if env_key:
            try:
                raw = _b64d(env_key) if not env_key.startswith("hex:") else bytes.fromhex(env_key[4:])
            except Exception:
                raw = hashlib.sha256(env_key.encode("utf-8")).digest()
            if len(raw) < 16:
                raw = hashlib.sha256(raw).digest()
            _master_cache = raw[:32] if len(raw) >= 32 else hashlib.sha256(raw).digest()
            return _master_cache

        ensure_dirs()
        if KEY_PATH.is_file():
            try:
                text = KEY_PATH.read_text(encoding="utf-8").strip()
                raw = _b64d(text)
                if len(raw) >= 16:
                    _master_cache = hashlib.sha256(raw).digest() if len(raw) != 32 else raw
                    return _master_cache
            except Exception as exc:
                log.warning("master key unreadable, rotating: %s", exc)

        raw = os.urandom(32)
        try:
            KEY_PATH.write_text(_b64e(raw) + "\n", encoding="utf-8")
            try:
                os.chmod(KEY_PATH, 0o600)
            except OSError:
                pass
            log.info("created camp master key at %s", KEY_PATH)
        except OSError as exc:
            log.warning("could not persist master key: %s", exc)
        _master_cache = raw
        return _master_cache


def master_key() -> bytes:
    return _load_or_create_master()


def rest_key() -> bytes:
    return _derive(master_key(), REST_SALT, b"file")


def transit_key() -> bytes:
    return _derive(master_key(), TRANSIT_SALT, b"wire")


def transit_key_b64() -> str:
    return _b64e(transit_key())


def _keystream(enc_key: bytes, nonce: bytes, length: int) -> bytes:
    out = bytearray()
    counter = 0
    while len(out) < length:
        block = hmac.new(enc_key, nonce + struct.pack(">Q", counter), hashlib.sha256).digest()
        out.extend(block)
        counter += 1
    return bytes(out[:length])


def seal_bytes(plaintext: bytes, key: bytes | None = None) -> bytes:
    key = key or rest_key()
    enc_key = hashlib.sha256(key + b"|enc").digest()
    mac_key = hashlib.sha256(key + b"|mac").digest()
    nonce = os.urandom(16)
    stream = _keystream(enc_key, nonce, len(plaintext))
    ct = bytes(a ^ b for a, b in zip(plaintext, stream))
    tag = hmac.new(mac_key, nonce + ct, hashlib.sha256).digest()
    return MAGIC + nonce + tag + ct


def open_bytes(blob: bytes, key: bytes | None = None) -> bytes:
    key = key or rest_key()
    if not blob.startswith(MAGIC):
        raise ValueError("not a LUNA1 ciphertext")
    if len(blob) < 5 + 16 + 32:
        raise ValueError("ciphertext too short")
    nonce = blob[5:21]
    tag = blob[21:53]
    ct = blob[53:]
    enc_key = hashlib.sha256(key + b"|enc").digest()
    mac_key = hashlib.sha256(key + b"|mac").digest()
    expect = hmac.new(mac_key, nonce + ct, hashlib.sha256).digest()
    if not hmac.compare_digest(tag, expect):
        raise ValueError("MAC check failed — wrong key or corrupted data")
    stream = _keystream(enc_key, nonce, len(ct))
    return bytes(a ^ b for a, b in zip(ct, stream))


def is_sealed_file(path: Path) -> bool:
    try:
        with path.open("rb") as f:
            return f.read(5) == MAGIC
    except OSError:
        return False


def looks_like_json_text(raw: bytes) -> bool:
    s = raw.lstrip()[:1]
    return s in (b"{", b"[")


def load_json_file(path: Path, default: Any = None) -> Any:
    """Load JSON; decrypt LUNA1 files automatically. Plain JSON still works (migrates on save)."""
    if default is None:
        default = {}
    if not path.is_file():
        return default if not isinstance(default, dict) else dict(default)
    try:
        raw = path.read_bytes()
    except OSError:
        return default if not isinstance(default, dict) else dict(default)

    if raw.startswith(MAGIC):
        try:
            plain = open_bytes(raw, rest_key())
            return json.loads(plain.decode("utf-8"))
        except Exception as exc:
            log.error("decrypt failed for %s: %s", path.name, exc)
            return default if not isinstance(default, dict) else dict(default)

    try:
        text = raw.decode("utf-8")
        data = json.loads(text)
        return data
    except (UnicodeDecodeError, json.JSONDecodeError):
        return default if not isinstance(default, dict) else dict(default)


def save_json_file(path: Path, data: Any, *, force_plain: bool = False) -> None:
    """Save JSON; encrypt sensitive camp files when LUNA_CRYPTO is on."""
    path.parent.mkdir(parents=True, exist_ok=True)
    plain = json.dumps(data, indent=2, ensure_ascii=False).encode("utf-8")
    name = path.name
    encrypt = crypto_enabled() and not force_plain and name in SENSITIVE_NAMES
    if encrypt:
        blob = seal_bytes(plain, rest_key())
        path.write_bytes(blob)
    else:
        path.write_bytes(plain)


def seal_json(obj: Any, key: bytes | None = None) -> dict[str, Any]:
    """Transit envelope for JSON objects."""
    key = key or transit_key()
    plain = json.dumps(obj, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    blob = seal_bytes(plain, key)
    # MAGIC(5) + nonce(16) + tag(32) + ct
    nonce = blob[5:21]
    tag = blob[21:53]
    ct = blob[53:]
    return {
        "enc": True,
        "v": 1,
        "alg": "luna1",
        "iv": _b64e(nonce),
        "tag": _b64e(tag),
        "ct": _b64e(ct),
    }


def open_json_envelope(envelope: dict[str, Any], key: bytes | None = None) -> Any:
    key = key or transit_key()
    if not isinstance(envelope, dict) or not envelope.get("enc"):
        return envelope
    nonce = _b64d(str(envelope.get("iv") or ""))
    tag = _b64d(str(envelope.get("tag") or ""))
    ct = _b64d(str(envelope.get("ct") or ""))
    blob = MAGIC + nonce + tag + ct
    plain = open_bytes(blob, key)
    return json.loads(plain.decode("utf-8"))


def is_envelope(obj: Any) -> bool:
    return isinstance(obj, dict) and obj.get("enc") is True and obj.get("alg") == "luna1"


def crypto_status() -> dict[str, Any]:
    enabled = crypto_enabled()
    key_exists = KEY_PATH.is_file() or bool(os.getenv("LUNA_MASTER_KEY", "").strip())
    if enabled and not key_exists:
        master_key()  # ensure created
        key_exists = KEY_PATH.is_file() or bool(os.getenv("LUNA_MASTER_KEY", "").strip())
    return {
        "enabled": enabled,
        "at_rest": enabled,
        "transit": enabled,
        "key_ready": key_exists,
        "alg": "luna1",
        "sensitive_files": sorted(SENSITIVE_NAMES),
        "transit_key": transit_key_b64() if enabled else "",
    }


def migrate_plaintext_sensitive() -> list[str]:
    """Re-save any plain sensitive JSON as encrypted. Returns list of migrated names."""
    if not crypto_enabled():
        return []
    ensure_dirs()
    migrated: list[str] = []
    for name in sorted(SENSITIVE_NAMES):
        path = DATA / name
        if not path.is_file():
            continue
        if is_sealed_file(path):
            continue
        try:
            data = load_json_file(path, {})
            save_json_file(path, data)
            if is_sealed_file(path):
                migrated.append(name)
        except Exception as exc:
            log.warning("migrate %s failed: %s", name, exc)
    return migrated
