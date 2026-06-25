"""Wav2Lip ONNX — static portrait lip-sync for Luna."""

from __future__ import annotations

import hashlib
import json
import logging
import os
import subprocess
import shutil
import time
from pathlib import Path

import cv2
import numpy as np

from . import audio_util
from .hparams import hp

log = logging.getLogger("luna.lipsync")

ROOT = Path(__file__).resolve().parent.parent
MODEL_PATH = Path(os.getenv("LUNA_LIPSYNC_MODEL", ROOT / "models" / "lipsync" / "wav2lip.onnx"))
PORTRAIT_PATH = Path(os.getenv("LUNA_PORTRAIT", ROOT / "static" / "avatars" / "luna-portrait.jpg"))
FACE_BOX_PATH = Path(__file__).resolve().parent / "face_box.json"
CACHE_DIR = Path(os.getenv("LUNA_LIPSYNC_CACHE", ROOT / "static" / "lipsync_cache"))
MEL_STEP = 16
MAX_AUDIO_SEC = float(os.getenv("LUNA_LIPSYNC_MAX_SEC", "18"))

_engine: "LipsyncEngine | None" = None


def lipsync_enabled() -> bool:
    if os.getenv("LUNA_LIPSYNC", "1").strip().lower() in ("0", "false", "no", "off"):
        return False
    return MODEL_PATH.is_file() and PORTRAIT_PATH.is_file()


def lipsync_available() -> bool:
    try:
        import onnxruntime  # noqa: F401
    except ImportError:
        return False
    return lipsync_enabled()


def _load_face_box() -> tuple[int, int, int, int]:
    data = json.loads(FACE_BOX_PATH.read_text(encoding="utf-8"))
    y1, y2, x1, x2 = data["box"]
    pads = data.get("pads", [0, 10, 0, 0])
    pady1, pady2, padx1, padx2 = pads
    return y1 - pady1, y2 + pady2, x1 - padx1, x2 + padx2


