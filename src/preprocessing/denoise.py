"""
EchoAssist — Audio Denoising Module

Applies noise reduction to raw heart sound .wav files
using the noisereduce library before downstream processing.
"""

import librosa
import noisereduce as nr
import soundfile as sf


def denoise(input_path: str, output_path: str) -> str:
    """
    Applies noise reduction to a heart sound .wav file.

    Parameters
    ----------
    input_path : str
        Path to raw audio file.
    output_path : str
        Where to save the denoised audio.

    Returns
    -------
    str
        output_path — the path the cleaned file was written to.
    """
    # Load at native sample rate (sr=None) so we don't resample here;
    # resampling is handled separately by resample.py
    y, sr = librosa.load(input_path, sr=None)

    # noisereduce's default time_mask_smooth_ms can be too small for short clips
    # or low sample rates. We compute the max smoothing that fits in the signal
    # duration (capped at 1000ms), and ensure it meets the library's 128ms minimum.
    duration_ms = (len(y) / sr) * 1000
    time_mask_smooth_ms = max(128, min(1000, int(duration_ms // 4)))

    # Apply spectral-gating noise reduction
    reduced = nr.reduce_noise(
        y=y,
        sr=sr,
        time_mask_smooth_ms=time_mask_smooth_ms,
    )

    # Write the denoised audio
    sf.write(output_path, reduced, sr)

    return output_path
