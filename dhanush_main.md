# EchoAssist — Task Brief: DHANUSH (Main / Integration Lead)

## Your role
You own the two hardest, most-judged parts of the pipeline: the **classifier** and **explainability (Grad-CAM)**. You are also the **integration point** — everyone else's branches get merged into `main` by you.

## Branch
Work directly on `main`, or create `modeling` and merge it into `main` yourself.

## Files you own
```
src/modeling/dataset.py
src/modeling/model.py
src/modeling/train.py
src/modeling/gradcam.py
src/api/main.py       <- NEW: FastAPI backend, see Task 5 below
```

## Architecture change: dashboard is now Vite + React, not Streamlit
Harsitaa's dashboard is a separate frontend process (`frontend/`, runs on `localhost:5173`) — it cannot import your Python functions directly. It talks to a backend over HTTP instead. You own that backend. This is a new task (Task 5) on top of your original scope — budget time for it, it's small but blocking for her.

## Shared contract — DO NOT CHANGE THIS
Everyone's code reads/writes against one file: `data/processed/metadata.csv`

Columns (exact names, exact order):
```
id, filepath, label, split, duration_sec, source_dataset
```
- `id`: unique string, e.g. `physionet_a0001`
- `filepath`: relative path to the processed `.wav`, e.g. `data/processed/audio/physionet_a0001.wav`
- `label`: one of `normal`, `murmur`, `extrasystole`, `artifact`
- `split`: one of `train`, `val`, `test`
- `duration_sec`: float
- `source_dataset`: `physionet2016` (only dataset in use for MVP — do not add `circor`; if PASCAL gets added later as a stretch goal, use `pascal` as the value)

You will receive `metadata.csv` from Ankit (preprocessing) and Chaitanya (segmentation) already populated. If it's not ready when you start, create a small dummy version (5-10 fake rows) with this exact schema so you can build against it and swap in the real file later without changing any code.

## Task 1 — `src/modeling/dataset.py`
Build a PyTorch `Dataset` class:
```python
class HeartSoundDataset(torch.utils.data.Dataset):
    def __init__(self, metadata_csv_path: str, split: str, sr: int = 2000, duration_sec: float = 5.0):
        # loads metadata.csv, filters by split column
        # for each __getitem__: load audio at filepath, convert to mel-spectrogram,
        # pad/truncate to duration_sec, return (spectrogram_tensor, label_int)
        ...
```
Use `librosa.feature.melspectrogram` for spectrogram conversion. Keep a fixed label-to-int mapping as a class constant so it's reusable elsewhere:
```python
LABEL_MAP = {"normal": 0, "murmur": 1, "extrasystole": 2, "artifact": 3}
```

## Task 2 — `src/modeling/model.py`
Build a small CNN for spectrogram classification:
```python
class HeartSoundCNN(nn.Module):
    def __init__(self, num_classes: int = 4):
        # 3-4 conv blocks (Conv2d -> BatchNorm -> ReLU -> MaxPool)
        # then adaptive pool + fully connected layer to num_classes
        ...
    def forward(self, x):
        # IMPORTANT: expose the last conv layer's activations somehow
        # (e.g. store as self.last_conv_activations during forward pass)
        # Grad-CAM in gradcam.py needs this
        ...
```
Keep it small (start with 3 conv blocks, ~<5M params) — this needs to train fast on a T4 within hours, not days.

## Task 3 — `src/modeling/train.py`
Standard training loop:
```python
def train_model(train_loader, val_loader, num_epochs=20, lr=1e-3, save_path="outputs/checkpoints/model.pt"):
    # trains HeartSoundCNN, uses class-weighted CrossEntropyLoss (classes are imbalanced)
    # saves best model (by val F1, not just val loss) to save_path
    # prints per-epoch train/val loss and accuracy
    ...
```
Class weights: compute from `metadata.csv` label distribution (e.g. `sklearn.utils.class_weight.compute_class_weight`).

## Task 4 — `src/modeling/gradcam.py`
```python
def generate_gradcam(model, input_tensor, target_class=None):
    # standard Grad-CAM: hook the last conv layer, compute gradients w.r.t.
    # target class score, weight activation maps, produce a heatmap
    # returns: heatmap (numpy array, same H/W as the conv feature map, upsampled to input size)
    ...

def overlay_heatmap_on_spectrogram(spectrogram: np.ndarray, heatmap: np.ndarray) -> np.ndarray:
    # overlays heatmap on the spectrogram image for display
    # returns an RGB image array ready to save/plot
    ...
```
This is what the dashboard (Harsitaa) will call to show "why" a classification was made — the output must be a plain image array (or file), not something requiring PyTorch to view.

