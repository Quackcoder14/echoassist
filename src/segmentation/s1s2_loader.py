"""
src/segmentation/s1s2_loader.py
================================
Loads S1/S2/systole/diastole heart-sound state boundaries for every recording
in metadata.csv and exports them to data/processed/segmentations.json.

Supported annotation sources
-----------------------------
PhysioNet 2016 (training-a, training-b, training-e)
    Annotations live under:
        data/raw/physionet2016/annotations/hand_corrected/<recording_base>.tsv
    Format (tab-separated, no header):
        <end_sample>\t<state_int>
    where state_int: 1=S1, 2=systole, 3=S2, 4=diastole
    The start of a state is the end_sample of the previous row (0 for the first).
    Sample rate is read from the companion .hea file (always 2000 Hz for this
    challenge, but we parse it defensively).

PASCAL (setA / setB, normal recordings only)
    Annotations live under:
        data/raw/pascal/setA/Atraining_normal_seg.csv
        data/raw/pascal/setB/Btraining_normal_seg.csv
    Format: CSV with a filename column, then alternating S1/S2 sample-index
    columns (points, not intervals).  We infer intervals from consecutive
    timestamps using the following cardiac-cycle model:
        S1 start → S1 end ≈ next S2 start        (systole in between)
        S2 start → S2 end ≈ next S1 start         (diastole in between)
    See _load_pascal_segmentation() for the exact logic.

Output contract
---------------
Every recording ID from metadata.csv gets a key in segmentations.json.
If no annotation is available the value is an empty list [].
State label strings are EXACTLY: "S1", "systole", "S2", "diastole"
"""

from __future__ import annotations

import csv
import json
import os
import re
import warnings
from pathlib import Path
from typing import Optional

import pandas as pd


# ── Constants ─────────────────────────────────────────────────────────────────

# Integer state codes used in PhysioNet TSV annotations
_PHYSIONET_STATE_MAP: dict[int, str] = {
    1: "S1",
    2: "systole",
    3: "S2",
    4: "diastole",
}

# Default sample rate for PhysioNet 2016 (all recordings resampled to 2000 Hz).
# We still parse the .hea file so we degrade gracefully if a file differs.
_PHYSIONET_DEFAULT_FS: int = 2000

# PASCAL default sample rate (recordings vary; 44100 or 22050 Hz are common).
# We parse the .wav header where possible; fall back to this if not available.
_PASCAL_DEFAULT_FS: int = 44100

# Fixed half-width (seconds) used to assign a duration to a PASCAL S1/S2 event
# when we cannot infer the boundary from the next event of the SAME type.
_PASCAL_FALLBACK_HALF_WIDTH: float = 0.050  # 50 ms


# ── Helpers: PhysioNet ────────────────────────────────────────────────────────

def _parse_hea_sample_rate(hea_path: str | Path) -> int:
    """
    Extract the sample rate from a WFDB .hea header file.

    The first line of a .hea file has the form:
        <record_name> <num_signals> <fs> [<num_samples> ...]
    Returns the integer sample rate, or _PHYSIONET_DEFAULT_FS on any parse error.
    """
    try:
        with open(hea_path, "r", encoding="utf-8", errors="replace") as fh:
            first_line = fh.readline().strip()
        parts = first_line.split()
        if len(parts) >= 3:
            return int(float(parts[2]))
    except Exception:
        pass
    return _PHYSIONET_DEFAULT_FS


def _physionet_recording_parts(recording_id: str) -> tuple[str, str]:
    """
    Split a physionet recording_id into (subset_letter, base_name).

    Examples
    --------
    "physionet_a0001"  →  ("a", "a0001")
    "physionet_b0023"  →  ("b", "b0023")
    """
    # recording_id is expected to be "physionet_<letter><digits>"
    base = recording_id[len("physionet_"):]   # e.g. "a0001"
    if not base:
        raise ValueError(f"Cannot parse recording_id: {recording_id!r}")
    subset_letter = base[0].lower()
    return subset_letter, base


