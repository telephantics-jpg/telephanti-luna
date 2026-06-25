"""Generate Luna desktop / PWA icons — cosmic warrior moon motif."""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

OUT = Path(__file__).parent / "static" / "icons"


def _lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def _rgb_lerp(c1: tuple[int, int, int], c2: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    return (
        int(_lerp(c1[0], c2[0], t)),
        int(_lerp(c1[1], c2[1], t)),
        int(_lerp(c1[2], c2[2], t)),
    )


def cosmic_background(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    px = img.load()
    cx = cy = size / 2
    for y in range(size):
        for x in range(size):
            t = y / max(size - 1, 1)
            base = _rgb_lerp((8, 6, 22), (26, 12, 48), t)
            dx = (x - cx) / size
            dy = (y - cy) / size
            dist = math.sqrt(dx * dx + dy * dy)
            glow = max(0.0, 1.0 - dist * 1.35)
            r = min(255, int(base[0] + glow * 42))
            g = min(255, int(base[1] + glow * 18))
            b = min(255, int(base[2] + glow * 55))
            px[x, y] = (r, g, b, 255)
    return img


def draw_stars(draw: ImageDraw.ImageDraw, size: int, seed: int = 7) -> None:
    rng = seed
    for _ in range(max(10, size // 10)):
        rng = (rng * 1103515245 + 12345) & 0x7FFFFFFF
        x = rng % size
        rng = (rng * 1103515245 + 12345) & 0x7FFFFFFF
        y = rng % size
        rng = (rng * 1103515245 + 12345) & 0x7FFFFFFF
        r = 1 + (rng % 2)
        alpha = 140 + (rng % 100)
        draw.ellipse((x - r, y - r, x + r, y + r), fill=(230, 220, 255, alpha))


def draw_crescent(draw: ImageDraw.ImageDraw, size: int) -> None:
    cx = size * 0.52
    cy = size * 0.46
    outer = int(size * 0.34)
    inner = int(size * 0.29)
    draw.ellipse(
        (cx - outer, cy - outer, cx + outer, cy + outer),
        fill=(255, 220, 150, 255),
    )
    draw.ellipse(
        (cx - inner + size * 0.08, cy - inner, cx + inner + size * 0.08, cy + inner),
        fill=(12, 8, 28, 255),
    )
    glow = int(size * 0.38)
    draw.ellipse(
        (cx - glow, cy - glow, cx + glow, cy + glow),
        outline=(201, 168, 124, 90),
        width=max(2, size // 64),
    )


def draw_face_silhouette(draw: ImageDraw.ImageDraw, size: int) -> None:
    cx = size * 0.5
    cy = size * 0.58
    face_r = int(size * 0.17)
    draw.ellipse(
        (cx - face_r, cy - face_r, cx + face_r, cy + face_r),
        fill=(235, 195, 168, 255),
    )
    hair_w = int(size * 0.22)
    hair_h = int(size * 0.16)
    draw.ellipse(
        (cx - hair_w, cy - face_r - hair_h, cx + hair_w, cy - face_r * 0.15),
        fill=(48, 28, 38, 255),
    )
    draw.ellipse(
        (cx - face_r, cy - face_r, cx + face_r, cy + face_r),
        fill=(240, 200, 172, 255),
    )
    eye_y = cy - size * 0.02
    eye_dx = size * 0.055
    eye_r = max(2, int(size * 0.028))
    for ex in (cx - eye_dx, cx + eye_dx):
        draw.ellipse(
            (ex - eye_r, eye_y - eye_r, ex + eye_r, eye_y + eye_r),
            fill=(28, 48, 88, 255),
        )
        draw.ellipse(
            (ex - eye_r // 3, eye_y - eye_r // 2, ex + eye_r // 4, eye_y + eye_r // 4),
            fill=(210, 230, 255, 220),
        )
    mouth_w = int(size * 0.07)
    draw.arc(
        (cx - mouth_w, cy + size * 0.03, cx + mouth_w, cy + size * 0.11),
        start=15,
        end=165,
        fill=(190, 95, 120, 255),
        width=max(2, size // 72),
    )


def draw_icon(size: int) -> Image.Image:
    img = cosmic_background(size)
    draw = ImageDraw.Draw(img)
    draw_stars(draw, size)

    ring = int(size * 0.42)
    cx = cy = size // 2
    draw.ellipse(
        (cx - ring, cy - ring, cx + ring, cy + ring),
        outline=(201, 168, 124, 120),
        width=max(2, size // 48),
    )

    draw_crescent(draw, size)
    draw_face_silhouette(draw, size)

    accent = int(size * 0.08)
    draw.polygon(
        [
            (cx, cy - ring - accent),
            (cx + accent, cy - ring + accent * 0.4),
            (cx - accent, cy - ring + accent * 0.4),
        ],
        fill=(255, 120, 180, 220),
    )

    if size >= 96:
        img = img.filter(ImageFilter.UnsharpMask(radius=1.2, percent=130, threshold=2))
    return img


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for size in (192, 512, 180):
        draw_icon(size).save(OUT / f"icon-{size}.png")
    ico_sizes = [256, 128, 64, 48, 32, 16]
    draw_icon(256).save(
        OUT / "luna.ico",
        format="ICO",
        sizes=[(s, s) for s in ico_sizes],
    )
    print(f"Icons written to {OUT} (including luna.ico)")


if __name__ == "__main__":
    main()