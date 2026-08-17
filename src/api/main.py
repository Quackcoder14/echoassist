"""
src/api/main.py
FastAPI backend for EchoAssist.

Endpoints (names/shapes are LOCKED — Harsitaa's frontend depends on them):
  POST /check-validity        → {valid, reason, duration_sec}
  POST /predict               → {label, confidence, logits}
  POST /gradcam               → PNG image bytes
  GET  /segmentations/{id}    → {segments: [...]}
  GET  /metrics               → metrics dict + confusion_matrix_url

Static files served at /static → outputs/figures/

Start with:
    uvicorn src.api.main:app --reload --port 8000
"""

import io
import json
import os
import sys
import tempfile

import cv2
import numpy as np
import torch
import librosa

from fastapi import FastAPI, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles

# Ensure project root is on sys.path when running via uvicorn from repo root
_PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if _PROJECT_ROOT not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT)

from src.modeling.dataset import HeartSoundDataset
from src.modeling.model import HeartSoundCNN, predict
from src.modeling.gradcam import generate_gradcam, overlay_heatmap_on_spectrogram


# ---------------------------------------------------------------------------
# Paths (relative to project root)
# ---------------------------------------------------------------------------
_CHECKPOINT_PATH = os.path.join(_PROJECT_ROOT, "outputs", "checkpoints", "model.pt")
_SEGMENTATIONS_PATH = os.path.join(_PROJECT_ROOT, "data", "processed", "segmentations.json")
_METRICS_PATH = os.path.join(_PROJECT_ROOT, "outputs", "figures", "metrics.json")
_FIGURES_DIR = os.path.join(_PROJECT_ROOT, "outputs", "figures")

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------
app = FastAPI(
    title="EchoAssist API",
    description="Acoustic analysis and clinical decision support — ML backend",
    version="1.0.0",
)

# CORS — required so the Vite dev server (localhost:5173) can call this
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve static files (e.g. confusion_matrix.png) at /static
os.makedirs(_FIGURES_DIR, exist_ok=True)
app.mount("/static", StaticFiles(directory=_FIGURES_DIR), name="static")

# ---------------------------------------------------------------------------
# Model — loaded once at startup
# ---------------------------------------------------------------------------
_MODEL: HeartSoundCNN = None
_DEVICE: torch.device = None


@app.on_event("startup")
async def load_model():
    global _MODEL, _DEVICE
    _DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    if os.path.exists(_CHECKPOINT_PATH):
        ckpt = torch.load(_CHECKPOINT_PATH, map_location=_DEVICE)
        num_classes = ckpt.get("num_classes", len(HeartSoundDataset.LABEL_MAP))
        _MODEL = HeartSoundCNN(num_classes=num_classes).to(_DEVICE)
        _MODEL.load_state_dict(ckpt["model_state_dict"])
        _MODEL.eval()
        print(f"[startup] Model loaded ({num_classes} classes) from {_CHECKPOINT_PATH} — device: {_DEVICE}")
    else:
        _MODEL = HeartSoundCNN(num_classes=len(HeartSoundDataset.LABEL_MAP)).to(_DEVICE)
        _MODEL.eval()
        print(
            f"[startup] WARNING — no checkpoint found at {_CHECKPOINT_PATH}. "
            "Using untrained model weights. Run src/modeling/train.py first."
        )


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

_SR = 2000
_DURATION_SEC = 5.0
_N_MELS = 128
_N_FFT = 256
_HOP_LENGTH = 64


def _wav_to_spectrogram_tensor(wav_path: str) -> tuple:
    """
    Load a WAV file and return (input_tensor, log_mel_array).

    input_tensor : torch.Tensor shape (1, 1, n_mels, T)
    log_mel_array: np.ndarray  shape (n_mels, T)  — for Grad-CAM overlay
    """
    target_samples = int(_SR * _DURATION_SEC)
    try:
        audio, _ = librosa.load(wav_path, sr=_SR, mono=True)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Could not load audio: {exc}")

    # Pad / truncate
    n = len(audio)
    if n >= target_samples:
        audio = audio[:target_samples]
    else:
        audio = np.pad(audio, (0, target_samples - n), mode="constant")

    mel = librosa.feature.melspectrogram(
        y=audio,
        sr=_SR,
        n_mels=_N_MELS,
        n_fft=_N_FFT,
        hop_length=_HOP_LENGTH,
        fmax=_SR // 2,
    )
    log_mel = librosa.power_to_db(mel, ref=np.max)

    log_mel_norm = (log_mel - log_mel.min()) / (log_mel.max() - log_mel.min() + 1e-8)
    tensor = torch.tensor(log_mel_norm, dtype=torch.float32).unsqueeze(0).unsqueeze(0)
    return tensor, log_mel_norm


