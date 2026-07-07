"""Generate Telephantix song-themed Grok house portraits for camp agents."""
from __future__ import annotations

import base64
import json
import os
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "static" / "camp" / "portraits"
MANIFEST = OUT / "manifest.json"

SONGS = [
    ("flowing-free", "Flowing Free", "soft flowing cyan-magenta aurora light, dreamy watery atmosphere"),
    ("loud-and-clear", "Loud and Clear", "bold high-contrast electric clarity, sharp golden highlights"),
    ("holy-ghosts", "Holy Ghosts", "ethereal mist, spectral white-violet glow, spiritual haunting beauty"),
    ("pull-me-under", "Pull Me Under", "deep indigo underwater cosmic depth, bioluminescent accents"),
    ("marijane", "Marijane", "earthy warm green-gold, mellow sunset haze, relaxed warmth"),
    ("mountain-clouds", "Mountain Clouds", "misty alpine clouds, soft pearl light, serene peaks"),
    ("abracadabra", "Abracadabra", "magical violet sparkles, theatrical stage lighting, wonder"),
    ("pulverised-dust", "Pulverised Dust", "cosmic amber dust particles, gritty starfield, raw energy"),
]

AGENTS = {
    "luna": (
        "Portrait bust of Luna, a warm cosmic woman companion with soft lavender-magenta hair, "
        "gentle knowing smile, aurora-colored eyes, painterly digital art, polished game character portrait"
    ),
    "hermes": (
        "Portrait bust of Hermes, psychic messenger with sharp golden amber eyes, short tousled dark hair, "
        "subtle ripple energy aura, androgynous handsome face, painterly digital art, polished game portrait"
    ),
    "oracle": (
        "Portrait bust of the Oracle, mysterious seer woman with silver-violet hair, partial sheer veil, "
        "luminous mystical gaze, candlelit mystic mood, painterly digital art, polished game portrait"
    ),
    "dionysus": (
        "Portrait bust of Dionysus, charismatic wine-god man with curly dark hair, rose-gold warmth, "
        "playful smirk, theatrical charm, painterly digital art, polished game character portrait"
    ),
}


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


def generate_image(api_key: str, prompt: str) -> bytes:
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
        url = item.get("url")
        if not url:
            raise RuntimeError(f"No image in response: {data}")
        with urllib.request.urlopen(url, timeout=120) as img_resp:
            return img_resp.read()
    return base64.b64decode(b64)


def main() -> int:
    api_key = load_api_key()
    if not api_key:
        print("Missing XAI_API_KEY — set in .env or environment", file=sys.stderr)
        return 1

    manifest: dict[str, dict[str, str]] = {}
    total = len(AGENTS) * len(SONGS)
    done = 0

    for agent_id, base in AGENTS.items():
        agent_dir = OUT / agent_id
        agent_dir.mkdir(parents=True, exist_ok=True)
        manifest[agent_id] = {}
        for song_id, title, mood in SONGS:
            out_path = agent_dir / f"{song_id}.jpg"
            if out_path.is_file() and out_path.stat().st_size > 8000:
                manifest[agent_id][song_id] = f"/static/camp/portraits/{agent_id}/{song_id}.jpg"
                done += 1
                print(f"skip {agent_id}/{song_id} (exists)")
                continue
            prompt = (
                f"{base}. Mood inspired by Telephantix song \"{title}\": {mood}. "
                "Same recognizable character identity, new lighting and atmosphere only. "
                "3:4 portrait framing, shoulders up, dark moody background, no text, no watermark."
            )
            print(f"gen  {agent_id}/{song_id} …")
            try:
                raw = generate_image(api_key, prompt)
                out_path.write_bytes(raw)
                manifest[agent_id][song_id] = f"/static/camp/portraits/{agent_id}/{song_id}.jpg"
                done += 1
                print(f"ok   {agent_id}/{song_id} ({len(raw)} bytes)")
            except Exception as exc:
                print(f"fail {agent_id}/{song_id}: {exc}", file=sys.stderr)
            time.sleep(1.2)

    MANIFEST.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"Done {done}/{total} — manifest at {MANIFEST}")
    return 0 if done else 1


if __name__ == "__main__":
    raise SystemExit(main())