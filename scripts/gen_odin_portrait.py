"""Generate single Odin hall portrait for camp house interior."""
from __future__ import annotations

import base64
import json
import os
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "static" / "camp" / "portraits" / "odin"
MANIFEST = ROOT / "static" / "camp" / "portraits" / "manifest.json"


def load_api_key() -> str:
    key = os.getenv("XAI_API_KEY", "").strip()
    if key and key != "your_api_key_here":
        return key
    env_path = ROOT / ".env"
    if env_path.is_file():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            if line.startswith("XAI_API_KEY="):
                val = line.split("=", 1)[1].strip().strip('"').strip("'")
                if val and val != "your_api_key_here":
                    return val
    return ""


def main() -> int:
    api_key = load_api_key()
    if not api_key:
        print("Missing XAI_API_KEY", file=sys.stderr)
        return 1

    OUT.mkdir(parents=True, exist_ok=True)
    out_path = OUT / "hall.jpg"
    prompt = (
        "Portrait bust of Odin All-Father in his stone hall on the aurora outskirts — "
        "elderly Norse god with one luminous golden eye, grey beard, weathered wise face, "
        "dark hooded cloak, two ravens on shoulders, cold blue-grey stone hall background with "
        "faint aurora light through arched window, painterly digital art, polished game character portrait, "
        "3:4 framing shoulders up, no text, no watermark"
    )
    payload = json.dumps({
        "model": "grok-imagine-image-quality",
        "prompt": prompt,
        "aspect_ratio": "3:4",
        "response_format": "b64_json",
    }).encode("utf-8")
    req = urllib.request.Request(
        "https://api.x.ai/v1/images/generations",
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=180) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    item = (data.get("data") or [{}])[0]
    b64 = item.get("b64_json")
    if not b64:
        print(f"No image: {data}", file=sys.stderr)
        return 1
    raw = base64.b64decode(b64)
    out_path.write_bytes(raw)
    print(f"ok {out_path} ({len(raw)} bytes)")

    manifest: dict = {}
    if MANIFEST.is_file():
        try:
            manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            manifest = {}
    manifest["odin"] = {"hall": "/static/camp/portraits/odin/hall.jpg"}
    MANIFEST.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())