class LipsyncEngine:
    def __init__(self) -> None:
        import onnxruntime as ort

        if not MODEL_PATH.is_file():
            raise FileNotFoundError(f"Missing Wav2Lip model: {MODEL_PATH}")
        providers = ["CPUExecutionProvider"]
        if ort.get_device() == "GPU":
            providers = ["CUDAExecutionProvider", "CPUExecutionProvider"]
        opts = ort.SessionOptions()
        opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        self.session = ort.InferenceSession(str(MODEL_PATH), sess_options=opts, providers=providers)
        self.frame = self._load_portrait()
        self.box = _load_face_box()
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        log.info("Wav2Lip ready (%s)", ort.get_device())

    def _load_portrait(self) -> np.ndarray:
        img = cv2.imread(str(PORTRAIT_PATH))
        if img is None:
            raise FileNotFoundError(f"Cannot read portrait: {PORTRAIT_PATH}")
        return img

    def _cache_key(self, audio_bytes: bytes) -> str:
        return hashlib.sha256(audio_bytes).hexdigest()[:24]

    def cache_path(self, audio_bytes: bytes) -> Path:
        return CACHE_DIR / f"luna_{self._cache_key(audio_bytes)}.mp4"

    def render(self, audio_bytes: bytes, *, outfile: Path | None = None) -> Path:
        out = outfile or self.cache_path(audio_bytes)
        if out.is_file() and out.stat().st_size > 1024:
            return out

        work = CACHE_DIR / f"_work_{self._cache_key(audio_bytes)}"
        work.mkdir(parents=True, exist_ok=True)
        wav_path = work / "speech.wav"
        avi_path = work / "frames.avi"
        tmp_mp4 = work / "result.mp4"
        try:
            self._write_wav(audio_bytes, wav_path)
            duration = self._wav_duration(wav_path)
            if duration > MAX_AUDIO_SEC:
                raise ValueError(f"Audio too long for lip-sync ({duration:.1f}s > {MAX_AUDIO_SEC}s)")

            wav = audio_util.load_wav(str(wav_path), hp.sample_rate)
            mel = audio_util.melspectrogram(wav)
            if np.isnan(mel.reshape(-1)).sum() > 0:
                raise ValueError("Mel spectrogram contains NaN")

            mel_chunks = self._mel_chunks(mel, hp.fps)
            frames = self._generate_frames(mel_chunks, avi_path)
            if frames < 1:
                raise RuntimeError("No frames generated")

            self._mux_audio(wav_path, avi_path, tmp_mp4)
            out.parent.mkdir(parents=True, exist_ok=True)
            if out.exists():
                out.unlink()
            shutil.copy2(tmp_mp4, out)
        finally:
            for p in (avi_path, wav_path, tmp_mp4):
                try:
                    if p.exists():
                        p.unlink()
                except OSError:
                    pass
            try:
                work.rmdir()
            except OSError:
                pass
        return out

    def _write_wav(self, audio_bytes: bytes, wav_path: Path) -> None:
        if audio_bytes[:4] == b"RIFF":
            wav_path.write_bytes(audio_bytes)
            return
        src = wav_path.with_suffix(".src")
        src.write_bytes(audio_bytes)
        cmd = [
            "ffmpeg", "-y", "-i", str(src),
            "-ar", str(hp.sample_rate), "-ac", "1",
            str(wav_path),
        ]
        subprocess.run(cmd, check=True, capture_output=True)

    def _wav_duration(self, wav_path: Path) -> float:
        wav = audio_util.load_wav(str(wav_path), hp.sample_rate)
        return len(wav) / hp.sample_rate

    def _mel_chunks(self, mel: np.ndarray, fps: float) -> list[np.ndarray]:
        chunks: list[np.ndarray] = []
        mul = 80.0 / fps
        i = 0
        while True:
            start = int(i * mul)
            if start + MEL_STEP > mel.shape[1]:
                chunks.append(mel[:, mel.shape[1] - MEL_STEP :])
                break
            chunks.append(mel[:, start : start + MEL_STEP])
            i += 1
        return chunks

    def _face_crop(self, frame: np.ndarray) -> tuple[np.ndarray, tuple[int, int, int, int]]:
        y1, y2, x1, x2 = self.box
        h, w = frame.shape[:2]
        y1 = max(0, min(h - 2, y1))
        y2 = max(y1 + 2, min(h, y2))
        x1 = max(0, min(w - 2, x1))
        x2 = max(x1 + 2, min(w, x2))
        face = frame[y1:y2, x1:x2]
        face = cv2.resize(face, (hp.img_size, hp.img_size))
        return face, (y1, y2, x1, x2)

    def _generate_frames(self, mel_chunks: list[np.ndarray], avi_path: Path) -> int:
        frame_h, frame_w = self.frame.shape[:2]
        writer = cv2.VideoWriter(
            str(avi_path),
            cv2.VideoWriter_fourcc(*"MJPG"),
            hp.fps,
            (frame_w, frame_h),
        )
        if not writer.isOpened():
            raise RuntimeError("VideoWriter failed")

        base_face, coords = self._face_crop(self.frame)
        count = 0
        batch_size = 8
        for i in range(0, len(mel_chunks), batch_size):
            mels = mel_chunks[i : i + batch_size]
            img_batch = []
            mel_batch = []
            for m in mels:
                face = base_face.copy()
                img_masked = face.copy()
                img_masked[:, hp.img_size // 2 :] = 0
                combined = np.concatenate((img_masked, face), axis=2) / 255.0
                img_batch.append(combined)
                mel_batch.append(m)

            img_np = np.asarray(img_batch, dtype=np.float32).transpose((0, 3, 1, 2))
            mel_np = np.asarray(mel_batch, dtype=np.float32)
            mel_np = mel_np.reshape((len(mel_batch), mel_np.shape[1], mel_np.shape[2], 1))
            mel_np = mel_np.transpose((0, 3, 1, 2))

            pred = self.session.run(
                None,
                {"mel": mel_np, "vid": img_np},
            )[0]

            for j in range(pred.shape[0]):
                p = pred[j].transpose(1, 2, 0) * 255.0
                p = np.clip(p, 0, 255).astype(np.uint8)
                out_frame = self.frame.copy()
                y1, y2, x1, x2 = coords
                p = cv2.resize(p, (x2 - x1, y2 - y1))
                out_frame[y1:y2, x1:x2] = p
                writer.write(out_frame)
                count += 1

        writer.release()
        del writer
        time.sleep(0.15)
        return count

    def _mux_audio(self, wav_path: Path, avi_path: Path, out_path: Path) -> None:
        attempts = [
            ["-c:a", "aac", "-strict", "-2"],
            ["-c:a", "libvo_aacenc"],
            ["-c:a", "copy"],
        ]
        last_err = ""
        for audio_args in attempts:
            cmd = [
                "ffmpeg", "-y",
                "-i", str(avi_path),
                "-i", str(wav_path),
                "-c:v", "libx264",
                "-pix_fmt", "yuv420p",
                *audio_args,
                "-shortest",
                "-movflags", "+faststart",
                str(out_path),
            ]
            proc = subprocess.run(cmd, capture_output=True, text=True)
            if proc.returncode == 0 and out_path.is_file() and out_path.stat().st_size > 1024:
                return
            last_err = proc.stderr or proc.stdout or "ffmpeg mux failed"
        raise RuntimeError(last_err[-500:])


def get_engine() -> LipsyncEngine | None:
    global _engine
    if not lipsync_available():
        return None
    if _engine is None:
        _engine = LipsyncEngine()
    return _engine


def render_lipsync_video(audio_bytes: bytes) -> Path | None:
    engine = get_engine()
    if not engine:
        return None
    t0 = time.perf_counter()
    try:
        out = engine.render(audio_bytes)
        log.info("Lip-sync done in %.1fs -> %s", time.perf_counter() - t0, out.name)
        return out
    except Exception as exc:
        log.warning("Lip-sync failed: %s", exc)
        return None