def _find_physionet_tsv(recording_id: str, annotation_dir: str | Path) -> Optional[Path]:
    """
    Locate the hand-corrected .tsv annotation file for a PhysioNet recording.

    Expected location (relative to annotation_dir):
        physionet2016/annotations/hand_corrected/<base>_StateAns.tsv
    or any .tsv whose stem starts with <base> inside the hand_corrected folder.

    Falls back to springer_alg if hand_corrected is missing.
    """
    annotation_dir = Path(annotation_dir)
    _, base = _physionet_recording_parts(recording_id)

    search_roots = [
        annotation_dir / "physionet2016" / "annotations" / "hand_corrected",
        annotation_dir / "physionet2016" / "annotations" / "springer_alg",
    ]

    # Also accept annotations sitting directly inside a training-X subfolder
    subset_letter = base[0].lower()
    search_roots += [
        annotation_dir / "physionet2016" / f"training-{subset_letter}",
        annotation_dir / "physionet2016",
    ]

    for root in search_roots:
        if not root.is_dir():
            continue
        # Try exact names first
        for candidate in [
            root / f"{base}_StateAns.tsv",
            root / f"{base}_StateAns0.tsv",
            root / f"{base}.tsv",
        ]:
            if candidate.is_file():
                return candidate
        # Glob fallback: any tsv starting with the base name
        matches = sorted(root.glob(f"{base}*.tsv"))
        if matches:
            return matches[0]

    return None


def _parse_physionet_tsv(
    tsv_path: str | Path,
    fs: int,
) -> list[tuple[str, float, float]]:
    """
    Parse a PhysioNet state-annotation TSV file.

    File format (no header, tab-separated):
        <end_sample>  <state_int>

    Each row gives the **end** sample index (1-based) of the state window.
    The start of window i is the end of window i-1 (0 for the first window).

    Parameters
    ----------
    tsv_path : path to the .tsv file
    fs       : sample rate in Hz (used to convert samples → seconds)

    Returns
    -------
    List of (state_label, start_sec, end_sec) tuples in chronological order.
    """
    segments: list[tuple[str, float, float]] = []
    prev_end_sample = 0

    with open(tsv_path, "r", encoding="utf-8", errors="replace") as fh:
        for lineno, raw_line in enumerate(fh, start=1):
            line = raw_line.strip()
            if not line or line.startswith("#"):
                continue

            parts = line.split()
            if len(parts) < 2:
                warnings.warn(
                    f"{tsv_path}:{lineno}: expected 2 columns, got {len(parts)!r} — skipping"
                )
                continue

            try:
                end_sample = int(float(parts[0]))
                state_int = int(float(parts[1]))
            except ValueError:
                warnings.warn(f"{tsv_path}:{lineno}: cannot parse {parts!r} — skipping")
                continue

            label = _PHYSIONET_STATE_MAP.get(state_int)
            if label is None:
                # state 0 often marks the very first partial beat; skip it
                prev_end_sample = end_sample
                continue

            start_sec = prev_end_sample / fs
            end_sec = end_sample / fs

            if end_sec > start_sec:  # ignore zero-length or inverted windows
                segments.append((label, round(start_sec, 6), round(end_sec, 6)))

            prev_end_sample = end_sample

    return segments


def _load_physionet_segmentation(
    recording_id: str,
    annotation_dir: str | Path,
) -> list[tuple[str, float, float]]:
    """
    Internal loader for PhysioNet 2016 recordings.

    Parameters
    ----------
    recording_id   : e.g. "physionet_a0001"
    annotation_dir : root of the raw data tree (e.g. "data/raw")

    Returns
    -------
    List of (state_label, start_sec, end_sec) or [] if no annotation found.
    """
    annotation_dir = Path(annotation_dir)
    _, base = _physionet_recording_parts(recording_id)
    subset_letter = base[0].lower()

    # ── Locate the TSV ──────────────────────────────────────────────────────
    tsv_path = _find_physionet_tsv(recording_id, annotation_dir)
    if tsv_path is None:
        return []

    # ── Get sample rate from companion .hea ─────────────────────────────────
    # hea files live in training-X/<base>.hea
    hea_candidates = [
        annotation_dir / "physionet2016" / f"training-{subset_letter}" / f"{base}.hea",
        tsv_path.parent / f"{base}.hea",
    ]
    fs = _PHYSIONET_DEFAULT_FS
    for hea_path in hea_candidates:
        if hea_path.is_file():
            fs = _parse_hea_sample_rate(hea_path)
            break

    return _parse_physionet_tsv(tsv_path, fs)


# ── Helpers: PASCAL ───────────────────────────────────────────────────────────

# Map from PASCAL set identifiers to their seg CSV paths (relative to annotation_dir)
_PASCAL_SEG_CSV: dict[str, str] = {
    "a": "pascal/setA/Atraining_normal_seg.csv",
    "b": "pascal/setB/Btraining_normal_seg.csv",
}


def _get_pascal_wav_sample_rate(wav_path: Path) -> int:
    """
    Read the sample rate from a WAV file header without loading audio data.
    Returns _PASCAL_DEFAULT_FS on any error.
    """
    try:
        import wave
        with wave.open(str(wav_path), "rb") as wf:
            return wf.getframerate()
    except Exception:
        return _PASCAL_DEFAULT_FS


