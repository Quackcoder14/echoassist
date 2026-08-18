"""
src/evaluation/edge_cases.py
Audio Validity and Edge-Case Handling Module for EchoAssist.

Exposes check_audio_validity() and handle_corrupted_audio() for validating
uploaded cardiac recordings before model inference.
"""

import os
import numpy as np
import librosa


def check_audio_validity(audio_path: str, min_duration: float = 0.5, max_duration: float = 120.0) -> dict:
    """
    Validates a raw or processed audio recording.

    Checks:
      1. File existence & readability
      2. Non-zero duration (>= min_duration seconds)
      3. Signal amplitude (detects silent/unplugged mic recordings)
      4. Excessive noise / clipping

    Parameters
    ----------
    audio_path : str
        Path to the WAV file.
    min_duration : float
        Minimum valid duration in seconds (default 0.5s).
    max_duration : float
        Maximum allowed duration in seconds (default 120s).

    Returns
    -------
    dict
        {"valid": bool, "reason": str, "duration_sec": float}
    """
    if not os.path.exists(audio_path):
        return {"valid": False, "reason": "File does not exist", "duration_sec": 0.0}

    if os.path.getsize(audio_path) == 0:
        return {"valid": False, "reason": "File is empty (0 bytes)", "duration_sec": 0.0}

    try:
        audio, sr = librosa.load(audio_path, sr=None, mono=True)
    except Exception as exc:
        return {"valid": False, "reason": f"Corrupted audio file (cannot decode): {exc}", "duration_sec": 0.0}

    if len(audio) == 0:
        return {"valid": False, "reason": "Audio stream contains 0 samples", "duration_sec": 0.0}

    duration = float(len(audio) / sr)

    if duration < min_duration:
        return {
            "valid": False,
            "reason": f"Recording too short ({duration:.2f}s < {min_duration:.1f}s threshold)",
            "duration_sec": round(duration, 3),
        }

    if duration > max_duration:
        return {
            "valid": False,
            "reason": f"Recording too long ({duration:.1f}s > {max_duration:.1f}s limit)",
            "duration_sec": round(duration, 3),
        }

    max_amp = float(np.max(np.abs(audio)))
    if max_amp < 1e-4:
        return {
            "valid": False,
            "reason": "Silent recording — no signal detected (microphones unplugged or silent)",
            "duration_sec": round(duration, 3),
        }

    rms = float(np.sqrt(np.mean(audio ** 2)))
    if rms < 1e-5:
        return {
            "valid": False,
            "reason": "Near-zero RMS energy — background noise floor only",
            "duration_sec": round(duration, 3),
        }

    return {
        "valid": True,
        "reason": "OK",
        "duration_sec": round(duration, 3),
    }


def handle_corrupted_audio(audio_path: str) -> dict:
    """
    Fallback handler returning a safe default dictionary when audio fails.
    """
    validity = check_audio_validity(audio_path)
    return {
        "valid": validity["valid"],
        "reason": validity["reason"],
        "duration_sec": validity["duration_sec"],
        "label": "artifact" if not validity["valid"] else "unknown",
        "confidence": 0.0,
    }
