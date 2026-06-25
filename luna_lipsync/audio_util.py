"""Mel spectrogram utilities (from Wav2Lip audio.py)."""

from __future__ import annotations

import librosa
import librosa.filters
import numpy as np
from scipy import signal

from .hparams import hp


def get_hop_size() -> int:
    if hp.hop_size:
        return hp.hop_size
    assert hp.frame_shift_ms is not None
    return int(hp.frame_shift_ms / 1000 * hp.sample_rate)


def load_wav(path: str, sr: int = hp.sample_rate) -> np.ndarray:
    wav, _ = librosa.core.load(path, sr=sr)
    return wav


def preemphasis(wav: np.ndarray, k: float, enabled: bool = True) -> np.ndarray:
    if not enabled:
        return wav
    return signal.lfilter([1, -k], [1], wav)


def _stft(y: np.ndarray) -> np.ndarray:
    return librosa.stft(y=y, n_fft=hp.n_fft, hop_length=get_hop_size(), win_length=hp.win_size)


_mel_basis: np.ndarray | None = None


def _build_mel_basis() -> np.ndarray:
    assert hp.fmax <= hp.sample_rate // 2
    return librosa.filters.mel(
        sr=hp.sample_rate,
        n_fft=hp.n_fft,
        n_mels=hp.num_mels,
        fmin=hp.fmin,
        fmax=hp.fmax,
    )


def _linear_to_mel(spectrogram: np.ndarray) -> np.ndarray:
    global _mel_basis
    if _mel_basis is None:
        _mel_basis = _build_mel_basis()
    return np.dot(_mel_basis, spectrogram)


def _amp_to_db(x: np.ndarray) -> np.ndarray:
    min_level = np.exp(hp.min_level_db / 20 * np.log(10))
    return 20 * np.log10(np.maximum(min_level, x))


def _normalize(S: np.ndarray) -> np.ndarray:
    if hp.allow_clipping_in_normalization:
        if hp.symmetric_mels:
            return np.clip(
                (2 * hp.max_abs_value) * ((S - hp.min_level_db) / (-hp.min_level_db)) - hp.max_abs_value,
                -hp.max_abs_value,
                hp.max_abs_value,
            )
        return np.clip(
            hp.max_abs_value * ((S - hp.min_level_db) / (-hp.min_level_db)),
            0,
            hp.max_abs_value,
        )
    if hp.symmetric_mels:
        return (2 * hp.max_abs_value) * ((S - hp.min_level_db) / (-hp.min_level_db)) - hp.max_abs_value
    return hp.max_abs_value * ((S - hp.min_level_db) / (-hp.min_level_db))


def melspectrogram(wav: np.ndarray) -> np.ndarray:
    D = _stft(preemphasis(wav, hp.preemphasis, hp.preemphasize))
    S = _amp_to_db(_linear_to_mel(np.abs(D))) - hp.ref_level_db
    if hp.signal_normalization:
        return _normalize(S)
    return S