"""
EchoAssist — Mock Dataset Generator

Creates tiny synthetic .wav files mimicking the exact folder structure
of PhysioNet 2016 and PASCAL so the pipeline can be tested end-to-end.

To remove: delete data/raw/physionet2016/ and data/raw/pascal/ then
replace with the real datasets. No code changes required.

Usage:
    python scripts/create_mock_data.py
"""

import os
import numpy as np
import soundfile as sf

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def make_sine_wav(path: str, sr: int = 4000, duration: float = 3.0, freq: float = 40.0):
    """Generate a short sine-wave .wav file (simulates a heart sound)."""
    t = np.linspace(0, duration, int(sr * duration), endpoint=False)
    # Simple sine with a bit of noise to give noisereduce something to work on
    y = 0.5 * np.sin(2 * np.pi * freq * t) + 0.05 * np.random.randn(len(t))
    os.makedirs(os.path.dirname(path), exist_ok=True)
    sf.write(path, y, sr)


def create_physionet_mock():
    """
    Create mock PhysioNet 2016 structure:
      data/raw/physionet2016/
        training-a/  (REFERENCE.csv + wav files)
        training-b/
        training-c/
        training-e/
    """
    base = os.path.join(PROJECT_ROOT, "data", "raw", "physionet2016")
    print("Creating mock PhysioNet 2016 data...")

    subsets = {
        "training-a": [
            ("a0001", "normal"),
            ("a0002", "normal"),
            ("a0003", "abnormal"),
            ("a0004", "abnormal"),
            ("a0005", "normal"),
        ],
        "training-b": [
            ("b0001", "normal"),
            ("b0002", "abnormal"),
            ("b0003", "normal"),
            ("b0004", "abnormal"),
            ("b0005", "unsure"),
        ],
        "training-c": [
            ("c0001", "normal"),
            ("c0002", "normal"),
            ("c0003", "abnormal"),
            ("c0004", "normal"),
        ],
        "training-e": [
            ("e0001", "normal"),
            ("e0002", "abnormal"),
            ("e0003", "normal"),
            ("e0004", "abnormal"),
            ("e0005", "normal"),
            ("e0006", "abnormal"),
        ],
    }

    for subset_name, files in subsets.items():
        subset_dir = os.path.join(base, subset_name)
        os.makedirs(subset_dir, exist_ok=True)

        # Write REFERENCE.csv
        ref_path = os.path.join(subset_dir, "REFERENCE.csv")
        with open(ref_path, "w") as f:
            for stem, label in files:
                f.write(f"{stem},{label}\n")

        # Write mock .wav files (vary duration slightly for realism)
        for i, (stem, label) in enumerate(files):
            wav_path = os.path.join(subset_dir, f"{stem}.wav")
            duration = 3.0 + i * 0.5  # 3.0s, 3.5s, 4.0s, ...
            freq = 40.0 if label == "normal" else 80.0
            make_sine_wav(wav_path, sr=2000, duration=duration, freq=freq)

        print(f"  {subset_name}: {len(files)} files + REFERENCE.csv")

    total = sum(len(f) for f in subsets.values())
    print(f"  Total PhysioNet mock files: {total}")


