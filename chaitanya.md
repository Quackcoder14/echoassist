# EchoAssist — Task Brief: CHAITANYA (Segmentation)

## Your role
Extract S1/S2 heart sound state boundaries (the "core acoustic markers" requirement from the problem statement). Good news: PhysioNet 2016 already provides reference segmentation annotations for most of its subsets — your job is mostly to **load and structure existing annotations**, not build a detector from scratch. This is intentionally scoped to be achievable in the time you have.

## Branch
```
git checkout -b segmentation
```
Always work on this branch. Never push to `main` directly.

## Files you own
```
src/segmentation/s1s2_loader.py
```

## Background
PhysioNet 2016's training subsets (particularly training-a, training-b, training-e) include state annotation files alongside the raw audio — these mark which parts of the recording are S1, systole, S2, and diastole. Check inside `data/raw/physionet2016/` for `.hea` files or accompanying annotation files (may be `.tsv`, `.mat`, or embedded in a states file — inspect a few example folders directly, format can vary slightly by subset. If you get stuck finding the annotation format, ask in the group chat immediately rather than guessing — this affects everyone downstream).

**Note on PASCAL:** Ankit is now also processing the PASCAL dataset into `metadata.csv` (`source_dataset = pascal`). PASCAL DOES provide partial segmentation data — but only for the `normal`-labeled recordings in each set, as separate CSV files:
- `data/raw/pascal/setA/Atraining_normal_seg.csv` — S1/S2 locations for `Atraining_normal` recordings only
- `data/raw/pascal/setB/Btraining_normal_seg.csv` — S1/S2 locations for `Btraining_normal` recordings only

Murmur/extrasystole/artifact PASCAL recordings have NO segmentation data — those still get an empty list `[]`, same as before.

**Before writing a parser for these CSVs, open them and check the actual column structure** — the site describes them only as "giving locations of S1 and S2 sounds," which could mean single timestamp points per S1/S2 event rather than full start-end interval pairs like PhysioNet's format. If it's just timestamps (not intervals), you'll need to decide how to represent them in the `(state_label, start_time, end_time)` tuple format — e.g. a short fixed-width window around each timestamp, or using the gap between consecutive S1/S2 timestamps to infer systole/diastole intervals. Post in the group chat with a few example rows from the CSV if the format is ambiguous, rather than guessing silently — this is a new format on top of PhysioNet's, worth confirming once rather than getting it wrong for both PASCAL sets.

Write a second loader function (or a conditional branch inside the same `load_segmentation()`, your call) specifically for this PASCAL CSV format — it doesn't need to share code with the PhysioNet loader, just needs to produce the same output shape.

## Task 1 — `src/segmentation/s1s2_loader.py`
```python
def load_segmentation(recording_id: str, annotation_dir: str) -> list[tuple[str, float, float]]:
    """
    Loads S1/S2/systole/diastole state boundaries for a given recording.
    recording_id: matches the 'id' column in metadata.csv (e.g. "physionet_a0001")
    annotation_dir: folder containing the raw annotation files
    Returns: list of tuples (state_label, start_time_sec, end_time_sec)
             state_label is one of: "S1", "systole", "S2", "diastole"
    Example return value:
    [("S1", 0.0, 0.12), ("systole", 0.12, 0.35), ("S2", 0.35, 0.45), ("diastole", 0.45, 0.9), ...]
    """
    ...
```

## Task 2 — batch export
```python
def export_all_segmentations(metadata_csv_path: str, annotation_dir: str, output_json_path: str = "data/processed/segmentations.json") -> str:
    """
    Runs load_segmentation() for every recording listed in metadata.csv,
    saves the results as a single JSON file:
    {
        "physionet_a0001": [["S1", 0.0, 0.12], ["systole", 0.12, 0.35], ...],
        "physionet_a0002": [...],
        ...
    }
    Returns: output_json_path
    """
    ...
```
**This JSON file (`data/processed/segmentations.json`) is your main deliverable** — it's what Dhanush's model code and Harsitaa's dashboard will read to show segment boundaries. Keep the key exactly as the recording `id` matching `metadata.csv`, and the exact state label strings above (`S1`, `systole`, `S2`, `diastole`) — no variations like `s1` lowercase or `S1_sound`.

## If a recording has no available annotation
Some recordings/subsets may not have segmentation data available. In that case:
```python
# for that recording_id, store an empty list []
# do NOT skip the recording entirely from the JSON — every id in metadata.csv should have a key,
# even if its value is an empty list
```
This matters for the "graceful degradation" requirement — downstream code expects every id to be present, even if data isn't fully available for it.

## Testing before you push
1. Run `load_segmentation()` on 5 known recordings first — print the output, sanity check that start/end times increase monotonically and don't exceed the recording's actual duration
2. Run the full `export_all_segmentations()` and open `segmentations.json` — spot check a few entries manually
3. Confirm every `id` from `metadata.csv` (get this from Ankit once his file is pushed — pull the `preprocessing` branch to see it) has a corresponding key in your JSON

## Push instructions
```bash
git add .
git commit -m "Add segmentation loader and export segmentations.json"
git push -u origin segmentation
```
Push early even with a partial JSON (e.g. covering 100 recordings) — don't wait for full coverage.

## What NOT to do
- Don't rename `load_segmentation()` or `export_all_segmentations()`
- Don't change the state label strings (`S1`, `systole`, `S2`, `diastole`) — case-sensitive, exact match expected downstream
- Don't drop recording ids that have no annotation data — include them with an empty list instead

## Definition of done
- `s1s2_loader.py` correctly loads segmentation for at least the subsets that have annotation data available
- `data/processed/segmentations.json` covers every id in `metadata.csv` (empty list where unavailable)
- Pushed to `segmentation` branch
