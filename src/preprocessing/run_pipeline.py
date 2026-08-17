"""
EchoAssist - Preprocessing Pipeline Orchestrator

Processes raw heart-sound datasets (PhysioNet 2016 and PASCAL) through
denoising -> resampling -> metadata generation.

Usage
-----
    # Process PhysioNet only (push this first to unblock the team)
    python src/preprocessing/run_pipeline.py --physionet-only

    # Process PASCAL only and append to existing metadata.csv
    python src/preprocessing/run_pipeline.py --pascal-only

    # Process both sequentially
    python src/preprocessing/run_pipeline.py
"""

import argparse
import os
import sys
from pathlib import Path

import librosa
import pandas as pd

# ---------------------------------------------------------------------------
# Resolve project root so imports work regardless of cwd
# ---------------------------------------------------------------------------
PROJECT_ROOT = Path(__file__).resolve().parents[2]  # echoassist/
sys.path.insert(0, str(PROJECT_ROOT / "src"))

from preprocessing.denoise import denoise
from preprocessing.resample import resample_audio

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
RAW_PHYSIONET_DIR = PROJECT_ROOT / "data" / "raw" / "physionet2016"
RAW_PASCAL_DIR = PROJECT_ROOT / "data" / "raw" / "pascal"
PROCESSED_AUDIO_DIR = PROJECT_ROOT / "data" / "processed" / "audio"
METADATA_PATH = PROJECT_ROOT / "data" / "processed" / "metadata.csv"
TARGET_SR = 2000

METADATA_COLUMNS = ["id", "filepath", "label", "split", "duration_sec", "source_dataset"]

# PhysioNet label mapping
PHYSIONET_LABEL_MAP = {
    "normal": "normal",
    "abnormal": "murmur",      # default; overridden to extrasystole if subset differentiates
    "unsure": "artifact",
}

# PASCAL Set A folder -> canonical label
PASCAL_SETA_LABEL_MAP = {
    "Atraining_normal": "normal",
    "Atraining_murmur": "murmur",
    "Atraining_extrahs": "extrasystole",
    "Atraining_artifact": "artifact",
}

# PASCAL Set B folder -> canonical label
# Includes noisy sub-folders mapped to the same label as their parent
PASCAL_SETB_LABEL_MAP = {
    "Btraining_normal": "normal",
    "Btraining_noisynormal": "normal",
    "Btraining_murmur": "murmur",
    "Btraining_noisymurmur": "murmur",
    "Btraining_extrasystole": "extrasystole",
}

# Combined for convenience
PASCAL_LABEL_MAP = {**PASCAL_SETA_LABEL_MAP, **PASCAL_SETB_LABEL_MAP}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def ensure_dirs():
    """Create output directories if they don't exist."""
    PROCESSED_AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    METADATA_PATH.parent.mkdir(parents=True, exist_ok=True)


def assign_splits(df: pd.DataFrame, group_col: str = "group",
                  train_frac: float = 0.70, val_frac: float = 0.15) -> pd.DataFrame:
    """
    Assign train / val / test splits at the *group* level to avoid data
    leakage.  Groups are shuffled, then allocated greedily to the split
    whose current fraction is furthest below target.

    Parameters
    ----------
    df : DataFrame
        Must contain a ``group_col`` column identifying patient/recording
        groups.
    group_col : str
        Column name to group by.
    train_frac, val_frac : float
        Target fractions; test gets the remainder.

    Returns
    -------
    DataFrame with a ``split`` column added.
    """
    groups = df[group_col].unique().tolist()
    # Deterministic shuffle for reproducibility
    import hashlib
    groups.sort(key=lambda g: hashlib.md5(str(g).encode()).hexdigest())

    total = len(df)
    split_counts = {"train": 0, "val": 0, "test": 0}
    group_to_split = {}

    for g in groups:
        n = int((df[group_col] == g).sum())
        # Pick the split that is most under-target
        deficits = {
            "train": train_frac - split_counts["train"] / max(total, 1),
            "val": val_frac - split_counts["val"] / max(total, 1),
            "test": (1 - train_frac - val_frac) - split_counts["test"] / max(total, 1),
        }
        chosen = max(deficits, key=deficits.get)
        group_to_split[g] = chosen
        split_counts[chosen] += n

    df = df.copy()
    df["split"] = df[group_col].map(group_to_split)
    return df