def _build_pascal_index(
    annotation_dir: Path,
    set_key: str,
) -> dict[str, list[int]]:
    """
    Parse a PASCAL segmentation CSV and return a dict mapping
    filename stem → sorted list of S1/S2 event sample indices.

    The PASCAL seg CSV has one row per recording, with the filename as the
    first column and then alternating S1, S2 sample indices:

        filename, S1_1, S2_1, S1_2, S2_2, ...

    A header row is detected and skipped automatically.
    """
    csv_rel = _PASCAL_SEG_CSV.get(set_key)
    if csv_rel is None:
        return {}

    csv_path = annotation_dir / csv_rel
    if not csv_path.is_file():
        return {}

    index: dict[str, list[int]] = {}

    with open(csv_path, newline="", encoding="utf-8", errors="replace") as fh:
        reader = csv.reader(fh)
        for row in reader:
            if not row:
                continue
            # Strip whitespace from every cell
            row = [c.strip() for c in row]
            filename_col = row[0]
            if not filename_col:
                continue
            # Skip header row: first cell has no digits (e.g. "filename", "recording")
            if not re.search(r"\d", filename_col):
                continue
            # Extract stem (strip extension if present)
            stem = Path(filename_col).stem

            # Remaining columns are sample indices; collect only valid integers
            samples: list[int] = []
            for cell in row[1:]:
                cell = cell.strip()
                if not cell:
                    continue
                try:
                    val = int(float(cell))
                    if val > 0:   # skip zero/negative padding
                        samples.append(val)
                except ValueError:
                    pass  # ignore non-numeric cells (header event labels etc.)

            if samples:
                index[stem] = sorted(samples)

    return index


def _pascal_samples_to_segments(
    samples: list[int],
    fs: int,
) -> list[tuple[str, float, float]]:
    """
    Convert a sorted list of S1/S2 event sample indices (alternating S1, S2)
    into a list of (state_label, start_sec, end_sec) segments.

    Cardiac-cycle model applied
    ---------------------------
    Given events: S1_0, S2_0, S1_1, S2_1, ...

        S1_i  → starts at S1_i,  ends at S2_i       (S1 event)
        systole  between S1_i end and S2_i start     → squeezed into zero here
                                                       since the CSV only gives
                                                       S1/S2 timestamps, not
                                                       full cycle annotations.
                                                       We model:
                                                         S1 window = S1_i → halfway to S2_i
                                                         systole   = halfway → S2_i
                                                         S2 window = S2_i → halfway to S1_{i+1}
                                                         diastole  = halfway to S1_{i+1}

    If an expected pairing partner is missing (e.g. trailing S1 with no S2),
    we assign a fixed half-width window around the event.
    """
    segments: list[tuple[str, float, float]] = []

    def to_sec(sample: int) -> float:
        return sample / fs

    # Separate into S1-indexed (even positions) and S2-indexed (odd positions)
    s1_samples = [samples[i] for i in range(0, len(samples), 2)]
    s2_samples = [samples[i] for i in range(1, len(samples), 2)]

    n_pairs = min(len(s1_samples), len(s2_samples))

    for i in range(n_pairs):
        s1 = s1_samples[i]
        s2 = s2_samples[i]

        # ── S1 window ──────────────────────────────────────────────────────
        s1_end = s1 + (s2 - s1) // 2   # halfway between S1 and S2
        segments.append(("S1", round(to_sec(s1), 6), round(to_sec(s1_end), 6)))

        # ── Systole: from S1 half-point to S2 ─────────────────────────────
        segments.append(("systole", round(to_sec(s1_end), 6), round(to_sec(s2), 6)))

        # ── S2 window and diastole ─────────────────────────────────────────
        if i + 1 < len(s1_samples):
            next_s1 = s1_samples[i + 1]
            s2_end = s2 + (next_s1 - s2) // 2
            segments.append(("S2", round(to_sec(s2), 6), round(to_sec(s2_end), 6)))
            segments.append(("diastole", round(to_sec(s2_end), 6), round(to_sec(next_s1), 6)))
        else:
            # No next S1 — assign a fixed-width window
            s2_end_sec = to_sec(s2) + _PASCAL_FALLBACK_HALF_WIDTH
            segments.append(("S2", round(to_sec(s2), 6), round(s2_end_sec, 6)))
            # No diastole segment (end of recording)

    # Handle trailing S1 with no matching S2
    if len(s1_samples) > n_pairs:
        s1 = s1_samples[n_pairs]
        s1_end_sec = to_sec(s1) + _PASCAL_FALLBACK_HALF_WIDTH
        segments.append(("S1", round(to_sec(s1), 6), round(s1_end_sec, 6)))

    return segments


