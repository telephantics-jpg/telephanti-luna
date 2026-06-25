"""Generate visible looping MP4 clips for Luna video avatar."""
from __future__ import annotations

import math
import shutil
import subprocess
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PORTRAIT = ROOT / "static" / "avatars" / "luna-portrait.jpg"
OUT = ROOT / "static" / "avatars"
FRAMES = OUT / "_video_frames"


def render_sequence(name: str, frames: int, amp_x: int, amp_y: int, zoom_base: float, zoom_amp: float) -> Path:
    seq = FRAMES / name
    if seq.exists():
        shutil.rmtree(seq)
    seq.mkdir(parents=True)
    img = Image.open(PORTRAIT).convert("RGB")
    iw, ih = img.size
    for i in range(frames):
        t = i / frames
        zoom = zoom_base + zoom_amp * math.sin(2 * math.pi * t)
        ox = int(amp_x * math.sin(2 * math.pi * t * 1.25))
        oy = int(amp_y * math.sin(2 * math.pi * t * 0.85))
        cw, ch = max(1, int(iw / zoom)), max(1, int(ih / zoom))
        left = max(0, min(iw - cw, (iw - cw) // 2 + ox))
        top = max(0, min(ih - ch, (ih - ch) // 2 + oy))
        frame = img.crop((left, top, left + cw, top + ch)).resize((720, 960), Image.Resampling.LANCZOS)
        frame.save(seq / f"frame_{i:04d}.jpg", quality=90)
    return seq


def encode(seq: Path, out_name: str, fps: int = 15) -> None:
    out = OUT / out_name
    cmd = [
        "ffmpeg", "-y",
        "-framerate", str(fps),
        "-i", str(seq / "frame_%04d.jpg"),
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        str(out),
    ]
    subprocess.run(cmd, check=True)
    print(f"Wrote {out} ({out.stat().st_size} bytes)")


def main() -> int:
    if not PORTRAIT.exists():
        print("Missing portrait:", PORTRAIT, file=sys.stderr)
        return 1
    # Micro-motion only — no 90s Ken Burns zoom slideshow
    specs = [
        ("idle", 72, 6, 4, 1.0, 0.012),
        ("speak", 48, 10, 6, 1.0, 0.018),
        ("react", 36, 14, 8, 0.995, 0.022),
    ]
    for name, frames, ax, ay, zb, za in specs:
        seq = render_sequence(name, frames, ax, ay, zb, za)
        encode(seq, f"luna-{name if name != 'react' else 'flirt'}.mp4")
    if FRAMES.exists():
        shutil.rmtree(FRAMES)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())