def process_file(raw_path: str, output_id: str) -> dict:
    """
    Run a single file through denoise -> resample and return metadata fields.

    Returns None if the file cannot be processed (logs a warning).
    """
    out_path = str(PROCESSED_AUDIO_DIR / f"{output_id}.wav")
    # Use a temporary intermediate file for the denoised (pre-resample) audio
    denoised_tmp = str(PROCESSED_AUDIO_DIR / f"_tmp_{output_id}.wav")

    try:
        denoise(raw_path, denoised_tmp)
        resample_audio(denoised_tmp, out_path, target_sr=TARGET_SR)
    except Exception as exc:
        print(f"  [WARN] FAILED processing {raw_path}: {exc}")
        # Clean up temp file if it exists
        if os.path.exists(denoised_tmp):
            os.remove(denoised_tmp)
        return None
    finally:
        # Always clean up the temp intermediate
        if os.path.exists(denoised_tmp):
            os.remove(denoised_tmp)

    # Compute duration from the final processed file
    duration = round(librosa.get_duration(path=out_path), 2)

    # Use forward-slash relative path for cross-platform consistency
    rel_path = f"data/processed/audio/{output_id}.wav"

    return {
        "id": output_id,
        "filepath": rel_path,
        "duration_sec": duration,
    }


# ---------------------------------------------------------------------------
# PhysioNet 2016 Processing
# ---------------------------------------------------------------------------

def read_physionet_labels(physionet_dir: Path) -> dict:
    """
    Read REFERENCE.csv files from each PhysioNet subfolder (training-a to training-f)
    and return a dict mapping filename_stem -> canonical label.
    """
    labels = {}
    for subfolder in sorted(physionet_dir.iterdir()):
        if not subfolder.is_dir():
            continue
        ref_file = subfolder / "REFERENCE.csv"
        if not ref_file.exists():
            print(f"  [WARN] No REFERENCE.csv in {subfolder.name}, skipping.")
            continue

        # REFERENCE.csv format: filename_stem, label_int  (or filename_stem, label_str)
        # PhysioNet 2016 uses: filename,-1/0/1  where -1=normal, 1=abnormal
        # OR sometimes: filename,normal/abnormal
        # We handle both.
        with open(ref_file, "r") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                parts = line.split(",")
                if len(parts) < 2:
                    continue
                stem = parts[0].strip()
                raw_label = parts[1].strip().lower()

                # Handle numeric labels: -1 -> normal, 1 -> abnormal, 0 -> unsure
                if raw_label in ("-1", "1", "0"):
                    raw_label = {"-1": "normal", "1": "abnormal", "0": "unsure"}.get(raw_label, raw_label)

                canonical = PHYSIONET_LABEL_MAP.get(raw_label, raw_label)
                labels[stem] = canonical
    return labels


def process_physionet():
    """Process all PhysioNet 2016 files and create/overwrite metadata.csv."""
    print("=" * 60)
    print("PHASE 1 - Processing PhysioNet 2016")
    print("=" * 60)

    if not RAW_PHYSIONET_DIR.exists():
        print(f"ERROR: {RAW_PHYSIONET_DIR} does not exist.")
        print("Please download PhysioNet 2016 and place it there first.")
        sys.exit(1)

    labels = read_physionet_labels(RAW_PHYSIONET_DIR)
    if not labels:
        print("ERROR: No labels found. Check that REFERENCE.csv files exist in subfolders.")
        sys.exit(1)
    print(f"  Found {len(labels)} labels across PhysioNet subfolders.")

    rows = []
    processed = 0
    skipped = 0

    for subfolder in sorted(RAW_PHYSIONET_DIR.iterdir()):
        if not subfolder.is_dir():
            continue
        wav_files = sorted(subfolder.glob("*.wav"))
        print(f"  {subfolder.name}: {len(wav_files)} wav files")

        for wav_file in wav_files:
            stem = wav_file.stem
            if stem not in labels:
                print(f"    [WARN] No label for {stem}, skipping.")
                skipped += 1
                continue

            output_id = f"physionet_{stem}"
            label = labels[stem]

            result = process_file(str(wav_file), output_id)
            if result is None:
                skipped += 1
                continue

            result["label"] = label
            result["source_dataset"] = "physionet2016"
            # group = subfolder name (training-a, training-b, etc.)
            # used for split assignment
            result["group"] = subfolder.name
            rows.append(result)
            processed += 1

            if processed % 100 == 0:
                print(f"    Processed {processed} files...")

    print(f"  Done. Processed: {processed}, Skipped: {skipped}")

    if not rows:
        print("ERROR: No files were successfully processed.")
        sys.exit(1)

    # Build DataFrame and assign splits
    df = pd.DataFrame(rows)
    df = assign_splits(df, group_col="group")
    df = df[METADATA_COLUMNS]  # enforce exact column order

    # Write metadata
    df.to_csv(METADATA_PATH, index=False)
    print(f"\n  [OK] metadata.csv written with {len(df)} PhysioNet rows.")
    print(f"      Split distribution:\n{df['split'].value_counts().to_string()}")
    print(f"      Label distribution:\n{df['label'].value_counts().to_string()}")


# ---------------------------------------------------------------------------
# PASCAL Processing
# ---------------------------------------------------------------------------

