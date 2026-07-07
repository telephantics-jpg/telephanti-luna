"""Create mobile-sized camp background and house portrait variants."""
from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
BG_SRC = ROOT / "static" / "camp" / "aurora-corona-sky.jpg"
BG_OUT = ROOT / "static" / "camp" / "aurora-corona-sky-mobile.jpg"
PORTRAITS = ROOT / "static" / "camp" / "portraits"
PORTRAIT_W = 512
BG_W = 960
JPEG_Q = 72


def save_jpg(src: Path, dst: Path, width: int) -> None:
    img = Image.open(src).convert("RGB")
    if img.width > width:
        h = max(1, round(img.height * width / img.width))
        img = img.resize((width, h), Image.Resampling.LANCZOS)
    img.save(dst, "JPEG", quality=JPEG_Q, optimize=True)
    print(f"{dst.relative_to(ROOT)}  {dst.stat().st_size // 1024}KB")


def main() -> None:
    if BG_SRC.is_file():
        save_jpg(BG_SRC, BG_OUT, BG_W)
    count = 0
    for agent_dir in sorted(PORTRAITS.iterdir()):
        if not agent_dir.is_dir():
            continue
        for src in sorted(agent_dir.glob("*.jpg")):
            if src.stem.endswith("-m"):
                continue
            dst = src.with_name(f"{src.stem}-m.jpg")
            save_jpg(src, dst, PORTRAIT_W)
            count += 1
    print(f"Done — {count} mobile portraits")


if __name__ == "__main__":
    main()