def create_pascal_mock():
    """
    Create mock PASCAL structure:
      data/raw/pascal/
        setA/
          Atraining_normal/       (wav files)
          Atraining_murmur/
          Atraining_extrahs/
          Atraining_artifact/
        setB/
          Btraining_normal/       (wav files, includes Btraining_noisynormal subdir)
          Btraining_murmur/       (wav files, includes Btraining_noisymurmur subdir)
          Btraining_extrasystole/
    """
    base = os.path.join(PROJECT_ROOT, "data", "raw", "pascal")
    print("\nCreating mock PASCAL data...")

    # Set A — native SR ~44100 Hz (we use 8000 to keep files small but still above 2000)
    set_a_sr = 8000
    set_a_categories = {
        "Atraining_normal": ["anormal_01", "anormal_02", "anormal_03", "anormal_04"],
        "Atraining_murmur": ["amurmur_01", "amurmur_02", "amurmur_03"],
        "Atraining_extrahs": ["aextrahs_01", "aextrahs_02"],
        "Atraining_artifact": ["aartifact_01", "aartifact_02", "aartifact_03"],
    }

    for folder_name, files in set_a_categories.items():
        folder_dir = os.path.join(base, "setA", folder_name)
        os.makedirs(folder_dir, exist_ok=True)
        for i, stem in enumerate(files):
            wav_path = os.path.join(folder_dir, f"{stem}.wav")
            make_sine_wav(wav_path, sr=set_a_sr, duration=2.5 + i * 0.3)
        print(f"  setA/{folder_name}: {len(files)} files")

    # Set B — native SR ~44100 Hz (using 8000 for mock)
    set_b_sr = 8000
    set_b_categories = {
        # Btraining_normal with a noisynormal subdirectory
        "Btraining_normal": {
            "root_files": ["bnormal_01", "bnormal_02", "bnormal_03", "bnormal_04", "bnormal_05"],
            "subdirs": {
                "Btraining_noisynormal": ["bnoisynormal_01", "bnoisynormal_02"],
            },
        },
        # Btraining_murmur with a noisymurmur subdirectory
        "Btraining_murmur": {
            "root_files": ["bmurmur_01", "bmurmur_02", "bmurmur_03"],
            "subdirs": {
                "Btraining_noisymurmur": ["bnoisymurmur_01", "bnoisymurmur_02"],
            },
        },
        # Btraining_extrasystole — flat, no subdirs
        "Btraining_extrasystole": {
            "root_files": ["bextrasystole_01", "bextrasystole_02"],
            "subdirs": {},
        },
    }

    for folder_name, spec in set_b_categories.items():
        folder_dir = os.path.join(base, "setB", folder_name)
        os.makedirs(folder_dir, exist_ok=True)

        # Root-level files
        for i, stem in enumerate(spec["root_files"]):
            wav_path = os.path.join(folder_dir, f"{stem}.wav")
            make_sine_wav(wav_path, sr=set_b_sr, duration=3.0 + i * 0.2)

        count = len(spec["root_files"])

        # Subdirectory files (e.g. Btraining_noisynormal inside Btraining_normal)
        for subdir_name, subdir_files in spec["subdirs"].items():
            subdir_path = os.path.join(folder_dir, subdir_name)
            os.makedirs(subdir_path, exist_ok=True)
            for i, stem in enumerate(subdir_files):
                wav_path = os.path.join(subdir_path, f"{stem}.wav")
                make_sine_wav(wav_path, sr=set_b_sr, duration=2.0 + i * 0.4)
            count += len(subdir_files)

        print(f"  setB/{folder_name}: {count} files (incl. subdirs)")

    set_a_total = sum(len(f) for f in set_a_categories.values())
    set_b_total = sum(
        len(s["root_files"]) + sum(len(sf) for sf in s["subdirs"].values())
        for s in set_b_categories.values()
    )
    print(f"  Total PASCAL mock files: {set_a_total + set_b_total} (Set A: {set_a_total}, Set B: {set_b_total})")


def main():
    print("=" * 60)
    print("EchoAssist — Mock Dataset Generator")
    print("=" * 60)
    print(f"Project root: {PROJECT_ROOT}\n")

    create_physionet_mock()
    create_pascal_mock()

    print("\n" + "=" * 60)
    print("Mock data created successfully.")
    print("To test the pipeline, run:")
    print("  python src/preprocessing/run_pipeline.py --physionet-only")
    print("  python src/preprocessing/run_pipeline.py --pascal-only")
    print("\nTo switch to real data later:")
    print("  1. Delete data/raw/physionet2016/ and data/raw/pascal/")
    print("  2. Place real datasets in the same paths")
    print("  3. Re-run the pipeline")
    print("=" * 60)


if __name__ == "__main__":
    main()
