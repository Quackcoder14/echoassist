"""
test_segmentation.py
====================
Smoke-test script for s1s2_loader.py.

Run this AFTER downloading the raw data:
    python test_segmentation.py

It validates:
1. load_segmentation() works on a handful of known recording IDs
2. Timestamps are monotonically increasing
3. State labels are exactly the required strings
4. export_all_segmentations() runs end-to-end
5. Every ID from metadata.csv has a key in segmentations.json
"""

import json
import sys
import warnings
from pathlib import Path

# ── Insert project root on sys.path so imports work from any CWD ──────────────
ROOT = Path(__file__).parent
sys.path.insert(0, str(ROOT))

from src.segmentation.s1s2_loader import load_segmentation, export_all_segmentations

ANNOTATION_DIR = "data/raw"
METADATA_CSV   = "data/processed/metadata.csv"
OUTPUT_JSON    = "data/processed/segmentations.json"

VALID_LABELS = {"S1", "systole", "S2", "diastole"}

# A small set of recording IDs to spot-check individually.
# Edit these once you know which IDs are in your metadata.csv.
SPOT_CHECK_IDS = [
    "physionet_a0001",
    "physionet_a0002",
    "physionet_b0001",
    "physionet_e0001",
]


def check_monotonic(segments, recording_id):
    """Assert that start/end times are monotonically non-decreasing."""
    for i, (label, start, end) in enumerate(segments):
        assert end >= start, (
            f"{recording_id} segment {i} ({label}): end {end} < start {start}"
        )
        if i > 0:
            prev_end = segments[i - 1][2]
            assert start >= prev_end - 1e-6, (
                f"{recording_id} segment {i} ({label}): start {start} < prev end {prev_end}"
            )


def check_labels(segments, recording_id):
    """Assert that all state labels are in the approved set."""
    for label, start, end in segments:
        assert label in VALID_LABELS, (
            f"{recording_id}: unexpected label {label!r} (must be one of {VALID_LABELS})"
        )


# ── Test 1: spot-check individual recordings ──────────────────────────────────
print("=" * 60)
print("Test 1 — load_segmentation() spot checks")
print("=" * 60)

passed = 0
failed = 0

for rid in SPOT_CHECK_IDS:
    with warnings.catch_warnings(record=True) as w:
        warnings.simplefilter("always")
        segs = load_segmentation(rid, ANNOTATION_DIR)

    if w:
        for warning in w:
            print(f"  [WARN] {rid}: {warning.message}")

    if segs:
        try:
            check_monotonic(segs, rid)
            check_labels(segs, rid)
            print(f"  [PASS] {rid}: {len(segs)} segments  "
                  f"({segs[0][1]:.3f}s → {segs[-1][2]:.3f}s)")
            # Print first 4 segments as a sanity preview
            for seg in segs[:4]:
                print(f"         {seg}")
            passed += 1
        except AssertionError as e:
            print(f"  [FAIL] {rid}: {e}")
            failed += 1
    else:
        print(f"  [SKIP] {rid}: no annotation found (returned [])")

print(f"\nSpot-check result: {passed} passed, {failed} failed, "
      f"{len(SPOT_CHECK_IDS) - passed - failed} skipped (no data)\n")


# ── Test 2: full export ───────────────────────────────────────────────────────
if not Path(METADATA_CSV).is_file():
    print(f"[SKIP] Test 2 — {METADATA_CSV!r} not found (pull Ankit's branch)")
    sys.exit(0)

print("=" * 60)
print("Test 2 — export_all_segmentations()")
print("=" * 60)

export_all_segmentations(
    metadata_csv_path=METADATA_CSV,
    annotation_dir=ANNOTATION_DIR,
    output_json_path=OUTPUT_JSON,
)


# ── Test 3: validate JSON coverage and schema ─────────────────────────────────
print("\n" + "=" * 60)
print("Test 3 — JSON coverage and schema validation")
print("=" * 60)

import pandas as pd

meta_ids = pd.read_csv(METADATA_CSV, dtype=str)["id"].dropna().str.strip().tolist()

with open(OUTPUT_JSON, encoding="utf-8") as fh:
    seg_data = json.load(fh)

# Every ID must have a key
missing_keys = [rid for rid in meta_ids if rid not in seg_data]
if missing_keys:
    print(f"[FAIL] {len(missing_keys)} IDs from metadata.csv missing from JSON:")
    for rid in missing_keys[:10]:
        print(f"       {rid}")
    if len(missing_keys) > 10:
        print(f"       ... and {len(missing_keys) - 10} more")
else:
    print(f"[PASS] All {len(meta_ids)} IDs present in segmentations.json")

# Extra keys in JSON that aren't in metadata (warn but don't fail)
extra_keys = [rid for rid in seg_data if rid not in set(meta_ids)]
if extra_keys:
    print(f"[WARN] {len(extra_keys)} extra keys in JSON not in metadata.csv (harmless)")

# Check schema and label validity for non-empty entries
schema_errors = 0
for rid, segs in seg_data.items():
    if not isinstance(segs, list):
        print(f"[FAIL] {rid}: value is not a list")
        schema_errors += 1
        continue
    for seg in segs:
        if not (isinstance(seg, list) and len(seg) == 3):
            print(f"[FAIL] {rid}: segment {seg!r} is not a 3-element list")
            schema_errors += 1
            break
        label, start, end = seg
        if label not in VALID_LABELS:
            print(f"[FAIL] {rid}: invalid label {label!r}")
            schema_errors += 1
            break

if schema_errors == 0:
    print(f"[PASS] Schema valid for all {len(seg_data)} entries")
else:
    print(f"[FAIL] {schema_errors} schema errors found")

# Summary stats
n_with_data = sum(1 for v in seg_data.values() if v)
print(f"\nSummary: {n_with_data}/{len(seg_data)} recordings have segmentation data")
