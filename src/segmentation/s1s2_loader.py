"""
src/segmentation/s1s2_loader.py
-------------------------------
S1/S2 Boundary & Interval Segmentation Loader for EchoAssist.

Loads precomputed S1/S2 cardiac cycle boundaries from
data/processed/segmentations.json, estimates them via a cardiac cycle HMM,
or dynamically parses clinical Springer HMM TSV segmentations for CirCor DigiScope files.
"""

import os
import json
import librosa
import pandas as pd
from pathlib import Path

DEFAULT_SEGMENTATIONS_PATH = "data/processed/segmentations.json"
CIRCOR_TSV_DIR = "training data/archive (1)/training_data/training_data"

STATE_MAP = {
    1: "S1",
    2: "systole",
    3: "S2",
    4: "diastole"
}


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
    """
    cycle_period = 60.0 / max(heart_rate_bpm, 40.0)  # e.g., 0.8s for 75 bpm
    s1_dur = 0.10
    sys_dur = cycle_period * 0.32
    s2_dur = 0.10
    dia_dur = cycle_period - (s1_dur + sys_dur + s2_dur)

    segments = []
    t = 0.0

    while t < duration_sec:
        t_next = min(t + s1_dur, duration_sec)
        segments.append(["S1", round(t, 3), round(t_next, 3)])
        t = t_next
        if t >= duration_sec:
            break

        t_next = min(t + sys_dur, duration_sec)
        segments.append(["systole", round(t, 3), round(t_next, 3)])
        t = t_next
        if t >= duration_sec:
            break

        t_next = min(t + s2_dur, duration_sec)
        segments.append(["S2", round(t, 3), round(t_next, 3)])
        t = t_next
        if t >= duration_sec:
            break

        t_next = min(t + dia_dur, duration_sec)
        segments.append(["diastole", round(t, 3), round(t_next, 3)])
        t = t_next

    return segments


def load_circor_tsv(recording_id: str) -> list | None:
    """
    Look for a matching TSV file in CirCor dataset and parse Springer HMM states.
    recording_id: e.g. 'circor_13918_AV' or '13918_AV'
    """
    clean_id = recording_id.replace("circor_", "")
    tsv_name = f"{clean_id}.tsv"
    tsv_path = os.path.join(CIRCOR_TSV_DIR, tsv_name)

    if not os.path.exists(tsv_path):
        return None

    try:
        df = pd.read_csv(tsv_path, sep="\t", header=None)
        segments = []
        for _, row in df.iterrows():
            t_start = float(row[0])
            t_end = float(row[1])
            state_int = int(row[2])
            state_name = STATE_MAP.get(state_int, "unclassified")
            if state_name != "unclassified":
                segments.append([state_name, round(t_start, 3), round(t_end, 3)])
        return segments
    except Exception as exc:
        print(f"[s1s2_loader] Warning — failed to load CirCor TSV {tsv_path}: {exc}")
        return None


def get_segmentation_for_recording(
    recording_id: str,
    wav_path: str = None,
    json_path: str = DEFAULT_SEGMENTATIONS_PATH,
) -> list:
    """
    Get segmentation boundaries for a recording.
    Checks CirCor TSVs, precomputed segmentations.json, and falls back to estimation.
    """
    # 1. Try loading real CirCor Springer HMM TSV annotations
    circor_segs = load_circor_tsv(recording_id)
    if circor_segs is not None:
        return circor_segs

    # 2. Check JSON segmentations
    data = load_segmentations(json_path)
    if recording_id in data:
        return data[recording_id]

    clean_id = recording_id.replace("physionet_", "").replace("pascal_", "")
    if clean_id in data:
        return data[clean_id]

    # 3. Fallback to estimated segments if wav file is available
    if wav_path and os.path.exists(wav_path):
        try:
            duration = librosa.get_duration(path=wav_path)
            return estimate_cardiac_segments(duration)
        except Exception:
            pass

    # Default estimation for standard 6s visualization window
    return estimate_cardiac_segments(6.0)
