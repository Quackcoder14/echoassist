# EchoAssist — Frontend Dashboard (Vite + React)

A modern, high-fidelity Clinical Decision Support and Acoustic Analysis Dashboard for **EchoAssist (PS-S01)**.

Built with **Vite**, **React**, **WaveSurfer.js**, **Axios**, and **Lucide Icons**.

---

## Features

- 🎧 **Phonocardiogram (PCG) Acoustic Signal Visualizer**: Powered by `wavesurfer.js` with audio scrubbing, playback, restart, and zoom controls.
- 🛡️ **Acoustic Signal Validity Gate**: Pre-screening stage that checks audio signal-to-noise ratio and rejects silent/corrupted files gracefully before invoking inference.
- 🩺 **Multiclass Pathological Classifier**: Classifies cardiac sounds into **Normal**, **Murmur**, **Extrasystole (Arrhythmia/PVC)**, and **Artifact** with confidence scores and softmax probability logits breakdown.
- 🔬 **Grad-CAM Neural Explainability Overlay**: Heatmap activation overlayed on the Mel-Spectrogram showing exact time-frequency acoustic coordinates that triggered model prediction.
- ⏱️ **Springer HMM Cardiac Cycle Segmentation**: Visual timeline tracking of **S1 (lub)**, **Systole**, **S2 (dub)**, and **Diastole** synchronized with audio playback.
- 📊 **Clinical Evaluation & Validation Panel**: Macro F1-score, accuracy, per-class sensitivity/recall report, and confusion matrix.
- ⚡ **1-Click Preset Demo Bank**: Built-in test presets (Normal, Systolic Murmur, Extrasystole, Low-SNR Silence) with in-memory PCM WAV synthesis for instant judge testing without external audio files.
- 🔄 **Intelligent Live / Mock Toggle**: Seamlessly switches between the live FastAPI backend (`http://localhost:8000`) and the self-contained mock fallback mode.

---

## Getting Started

### 1. Install Dependencies
```bash
cd frontend
npm install
```

### 2. Run Development Server
```bash
npm run dev
```

The app will launch at `http://localhost:5173`.

---

## API Contract

The frontend connects to the backend at `http://localhost:8000`:
- `POST /check-validity` -> `{ valid: bool, reason: str, duration_sec: float }`
- `POST /predict` -> `{ label: str, confidence: float, logits: float[] }`
- `POST /gradcam` -> `PNG blob (Spectrogram heatmap)`
- `GET /segmentations/{id}` -> `{ segments: [[name, start, end], ...] }`
- `GET /metrics` -> `{ accuracy: float, macro_f1: float, per_class: {...} }`
