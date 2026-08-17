"""
src/preprocessing/build_unified_dataset.py
-------------------------------------------
Tri-Dataset Unified Preprocessing Pipeline
Ingests PASCAL Challenge, PhysioNet 2016, and CirCor DigiScope 2022,
standardises to 2000 Hz 16-bit mono, bandpass filters (25–400 Hz),
performs patient-level stratified splits, and writes metadata.csv.

Usage:
    python -m src.preprocessing.build_unified_dataset
    python -m src.preprocessing.build_unified_dataset --circor-only
    python -m src.preprocessing.build_unified_dataset --dry-run
"""

import argparse
import hashlib
import os
import sys
from pathlib import Path

import librosa
import numpy as np
import pandas as pd
import soundfile as sf
from scipy.signal import butter, sosfilt

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
PROJECT_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PROJECT_ROOT / "src"))

PHYSIONET_DIR   = PROJECT_ROOT / "training data" / "training"
PASCAL_DIR      = PROJECT_ROOT / "training data" / "archive"
CIRCOR_DIR      = PROJECT_ROOT / "training data" / "archive (1)" / "training_data" / "training_data"
CIRCOR_CSV      = PROJECT_ROOT / "training data" / "archive (1)" / "training_data.csv"

PROCESSED_AUDIO_DIR = PROJECT_ROOT / "data" / "processed" / "audio"
METADATA_PATH       = PROJECT_ROOT / "data" / "processed" / "metadata.csv"
METADATA_COLUMNS = ["id", "filepath", "label", "split", "duration_sec", "source_dataset", "patient_id"]

TARGET_SR = 2000
DURATION_SEC = 5.0

# ---------------------------------------------------------------------------
# Label harmonisation maps
# ---------------------------------------------------------------------------
PHYSIONET_LABEL_MAP = {"1": "normal", "-1": "murmur", "0": "artifact"}

PASCAL_SETA_LABEL_MAP = {
    "Atraining_normal":    "normal",
    "Atraining_murmur":    "murmur",
    "Atraining_extrahs":   "extrasystole",
    "Atraining_artifact":  "artifact",
}
PASCAL_SETB_LABEL_MAP = {
    "Btraining_normal":         "normal",
    "Btraining_noisynormal":    "normal",
    "Btraining_murmur":         "murmur",
    "Btraining_noisymurmur":    "murmur",
    "Btraining_extrasystole":   "extrasystole",
}
PASCAL_LABEL_MAP = {**PASCAL_SETA_LABEL_MAP, **PASCAL_SETB_LABEL_MAP}

# CirCor Murmur field -> canonical label
CIRCOR_LABEL_MAP = {
    "Present": "murmur",
    "Absent":  "normal",
    "Unknown": None,  # Dropped — ambiguous
}


# ---------------------------------------------------------------------------
# DSP utilities
# ---------------------------------------------------------------------------

def bandpass_filter(audio: np.ndarray, sr: int, lo: float = 25.0, hi: float = 400.0) -> np.ndarray:
    """2nd-order Butterworth bandpass filter (25–400 Hz)."""
    nyq = sr / 2.0
    lo_norm = lo / nyq
    hi_norm = min(hi / nyq, 0.99)
    sos = butter(2, [lo_norm, hi_norm], btype="bandpass", output="sos")
    return sosfilt(sos, audio).astype(np.float32)


def peak_rms_normalize(audio: np.ndarray, target_rms: float = 0.05) -> np.ndarray:
    """Normalize audio to target RMS energy."""
    rms = np.sqrt(np.mean(audio ** 2)) + 1e-9
    return audio * (target_rms / rms)


def pad_or_truncate(audio: np.ndarray, target_samples: int) -> np.ndarray:
    if len(audio) >= target_samples:
        return audio[:target_samples]
    return np.pad(audio, (0, target_samples - len(audio)), mode="constant")


def process_audio_file(raw_path: str, output_id: str, dry_run: bool = False) -> dict | None:
    """Load -> bandpass -> normalize -> resample -> save. Returns metadata dict."""
    out_path = PROCESSED_AUDIO_DIR / f"{output_id}.wav"

    if not dry_run:
        try:
            audio, sr_orig = librosa.load(str(raw_path), sr=None, mono=True)
            # Resample to 2000 Hz
            if sr_orig != TARGET_SR:
                audio = librosa.resample(audio, orig_sr=sr_orig, target_sr=TARGET_SR)
            # Bandpass filter
            audio = bandpass_filter(audio, TARGET_SR)
            # Normalize
            audio = peak_rms_normalize(audio)
            # Pad/truncate
            target_samples = int(TARGET_SR * DURATION_SEC)
            audio = pad_or_truncate(audio, target_samples)
            # Write
            sf.write(str(out_path), audio, TARGET_SR, subtype="PCM_16")
        except Exception as exc:
            print(f"  [WARN] Failed {raw_path}: {exc}")
            return None

    duration = DURATION_SEC
    return {
        "id": output_id,
        "filepath": f"data/processed/audio/{output_id}.wav",
        "duration_sec": round(duration, 2),
    }


