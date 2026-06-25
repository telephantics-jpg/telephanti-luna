from dataclasses import dataclass


@dataclass(frozen=True)
class HParams:
    num_mels: int = 80
    rescale: bool = True
    rescaling_max: float = 0.9
    use_lws: bool = False
    n_fft: int = 800
    hop_size: int = 200
    win_size: int = 800
    sample_rate: int = 16000
    frame_shift_ms: float | None = None
    signal_normalization: bool = True
    allow_clipping_in_normalization: bool = True
    symmetric_mels: bool = True
    max_abs_value: float = 4.0
    preemphasize: bool = True
    preemphasis: float = 0.97
    min_level_db: int = -100
    ref_level_db: int = 20
    fmin: int = 55
    fmax: int = 7600
    img_size: int = 96
    fps: float = 25.0


hp = HParams()