def _check_audio_validity(wav_path: str) -> dict:
    """
    Basic audio validity check — mirrors what src.evaluation.edge_cases is expected to expose.
    Falls back to this implementation if that module isn't available yet.
    """
    try:
        from src.evaluation.edge_cases import check_audio_validity
        return check_audio_validity(wav_path)
    except (ImportError, AttributeError):
        pass

    # Fallback implementation
    try:
        audio, sr = librosa.load(wav_path, sr=None, mono=True)
    except Exception as exc:
        return {"valid": False, "reason": f"Cannot decode file: {exc}", "duration_sec": 0.0}

    duration = float(len(audio) / sr)

    if duration < 0.5:
        return {"valid": False, "reason": "Recording too short (< 0.5 s)", "duration_sec": duration}
    if np.max(np.abs(audio)) < 1e-5:
        return {"valid": False, "reason": "Silent recording — no signal detected", "duration_sec": duration}

    return {"valid": True, "reason": "OK", "duration_sec": round(duration, 3)}


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.post("/check-validity")
async def check_validity_endpoint(file: UploadFile):
    """Check whether an uploaded audio file is usable."""
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name
    try:
        result = _check_audio_validity(tmp_path)
    finally:
        os.unlink(tmp_path)
    return result


@app.post("/predict")
async def predict_endpoint(file: UploadFile):
    """
    Classify an uploaded heart sound recording.

    Returns
    -------
    {"label": str, "confidence": float, "logits": list[float]}
    """
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name
    try:
        tensor, _ = _wav_to_spectrogram_tensor(tmp_path)
        result = predict(_MODEL, tensor)
    finally:
        os.unlink(tmp_path)
    return result


@app.post("/gradcam")
async def gradcam_endpoint(file: UploadFile):
    """
    Generate a Grad-CAM explanation overlay for an uploaded recording.

    Returns a PNG image (media_type image/png).
    """
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name
    try:
        tensor, log_mel = _wav_to_spectrogram_tensor(tmp_path)

        # Run Grad-CAM (model must have gradients available)
        _MODEL.eval()
        heatmap = generate_gradcam(_MODEL, tensor)
        overlay = overlay_heatmap_on_spectrogram(log_mel, heatmap)

        # Encode overlay to PNG bytes in-memory
        overlay_bgr = cv2.cvtColor(overlay, cv2.COLOR_RGB2BGR)
        success, buf = cv2.imencode(".png", overlay_bgr)
        if not success:
            raise HTTPException(status_code=500, detail="PNG encoding failed")
        png_bytes = buf.tobytes()
    finally:
        os.unlink(tmp_path)

    return Response(content=png_bytes, media_type="image/png")


@app.get("/segmentations/{recording_id}")
async def get_segmentation(recording_id: str):
    """
    Return pre-computed or estimated S1/S2 segmentation data for a recording.
    """
    try:
        from src.segmentation.s1s2_loader import get_segmentation_for_recording
        segments = get_segmentation_for_recording(recording_id, json_path=_SEGMENTATIONS_PATH)
        return {"segments": segments}
    except Exception:
        if not os.path.exists(_SEGMENTATIONS_PATH):
            return {"segments": []}
        with open(_SEGMENTATIONS_PATH) as f:
            data = json.load(f)
        return {"segments": data.get(recording_id, [])}


@app.get("/metrics")
async def get_metrics():
    """
    Return pre-computed evaluation metrics from the last training run.

    Includes confusion_matrix_url pointing at the served static file.
    """
    if not os.path.exists(_METRICS_PATH):
        raise HTTPException(
            status_code=404,
            detail="Metrics not found. Run src/modeling/train.py first.",
        )
    with open(_METRICS_PATH) as f:
        metrics = json.load(f)
    return metrics


# ---------------------------------------------------------------------------
# Health check (bonus — useful for CI/demo day startup script)
# ---------------------------------------------------------------------------

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "model_loaded": _MODEL is not None,
        "checkpoint_exists": os.path.exists(_CHECKPOINT_PATH),
        "device": str(_DEVICE),
    }