# ---------------------------------------------------------------------------
# Patient-level split (CirCor) / record-level split (PhysioNet, PASCAL)
# ---------------------------------------------------------------------------

def assign_split_by_patient(patient_id: str, train_frac=0.70, val_frac=0.15) -> str:
    """Hash patient ID -> deterministic 70/15/15 split."""
    val = int(hashlib.md5(str(patient_id).encode()).hexdigest(), 16) % 100
    if val < int(train_frac * 100):
        return "train"
    elif val < int((train_frac + val_frac) * 100):
        return "val"
    return "test"


def assign_split_by_id(record_id: str, train_frac=0.70, val_frac=0.15) -> str:
    val = int(hashlib.md5(str(record_id).encode()).hexdigest(), 16) % 100
    if val < int(train_frac * 100):
        return "train"
    elif val < int((train_frac + val_frac) * 100):
        return "val"
    return "test"


# ---------------------------------------------------------------------------
# PhysioNet 2016
# ---------------------------------------------------------------------------

def process_physionet(dry_run=False):
    print("\n" + "=" * 60)
    print("PHASE 1 — PhysioNet/CinC 2016")
    print("=" * 60)

    rows = []
    processed = skipped = 0

    for subset in sorted(PHYSIONET_DIR.iterdir()):
        if not subset.is_dir():
            continue
        ref_file = subset / "REFERENCE.csv"
        if not ref_file.exists():
            print(f"  [SKIP] No REFERENCE.csv in {subset.name}")
            continue

        ref_df = pd.read_csv(ref_file, header=None, names=["stem", "label_raw"])
        label_map = {
            str(row.stem): PHYSIONET_LABEL_MAP.get(str(row.label_raw).strip(), None)
            for _, row in ref_df.iterrows()
        }

        wav_files = sorted(subset.glob("*.wav"))
        print(f"  {subset.name}: {len(wav_files)} WAVs")

        for wav in wav_files:
            stem = wav.stem
            label = label_map.get(stem)
            if label is None:
                skipped += 1
                continue

            output_id = f"physionet_{subset.name}_{stem}"
            result = process_audio_file(str(wav), output_id, dry_run)
            if result is None:
                skipped += 1
                continue

            result["label"] = label
            result["source_dataset"] = "physionet2016"
            result["patient_id"] = f"pn_{stem}"  # each recording treated as independent patient
            result["split"] = assign_split_by_id(output_id)
            rows.append(result)
            processed += 1

            if processed % 200 == 0:
                print(f"    ... processed {processed} files")

    print(f"  Done: {processed} processed, {skipped} skipped.")
    return rows


# ---------------------------------------------------------------------------
# PASCAL Challenge
# ---------------------------------------------------------------------------

def process_pascal(dry_run=False):
    print("\n" + "=" * 60)
    print("PHASE 2 — PASCAL Heart Sound Challenge")
    print("=" * 60)

    rows = []
    processed = skipped = 0

    for set_name, csv_name in [("set_a", "set_a.csv"), ("set_b", "set_b.csv")]:
        set_dir = PASCAL_DIR / set_name
        csv_path = PASCAL_DIR / csv_name

        if not set_dir.exists():
            print(f"  [SKIP] {set_dir} not found")
            continue
        if not csv_path.exists():
            print(f"  [SKIP] {csv_path} not found")
            continue

        df = pd.read_csv(csv_path)
        # Normalise label column (may be 'label' or vary)
        df.columns = [c.lower().strip() for c in df.columns]

        # Build stem->label mapping (drop NaN labels)
        PASCAL_RAW_MAP = {
            "normal":       "normal",
            "murmur":       "murmur",
            "extrastole":   "extrasystole",
            "extrahls":     "extrasystole",
            "artifact":     "artifact",
        }
        stem_label = {}
        for _, row in df.iterrows():
            fname = str(row.get("fname", "")).strip()
            raw   = str(row.get("label", "")).strip().lower()
            if fname and raw and raw != "nan":
                label = PASCAL_RAW_MAP.get(raw, raw)
                # fname might include path or extension
                stem = Path(fname).stem if "." in fname else fname
                stem_label[stem] = label

        wavs = sorted(set_dir.glob("*.wav"))
        print(f"  {set_name}: {len(wavs)} WAVs, {len(stem_label)} labeled in CSV")

        for wav in wavs:
            stem  = wav.stem
            label = stem_label.get(stem)
            if label is None:
                skipped += 1
                continue

            output_id = f"pascal_{set_name}_{stem}"
            result = process_audio_file(str(wav), output_id, dry_run)
            if result is None:
                skipped += 1
                continue

            result["label"] = label
            result["source_dataset"] = "pascal"
            result["patient_id"] = f"pascal_{stem}"
            result["split"] = assign_split_by_id(output_id)
            rows.append(result)
            processed += 1

    print(f"  Done: {processed} processed, {skipped} skipped.")
    return rows