def _pascal_set_key_and_stem(recording_id: str) -> tuple[str, str]:
    """
    Derive the PASCAL set key ('a' or 'b') and the WAV filename stem from a
    recording_id.

    The actual ID format produced by Ankit's preprocessing is:
        "pascal_setA_<category>_<wav_stem>"
    e.g.
        "pascal_setA_normal_anormal_01"      → ('a', 'anormal_01')
        "pascal_setA_artifact_aartifact_02"  → ('a', 'aartifact_02')
        "pascal_setB_normal_bnormal_03"      → ('b', 'bnormal_03')
        "pascal_setB_normal_bnoisynormal_01" → ('b', 'bnoisynormal_01')

    Strategy:
      - Strip the leading "pascal_" prefix.
      - Detect set key from "setA" / "setB" token.
      - The WAV stem is identified as the last two underscore-separated tokens
        joined (e.g. 'anormal' + '_' + '01' = 'anormal_01').
    """
    tail = recording_id[len("pascal_"):]   # e.g. "setA_normal_anormal_01"
    lower = tail.lower()

    if lower.startswith("seta"):
        set_key = "a"
        rest = re.sub(r"^set[aA][_\-]", "", tail)   # "normal_anormal_01"
    elif lower.startswith("setb"):
        set_key = "b"
        rest = re.sub(r"^set[bB][_\-]", "", tail)   # "normal_bnormal_01"
    elif lower.startswith("a_") or lower.startswith("a-"):
        set_key = "a"
        rest = tail[2:]
    elif lower.startswith("b_") or lower.startswith("b-"):
        set_key = "b"
        rest = tail[2:]
    else:
        return "", tail

    # rest is: "<category>_<wav_stem>"  e.g. "normal_anormal_01"
    # The wav_stem is everything AFTER the first token (category word).
    # Category words are single tokens like: normal, murmur, artifact,
    # extrasystole, extrahs  — they never contain digits.
    parts = rest.split("_", 1)
    if len(parts) == 2 and not re.search(r"\d", parts[0]):
        stem = parts[1]   # e.g. "anormal_01"
    else:
        stem = rest       # fallback: use the whole thing

    return set_key, stem


def _load_pascal_segmentation(
    recording_id: str,
    annotation_dir: str | Path,
) -> list[tuple[str, float, float]]:
    """
    Internal loader for PASCAL heart-sound recordings.

    Only 'normal'-labelled recordings have segmentation data in the seg CSVs.
    All other PASCAL recordings return [].

    Parameters
    ----------
    recording_id   : e.g. "pascal_setA_normal_anormal_01"
    annotation_dir : root of the raw data tree (e.g. "data/raw")
    """
    annotation_dir = Path(annotation_dir)
    set_key, stem = _pascal_set_key_and_stem(recording_id)

    if not set_key:
        return []  # Cannot identify which set — graceful degradation

    # Only 'normal' recordings appear in the seg CSV
    # (stem from a non-normal recording won't be found in the index → returns [])
    index = _build_pascal_index(annotation_dir, set_key)
    samples = index.get(stem)

    if not samples:
        return []

    # Try to read sample rate from the actual .wav file.
    # WAVs live inside category subdirectories, so we do a recursive search.
    set_dir = annotation_dir / f"pascal/set{set_key.upper()}"
    fs = _PASCAL_DEFAULT_FS
    if set_dir.is_dir():
        # Search all subdirectories for stem.wav
        for wav_path in set_dir.rglob(f"{stem}.wav"):
            fs = _get_pascal_wav_sample_rate(wav_path)
            break
        else:
            # Also try .aif / .aiff
            for ext in (".aif", ".aiff"):
                for wav_path in set_dir.rglob(f"{stem}{ext}"):
                    fs = _get_pascal_wav_sample_rate(wav_path)
                    break

    return _pascal_samples_to_segments(samples, fs)


# ── Public API ────────────────────────────────────────────────────────────────

