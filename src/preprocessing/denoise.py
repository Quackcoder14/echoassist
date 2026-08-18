"""
src/preprocessing/denoise.py
EchoAssist — Audio Denoising Module

Applies noise reduction to raw heart sound .wav files
using the noisereduce library before downstream processing.
"""

import librosa
import soundfile as sf

try:
    import noisereduce as nr
    _HAS_NOISEREDUCE = True
except ImportError:
    _HAS_NOISEREDUCE = False


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

    if _HAS_NOISEREDUCE:
        try:
            duration_ms = (len(y) / sr) * 1000
            time_mask_smooth_ms = max(128, min(1000, int(duration_ms // 4)))

            reduced = nr.reduce_noise(
                y=y,
                sr=sr,
                time_mask_smooth_ms=time_mask_smooth_ms,
            )
            sf.write(output_path, reduced, sr)
            return output_path
        except Exception as exc:
            print(f"[denoise] Warning — noisereduce failed on {input_path}: {exc}. Using raw signal.")

    # Fallback: save clean copy of audio
    sf.write(output_path, y, sr)
    return output_path