# ---------------------------------------------------------------------------
# CirCor DigiScope 2022
# ---------------------------------------------------------------------------

def process_circor(dry_run=False):
    print("\n" + "=" * 60)
    print("PHASE 3 — CirCor DigiScope 2022")
    print("=" * 60)

    if not CIRCOR_CSV.exists():
        print(f"  [ERROR] Missing {CIRCOR_CSV}")
        return []

    meta_df = pd.read_csv(CIRCOR_CSV)
    # Build patient_id -> label map
    patient_label = {}
    for _, row in meta_df.iterrows():
        pid = str(int(row["Patient ID"]))
        raw_label = str(row.get("Murmur", "Unknown")).strip()
        label = CIRCOR_LABEL_MAP.get(raw_label, None)
        if label is not None:
            patient_label[pid] = label

    print(f"  Patients with definitive labels: {len(patient_label)}")
    print(f"  Label distribution: { {v: list(patient_label.values()).count(v) for v in set(patient_label.values())} }")

    rows = []
    processed = skipped = 0

    wav_files = sorted(CIRCOR_DIR.glob("*.wav"))
    print(f"  Total WAV files: {len(wav_files)}")

    for wav in wav_files:
        stem = wav.stem  # e.g. "13918_AV"
        patient_id = stem.split("_")[0]

        label = patient_label.get(patient_id)
        if label is None:
            skipped += 1
            continue

        output_id = f"circor_{stem}"
        result = process_audio_file(str(wav), output_id, dry_run)
        if result is None:
            skipped += 1
            continue

        result["label"] = label
        result["source_dataset"] = "circor2022"
        result["patient_id"] = patient_id  # True patient ID for stratified splitting
        result["split"] = assign_split_by_patient(patient_id)  # Patient-level split!
        rows.append(result)
        processed += 1

        if processed % 300 == 0:
            print(f"    ... processed {processed} files")

    print(f"  Done: {processed} processed, {skipped} skipped (Unknown/missing label).")
    return rows


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="EchoAssist Tri-Dataset Builder")
    parser.add_argument("--physionet-only", action="store_true")
    parser.add_argument("--pascal-only",    action="store_true")
    parser.add_argument("--circor-only",    action="store_true")
    parser.add_argument("--dry-run",        action="store_true",
                        help="Scan datasets and report stats only; don't process audio.")
    args = parser.parse_args()

    if not args.dry_run:
        PROCESSED_AUDIO_DIR.mkdir(parents=True, exist_ok=True)
        METADATA_PATH.parent.mkdir(parents=True, exist_ok=True)

    all_rows = []

    if not any([args.pascal_only, args.circor_only]):
        all_rows += process_physionet(args.dry_run)

    if not any([args.physionet_only, args.circor_only]):
        all_rows += process_pascal(args.dry_run)

    if not any([args.physionet_only, args.pascal_only]):
        all_rows += process_circor(args.dry_run)

    if not all_rows:
        print("\n[ERROR] No files processed. Check dataset directories.")
        sys.exit(1)

    df = pd.DataFrame(all_rows)
    df = df[METADATA_COLUMNS]

    print("\n" + "=" * 60)
    print("UNIFIED DATASET SUMMARY")
    print("=" * 60)
    print(f"\nTotal recordings: {len(df)}")
    print(f"\nBy source dataset:\n{df.groupby('source_dataset')['label'].value_counts().to_string()}")
    print(f"\nBy split:\n{df['split'].value_counts().to_string()}")
    print(f"\nBy label:\n{df['label'].value_counts().to_string()}")

    if not args.dry_run:
        df.to_csv(METADATA_PATH, index=False)
        print(f"\n[OK] metadata.csv written -> {METADATA_PATH}")
    else:
        print("\n[DRY RUN] No files written. Pass without --dry-run to process.")


if __name__ == "__main__":
    main()