## Task 5 — `src/api/main.py` (FastAPI backend for the Vite dashboard)
Wraps your `predict()`/`generate_gradcam()`, Glimin's `check_audio_validity()`, Chaitanya's `segmentations.json`, and precomputed metrics as HTTP endpoints. Harsitaa's React app calls these directly — the endpoint names/response shapes below are locked, since she's building against this spec in parallel before your backend is even running.

```bash
pip install fastapi uvicorn python-multipart
```

Required endpoints:
```python
from fastapi import FastAPI, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
import json

app = FastAPI()

# CORS — required so the Vite dev server (localhost:5173) can call this (localhost:8000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/check-validity")
async def check_validity(file: UploadFile):
    # save file to a temp path, call check_audio_validity(temp_path) from src.evaluation.edge_cases
    # return the dict as-is: {"valid": bool, "reason": str, "duration_sec": float}
    ...

@app.post("/predict")
async def predict_endpoint(file: UploadFile):
    # save temp file, preprocess to spectrogram tensor, call predict(model, tensor)
    # return {"label": str, "confidence": float, "logits": list}
    ...

@app.post("/gradcam")
async def gradcam_endpoint(file: UploadFile):
    # save temp file, run generate_gradcam() + overlay_heatmap_on_spectrogram()
    # save result as a temp PNG, return Response(content=png_bytes, media_type="image/png")
    ...

@app.get("/segmentations/{recording_id}")
async def get_segmentation(recording_id: str):
    # load data/processed/segmentations.json, return {"segments": data.get(recording_id, [])}
    ...

@app.get("/metrics")
async def get_metrics():
    # return precomputed metrics dict (from compute_metrics(), saved earlier) as JSON
    # include a confusion_matrix_url pointing at a served static file, e.g. "/static/confusion_matrix.png"
    ...

app.mount("/static", StaticFiles(directory="outputs/figures"), name="static")
```
Run it with:
```bash
uvicorn src.api.main:app --reload --port 8000
```
This must be running alongside Harsitaa's `npm run dev` for the full demo to work — make sure this is part of your demo-day startup checklist, not just something you tested once.

## Confidence score
Your `model.py`/inference code should also expose:
```python
def predict(model, input_tensor) -> dict:
    # returns {"label": str, "confidence": float, "logits": list}
    # confidence = softmax probability of predicted class
```
This exact function name/signature (`predict`) is what Harsitaa's dashboard will import and call directly. Do not rename it.

## Integration responsibilities (yours only)
1. At the **Hr 10-14 checkpoint**: pull `preprocessing`, `segmentation`, `evaluation`, `dashboard` branches one at a time via `git merge origin/<branch>`. Fix conflicts immediately — don't batch multiple merges before testing.
2. After each merge, run the full pipeline top-to-bottom on at least 5 sample recordings to confirm nothing broke.
3. If a teammate's function signature doesn't match what's written in their brief, fix it on your end after merging (don't wait for them to re-push) — you have final authority over interface consistency since you're compiling everything together.
4. Repeat integration + full-pipeline test at **Hr 18-21**.

## What NOT to do
- Don't change the `metadata.csv` column names/order — every other person's code depends on this exact schema.
- Don't rename `predict()`, `generate_gradcam()`, or `overlay_heatmap_on_spectrogram()` — dashboard code calls these by exact name.
- Don't push directly-breaking changes to `main` without testing against dummy/real data first.

## Definition of done (for your part)
- `train.py` runs end-to-end and saves a checkpoint
- `gradcam.py` produces a viewable heatmap overlay for at least one real prediction
- `predict()` returns label + confidence for any single audio file run through the full pipeline
- `src/api/main.py` runs via `uvicorn` and all 5 endpoints respond correctly when tested with `curl` or Postman, independent of the frontend
- Full repo merges cleanly and runs top-to-bottom without errors at both checkpoints
- On demo day: both `uvicorn` (port 8000) and `npm run dev` (port 5173) are running before you start the walkthrough