def load_segmentation(
    recording_id: str,
    annotation_dir: str,
) -> list[tuple[str, float, float]]:
    """
    Loads S1/S2/systole/diastole state boundaries for a given recording.

    Parameters
    ----------
    recording_id  : matches the 'id' column in metadata.csv
                    e.g. "physionet_a0001" or "pascal_setA_Atraining_normal_0001"
    annotation_dir: folder containing the raw annotation files
                    (e.g. "data/raw" — the function navigates subdirectories)

    Returns
    -------
    list of tuples (state_label, start_time_sec, end_time_sec)
    state_label is one of: "S1", "systole", "S2", "diastole"

    Example return value
    --------------------
    [("S1", 0.0, 0.12), ("systole", 0.12, 0.35), ("S2", 0.35, 0.45), ("diastole", 0.45, 0.9), ...]

    If no annotation is available for the recording, returns [].
    Every recording_id in metadata.csv will have a key in the JSON export,
    even if its value is an empty list.
    """
    rid = recording_id.strip()

    if rid.startswith("physionet_"):
        try:
            return _load_physionet_segmentation(rid, annotation_dir)
        except Exception as exc:
            warnings.warn(f"PhysioNet loader failed for {rid!r}: {exc}")
            return []

    elif rid.startswith("pascal_"):
        try:
            return _load_pascal_segmentation(rid, annotation_dir)
        except Exception as exc:
            warnings.warn(f"PASCAL loader failed for {rid!r}: {exc}")
            return []

    else:
        # Unknown dataset prefix — graceful degradation
        warnings.warn(f"Unknown dataset prefix in recording_id {rid!r}; returning []")
        return []


def export_all_segmentations(
    metadata_csv_path: str,
    annotation_dir: str,
    output_json_path: str = "data/processed/segmentations.json",
) -> str:
    """
    Runs load_segmentation() for every recording listed in metadata.csv,
    saves the results as a single JSON file.

    Output format
    -------------
    {
        "physionet_a0001": [["S1", 0.0, 0.12], ["systole", 0.12, 0.35], ...],
        "physionet_a0002": [...],
        ...
    }

    Parameters
    ----------
    metadata_csv_path : path to metadata.csv (must have an 'id' column)
    annotation_dir    : root data directory containing raw annotations
    output_json_path  : where to write the JSON output

    Returns
    -------
    output_json_path (the string passed in, for chaining)
    """
    # ── Load recording IDs from metadata.csv ─────────────────────────────────
    metadata_df = pd.read_csv(metadata_csv_path, dtype=str)

    if "id" not in metadata_df.columns:
        raise ValueError(
            f"metadata.csv at {metadata_csv_path!r} has no 'id' column. "
            f"Found columns: {list(metadata_df.columns)}"
        )

    recording_ids: list[str] = metadata_df["id"].dropna().str.strip().tolist()

    # ── Process each recording ────────────────────────────────────────────────
    results: dict[str, list] = {}
    total = len(recording_ids)

    for idx, rid in enumerate(recording_ids, start=1):
        if idx % 100 == 0 or idx == total:
            print(f"  [{idx}/{total}] Processing {rid} ...")

        segments = load_segmentation(rid, annotation_dir)
        # Store tuples as lists so they serialise cleanly to JSON arrays
        results[rid] = [list(seg) for seg in segments]

    # ── Write JSON ────────────────────────────────────────────────────────────
    output_path = Path(output_json_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, "w", encoding="utf-8") as fh:
        json.dump(results, fh, indent=2)

    n_with_data = sum(1 for v in results.values() if v)
    n_empty = total - n_with_data
    print(
        f"\nDone. Wrote {total} entries to {output_json_path!r}.\n"
        f"  {n_with_data} recordings with segmentation data\n"
        f"  {n_empty} recordings with no annotation (stored as [])"
    )

    return output_json_path


# ── Quick smoke-test (run this file directly) ─────────────────────────────────

if __name__ == "__main__":
    import sys

    if len(sys.argv) < 3:
        print(
            "Usage:\n"
            "  python s1s2_loader.py <annotation_dir> <recording_id> [recording_id ...]\n"
            "\n"
            "  e.g.  python s1s2_loader.py data/raw physionet_a0001 physionet_a0002\n"
            "\n"
            "Or for a full export:\n"
            "  python s1s2_loader.py <annotation_dir> --export <metadata_csv> [output_json]\n"
        )
        sys.exit(0)

    ann_dir = sys.argv[1]

    if sys.argv[2] == "--export":
        if len(sys.argv) < 4:
            print("Error: --export requires a metadata_csv path")
            sys.exit(1)
        meta_csv = sys.argv[3]
        out_json = sys.argv[4] if len(sys.argv) > 4 else "data/processed/segmentations.json"
        export_all_segmentations(meta_csv, ann_dir, out_json)
    else:
        for rid in sys.argv[2:]:
            segs = load_segmentation(rid, ann_dir)
            print(f"\n{rid}  ({len(segs)} segments)")
            for seg in segs[:10]:
                print(f"  {seg}")
            if len(segs) > 10:
                print(f"  ... ({len(segs) - 10} more)")