def collect_pascal_files(pascal_dir: Path) -> list:
    """
    Walk the PASCAL directory structure and collect (wav_path, set_name,
    canonical_label, folder_name) tuples.
    """
    files = []

    for set_name, set_dir_name in [("setA", "setA"), ("setB", "setB")]:
        set_dir = pascal_dir / set_dir_name
        if not set_dir.exists():
            print(f"  [WARN] {set_dir} not found, skipping {set_name}.")
            continue

        for category_dir in sorted(set_dir.iterdir()):
            if not category_dir.is_dir():
                continue

            folder_name = category_dir.name
            # Skip unlabelled test data
            if "unlabelled" in folder_name.lower() or "unlabeled" in folder_name.lower():
                print(f"  [SKIP] Skipping unlabelled directory: {folder_name}")
                continue

            label = PASCAL_LABEL_MAP.get(folder_name)
            if label is None:
                # Check if this is a subdirectory inside a mapped folder
                # (e.g. Btraining_noisynormal inside Btraining_normal)
                # Try parent-based lookup isn't needed since we iterate
                # subdirs as well - but skip unknown folders
                print(f"  [WARN] Unknown PASCAL folder '{folder_name}', skipping.")
                continue

            # Collect .wav files in this folder AND any subdirectories
            wav_files = sorted(category_dir.rglob("*.wav"))
            print(f"    {set_name}/{folder_name}: {len(wav_files)} wav files -> label '{label}'")

            for wav_file in wav_files:
                files.append((str(wav_file), set_name, label, folder_name))

    return files


def process_pascal():
    """Process all PASCAL files and APPEND to existing metadata.csv."""
    print("\n" + "=" * 60)
    print("PHASE 2 - Processing PASCAL")
    print("=" * 60)

    if not RAW_PASCAL_DIR.exists():
        print(f"ERROR: {RAW_PASCAL_DIR} does not exist.")
        print("Please download PASCAL and place it there first.")
        sys.exit(1)

    pascal_files = collect_pascal_files(RAW_PASCAL_DIR)
    if not pascal_files:
        print("ERROR: No PASCAL wav files found.")
        sys.exit(1)

    print(f"  Total PASCAL files to process: {len(pascal_files)}")

    rows = []
    processed = 0
    skipped = 0

    for wav_path, set_name, label, folder_name in pascal_files:
        stem = Path(wav_path).stem
        output_id = f"pascal_{set_name}_{label}_{stem}"

        result = process_file(wav_path, output_id)
        if result is None:
            skipped += 1
            continue

        result["label"] = label
        result["source_dataset"] = "pascal"
        # Group by set + folder for split assignment
        result["group"] = f"{set_name}_{folder_name}"
        rows.append(result)
        processed += 1

        if processed % 50 == 0:
            print(f"    Processed {processed} files...")

    print(f"  Done. Processed: {processed}, Skipped: {skipped}")

    if not rows:
        print("ERROR: No PASCAL files were successfully processed.")
        sys.exit(1)

    # Build DataFrame and assign splits within PASCAL
    df_pascal = pd.DataFrame(rows)
    df_pascal = assign_splits(df_pascal, group_col="group")
    df_pascal = df_pascal[METADATA_COLUMNS]

    # Read existing metadata and APPEND (don't overwrite PhysioNet rows)
    if METADATA_PATH.exists():
        df_existing = pd.read_csv(METADATA_PATH)
        # Remove any previous PASCAL rows (in case of re-run) but keep PhysioNet
        df_existing = df_existing[df_existing["source_dataset"] != "pascal"]
        df_combined = pd.concat([df_existing, df_pascal], ignore_index=True)
        print(f"  Appending {len(df_pascal)} PASCAL rows to {len(df_existing)} existing rows.")
    else:
        df_combined = df_pascal
        print(f"  [WARN] No existing metadata.csv found - creating fresh with PASCAL only.")

    df_combined.to_csv(METADATA_PATH, index=False)
    print(f"\n  [OK] metadata.csv updated with {len(df_combined)} total rows.")
    print(f"      Dataset distribution:\n{df_combined.groupby(['source_dataset', 'label']).size().to_string()}")
    print(f"      Split distribution:\n{df_combined['split'].value_counts().to_string()}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="EchoAssist preprocessing pipeline - denoise, resample, build metadata.csv"
    )
    parser.add_argument(
        "--physionet-only", action="store_true",
        help="Process only PhysioNet 2016 (push this first to unblock team)"
    )
    parser.add_argument(
        "--pascal-only", action="store_true",
        help="Process only PASCAL and append to existing metadata.csv"
    )
    args = parser.parse_args()

    if args.physionet_only and args.pascal_only:
        print("ERROR: Cannot specify both --physionet-only and --pascal-only")
        sys.exit(1)

    ensure_dirs()

    if args.physionet_only:
        process_physionet()
    elif args.pascal_only:
        process_pascal()
    else:
        process_physionet()
        process_pascal()

    print("\n" + "=" * 60)
    print("Pipeline complete.")
    print("=" * 60)


if __name__ == "__main__":
    main()
