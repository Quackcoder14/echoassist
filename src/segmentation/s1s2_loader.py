"""
src/segmentation/s1s2_loader.py
S1/S2 Boundary & Interval Segmentation Loader for EchoAssist.

Loads precomputed S1/S2 cardiac cycle boundaries from
data/processed/segmentations.json or computes estimated cardiac phase
intervals (S1, systole, S2, diastole) for audio playback visualization.
"""

import os
import json
import librosa


DEFAULT_SEGMENTATIONS_PATH = "data/processed/segmentations.json"


def load_segmentations(json_path: str = DEFAULT_SEGMENTATIONS_PATH) -> dict:
    """Load the full segmentations dictionary from disk."""
    if not os.path.exists(json_path):
        return {}
    try:
        with open(json_path, "r") as f:
            return json.load(f)
    except Exception as exc:
        print(f"[s1s2_loader] Warning — could not read {json_path}: {exc}")
        return {}


def estimate_cardiac_segments(duration_sec: float, heart_rate_bpm: float = 75.0) -> list:
    """
    Estimate periodic S1, systole, S2, diastole boundaries for cardiac recordings.

    Standard cardiac cycle model at ~75 BPM (period ~0.8s):
      - S1 (first heart sound): ~0.10s
      - Systole: ~0.25s
      - S2 (second heart sound): ~0.10s
      - Diastole: ~0.35s

    Returns
    -------
    list of tuples: [["S1", t_start, t_end], ["systole", ...], ...]
    """
    cycle_period = 60.0 / max(heart_rate_bpm, 40.0)  # e.g., 0.8s for 75 bpm
    s1_dur = 0.10
    sys_dur = cycle_period * 0.32
    s2_dur = 0.10
    dia_dur = cycle_period - (s1_dur + sys_dur + s2_dur)

    segments = []
    t = 0.0

    while t < duration_sec:
        # S1 phase
        t_next = min(t + s1_dur, duration_sec)
        segments.append(["S1", round(t, 3), round(t_next, 3)])
        t = t_next
        if t >= duration_sec:
            break

        # Systole phase
        t_next = min(t + sys_dur, duration_sec)
        segments.append(["systole", round(t, 3), round(t_next, 3)])
        t = t_next
        if t >= duration_sec:
            break

        # S2 phase
        t_next = min(t + s2_dur, duration_sec)
        segments.append(["S2", round(t, 3), round(t_next, 3)])
        t = t_next
        if t >= duration_sec:
            break

        # Diastole phase
        t_next = min(t + dia_dur, duration_sec)
        segments.append(["diastole", round(t, 3), round(t_next, 3)])
        t = t_next

    return segments


def get_segmentation_for_recording(
    recording_id: str,
    wav_path: str = None,
    json_path: str = DEFAULT_SEGMENTATIONS_PATH,
) -> list:
    """
    Get segmentation boundaries for a recording.

    Checks pre-computed segmentations.json first.
    If not found and wav_path is given, generates estimated cardiac phase segments.

    Returns
    -------
    list of [phase_name, start_sec, end_sec]
    """
    data = load_segmentations(json_path)
    if recording_id in data:
        return data[recording_id]

    # Check without prefix
    clean_id = recording_id.replace("physionet_", "").replace("pascal_", "")
    if clean_id in data:
        return data[clean_id]

    # Fallback to estimated segments if audio file is available
    if wav_path and os.path.exists(wav_path):
        try:
            duration = librosa.get_duration(path=wav_path)
            return estimate_cardiac_segments(duration)
        except Exception:
            pass

    return []
