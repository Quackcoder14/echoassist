# EchoAssist — Task Brief: ANKIT (Preprocessing)

## Your role
You clean and standardize the raw audio before anything else touches it. **Two datasets are now compulsory: PhysioNet 2016 and PASCAL.** Your output feeds directly into segmentation (Chaitanya) and modeling (Dhanush) — if your output format is wrong, the entire pipeline breaks downstream. Follow the contract exactly.

This is more work than a single-dataset build. Get PhysioNet 2016 fully processed and pushed FIRST (it's the larger, cleaner, better-annotated dataset) so the rest of the team has something to build against early — then process PASCAL as an additive second pass into the same `metadata.csv`, not a blocking prerequisite.

## Branch
```
git checkout -b preprocessing
```
Always work on this branch. Never push to `main` directly.

## Files you own
```
src/preprocessing/denoise.py
src/preprocessing/resample.py
```
You are ALSO responsible for producing the initial `data/processed/metadata.csv` (see Task 3 below) — this is the single shared file everyone else's code depends on. Get this right.

## Setup
- PhysioNet 2016 goes into `data/raw/physionet2016/`. Each `.wav` has a corresponding label from the dataset's reference files (normal/abnormal, or subset-specific labels — check `REFERENCE.csv` inside each subfolder A-E).
- PASCAL goes into `data/raw/pascal/`. PASCAL has two sub-collections (commonly called Set A and Set B, collected via different devices — iPhone app vs. clinical digital stethoscope). **Label is typically embedded in the filename itself** (e.g. a file starting with `normal__...`, `murmur__...`, `extrastole__...`, `artifact__...`) rather than a separate reference CSV — inspect a handful of actual filenames in whatever PASCAL mirror/zip you download before writing the parser, since exact naming conventions can vary slightly by source/mirror. If the naming doesn't match what's described here, post in the group chat with 5 example filenames rather than guessing the pattern.

Install what you need:
```bash
pip install librosa noisereduce soundfile pandas numpy
```

## Task 1 — `src/preprocessing/denoise.py`
```python
def denoise(input_path: str, output_path: str) -> str:
    """
    Applies noise reduction to a heart sound .wav file.
    input_path: path to raw audio file
    output_path: where to save the denoised audio
    Returns: output_path (str)
    """
    # Use the `noisereduce` library:
    # import noisereduce as nr
    # y, sr = librosa.load(input_path, sr=None)
    # reduced = nr.reduce_noise(y=y, sr=sr)
    # save reduced audio to output_path using soundfile.write
    ...
```
Do not change the function name or argument order — other code calls this exact signature.

## Task 2 — `src/preprocessing/resample.py`
```python
def resample_audio(input_path: str, output_path: str, target_sr: int = 2000) -> str:
    """
    Resamples audio to a fixed target sample rate.
    Returns: output_path (str)
    """
    # y, sr = librosa.load(input_path, sr=target_sr)  # librosa resamples automatically when sr is given
    # soundfile.write(output_path, y, target_sr)
    ...
```
**IMPORTANT: use `target_sr = 2000`** — this is the agreed common sample rate for the whole team (matches PhysioNet 2016's native rate, so this dataset needs minimal resampling; keep it consistent so Dhanush's model always receives the same input shape).

## Task 3 — Build `data/processed/metadata.csv` (BOTH datasets, one unified file)
This is the most important deliverable from you. It is the **single shared source of truth** every other teammate's code reads from. Do not deviate from this schema.

Exact columns, exact order, exact names:
```
id,filepath,label,split,duration_sec,source_dataset
```

Example rows (note both source datasets landing in the SAME file):
```
physionet_a0001,data/processed/audio/physionet_a0001.wav,normal,train,8.2,physionet2016
physionet_a0002,data/processed/audio/physionet_a0002.wav,abnormal,train,6.5,physionet2016
pascal_setA_normal_0001,data/processed/audio/pascal_setA_normal_0001.wav,normal,train,4.1,pascal
pascal_setB_murmur_0007,data/processed/audio/pascal_setB_murmur_0007.wav,murmur,val,3.6,pascal
```

### Sub-task 3a — process PhysioNet 2016 first, push it, THEN move to PASCAL
1. For every raw file in `data/raw/physionet2016/`, run it through `denoise()` then `resample_audio()` (target_sr=2000), save to `data/processed/audio/<id>.wav`
2. `id`: `physionet_<original_filename_without_extension>`
3. `label`: pull from the dataset's reference file, map to canonical labels:
   - `normal` → `normal`
   - `abnormal` → `murmur` (unless the subset differentiates extrasystole — check training-b/training-e reference files; use `extrasystole` if present, else default abnormal to `murmur`)
   - `unsure` → `artifact`
4. `source_dataset`: `physionet2016`

**Push a working metadata.csv covering PhysioNet alone first** — this unblocks Chaitanya and Dhanush immediately. Don't wait until PASCAL is also done to make your first push.

### Sub-task 3b — download & process PASCAL, APPEND to the same metadata.csv (don't overwrite)

**Download (WAV format, not AIFF):**
From the PASCAL site, download these zips into `data/raw/pascal/`, keeping Set A and Set B in separate subfolders:
```
data/raw/pascal/setA/
  Atraining_normal/       <- from Atraining_normal.zip (31 files)
  Atraining_murmur/       <- from Atraining_murmur.zip (34 files)
  Atraining_extrahs/      <- from Atraining_extrahs.zip (19 files)
  Atraining_artifact/     <- from Atraining_artifact.zip (40 files)
  Atraining_normal_seg.csv   <- segmentation reference, save here too (Chaitanya needs this)
data/raw/pascal/setB/
  Btraining_normal/        <- from Btraining_normal.zip (320 files, includes Btraining_noisynormal subdir)
  Btraining_murmur/        <- from Btraining_murmur.zip (95 files, includes Btraining_noisymurmur subdir)
  Btraining_extrasystole/  <- from Btraining_extrasystole.zip (46 files)
  Btraining_normal_seg.csv  <- segmentation reference, save here too
```
**Do NOT download `Aunlabelledtest.zip` or `Bunlabelledtest.zip` for training** — these files have no ground-truth label and cannot go into `metadata.csv`'s labeled rows. (Optional: keep a handful aside separately for a live "unlabeled file" edge-case demo on the dashboard later — not part of this task.)

**Label mapping — Set A and Set B use DIFFERENT category names, map carefully:**

| Source folder | Canonical label |
|---|---|
| `Atraining_normal` | `normal` |
| `Atraining_murmur` | `murmur` |
| `Atraining_extrahs` | `extrasystole` (PASCAL calls this "extra heart sound" — same canonical bucket as extrasystole) |
| `Atraining_artifact` | `artifact` |
| `Btraining_normal` (incl. `Btraining_noisynormal`) | `normal` |
| `Btraining_murmur` (incl. `Btraining_noisymurmur`) | `murmur` |
| `Btraining_extrasystole` | `extrasystole` |

Note: **Set B has no `artifact` category at all** — that's expected, not a gap you need to fill. Don't force any Set B file into `artifact`.

**Steps:**
1. For every raw file in the folders above, run it through `denoise()` → `resample_audio()` (target_sr=2000 — PASCAL's native rate is much higher, ~44.1kHz for Set A in particular, so this resample step matters a lot here)
2. `id`: `pascal_setA_<label>_<original_filename_without_extension>` or `pascal_setB_<label>_<original_filename_without_extension>` — keep set + label visible in the id, helps everyone debug later
3. `label`: from the mapping table above — based on which source folder the file came from, not filename parsing (PASCAL's real structure is one folder per class, simpler than expected)
4. `source_dataset`: `pascal`
5. **Append** these rows to the existing `metadata.csv` (read the existing file, concat, re-save) — don't regenerate PhysioNet's rows or change their `id`s in the process

### Split assignment (applies to both datasets)
`split`: assign roughly 70% train / 15% val / 15% test **within each dataset separately, split by patient/recording source group if identifiable, not randomly per file**, to avoid data leakage. Do this per-dataset (PhysioNet gets its own 70/15/15, PASCAL gets its own 70/15/15) rather than pooling both then splitting once. Ask in the group chat if unsure how to identify patient groups in a given subset — don't guess silently.

`duration_sec`: use `librosa.get_duration(path=filepath)` — same for both datasets.

Write this out using `pandas`:
```python
df.to_csv("data/processed/metadata.csv", index=False)
```

## Testing before you push
1. Run your pipeline on 5 sample files from EACH source folder (both PhysioNet and each PASCAL class folder) first — confirm output `.wav` files play correctly and are not silent/corrupted
2. Open `metadata.csv` and manually check rows from both `source_dataset` values look sensible (paths exist, labels look right, durations reasonable)
3. Confirm `data/processed/audio/` contains files matching every path listed in `metadata.csv` — no missing files, for either dataset
4. Sanity check class balance across the combined file (`df.groupby(['source_dataset','label']).size()`) — flag to the team if one class ends up with very few examples (watch `extrasystole` in particular — PhysioNet + PASCAL's extrahs/extrasystole folders combined are still the smallest class), since this affects Dhanush's class weighting
5. Confirm you did NOT include any `Aunlabelledtest`/`Bunlabelledtest` rows in `metadata.csv`

## Push instructions
```bash
git add .
git commit -m "Add preprocessing pipeline, PhysioNet metadata"
git push -u origin preprocessing
# ... later, after PASCAL is done ...
git add .
git commit -m "Append PASCAL to metadata.csv"
git push -u origin preprocessing
```
**Push early and often, and push PhysioNet's portion first as its own commit** — don't wait until both datasets are fully done to push for the first time. A partial PhysioNet-only metadata.csv unblocks everyone else immediately; PASCAL can land as a second commit hours later.

## What NOT to do
- Don't rename `denoise()` or `resample_audio()` or change their argument order
- Don't change the `metadata.csv` column names or order
- Don't include `Aunlabelledtest`/`Bunlabelledtest` files in `metadata.csv` — they have no ground truth label
- Don't put large `.wav` files in git — they're already gitignored (`data/raw/`, `data/processed/*.wav`), only `metadata.csv` itself should be committed
- Don't silently invent your own label categories — stick to `normal`, `murmur`, `extrasystole`, `artifact`
- Don't let PASCAL block your first push — PhysioNet alone should go out first
- Don't overwrite PhysioNet's rows when appending PASCAL — read-concat-save, not regenerate-from-scratch

## Definition of done
- All (or as many as time allows) PhysioNet 2016 files denoised, resampled to 2000 Hz, saved to `data/processed/audio/` — pushed first, standalone
- All (or as many as time allows) PASCAL files denoised, resampled to 2000 Hz, saved to `data/processed/audio/` — pushed second, appended
- `data/processed/metadata.csv` contains rows from BOTH `source_dataset` values, exact schema above
- Pushed to `preprocessing` branch
