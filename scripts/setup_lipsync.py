#!/usr/bin/env python3
"""Download Wav2Lip ONNX model and calibrate Luna face box."""

from __future__ import annotations

import json
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MODEL_DIR = ROOT / "models" / "lipsync"
MODEL_PATH = MODEL_DIR / "wav2lip.onnx"
PORTRAIT = ROOT / "static" / "avatars" / "luna-portrait.jpg"
FACE_BOX = ROOT / "luna_lipsync" / "face_box.json"
MODEL_URL = "https://huggingface.co/bluefoxcreation/Wav2lip-Onnx/resolve/main/wav2lip.onnx"


def download_model() -> None:
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    if MODEL_PATH.is_file() and MODEL_PATH.stat().st_size > 1_000_000:
        print(f"Model already present: {MODEL_PATH}")
        return
    print(f"Downloading Wav2Lip ONNX (~138MB) to {MODEL_PATH} ...")
    urllib.request.urlretrieve(MODEL_URL, MODEL_PATH)
    print(f"Saved {MODEL_PATH.stat().st_size} bytes")


def calibrate_face() -> None:
    import cv2

    img = cv2.imread(str(PORTRAIT))
    if img is None:
        raise SystemExit(f"Missing portrait: {PORTRAIT}")
    h, w = img.shape[:2]
    cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    faces = cascade.detectMultiScale(gray, 1.08, 5, minSize=(180, 180))
    if len(faces) == 0:
        box = [int(h * 0.10), int(h * 0.58), int(w * 0.22), int(w * 0.78)]
    else:
        x, y, fw, fh = max(faces, key=lambda f: f[2] * f[3])
        box = [int(v) for v in [
            max(0, y - int(fh * 0.08)),
            min(h, y + int(fh * 1.55)),
            max(0, x - int(fw * 0.12)),
            min(w, x + int(fw * 1.12)),
        ]]
    data = {
        "source": PORTRAIT.name,
        "image_size": [w, h],
        "box": box,
        "pads": [0, 18, 0, 0],
        "note": "y1,y2,x1,x2 in pixels",
    }
    FACE_BOX.write_text(json.dumps(data, indent=2), encoding="utf-8")
    print(f"Face box saved: {box} -> {FACE_BOX}")


def main() -> int:
    download_model()
    calibrate_face()
    print("Done. Set LUNA_LIPSYNC=1 and pip install -r requirements-lipsync.txt")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())