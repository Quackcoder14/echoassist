# EchoAssist: Clinical Acoustic Intelligence

EchoAssist is a dual-organ (Cardiac and Respiratory) AI decision-support platform designed to transform raw stethoscope recordings into clear, evidence-led clinical insights. By combining deep learning with a robust quality gate and plain-English explainability, EchoAssist bridges the gap between raw acoustic data and point-of-care clinical reasoning.

---

## 🌟 Key Features

- **Dual-Organ Modality:** Seamlessly toggles between Heart and Lung modes, dynamically adapting neural classification, presets, and UI terminology.
- **Intelligent Quality Gate:** Automatically intercepts and rejects low-fidelity audio before inference (validating noise floor, SNR, and duration), reducing false positives from clinical noise.
- **Neural Classification (CNN):** A highly optimized PyTorch Convolutional Neural Network processing Mel-spectrograms for rapid, accurate classification.
- **White-Box Explainability:** Utilizes **Grad-CAM** time-frequency activation maps and **Factor Contributions** to highlight exactly *why* the model made its decision in plain English.
- **Modern, Responsive UI:** Built with Vite + React, featuring smooth micro-animations, real-time waveform rendering (Web Audio API), and dynamic clinical terminology.

---

## 🛠 Tech Stack

### Frontend (Dashboard)
- **Framework:** React.js, Vite
- **Styling & UI:** Tailwind CSS, Vanilla CSS, Anime.js, Lucide Icons
- **Audio Processing:** Web Audio API, Canvas API

### Backend & API
- **Framework:** FastAPI (Python), Uvicorn
- **Architecture:** Asynchronous REST endpoints serving models and precomputed data

### Machine Learning & Audio Processing
- **Deep Learning:** PyTorch
- **Audio DSP:** Librosa, SciPy, Noisereduce, Soundfile
- **Data Manipulation:** Pandas, NumPy

---

## 📊 Datasets & Clinical Taxonomy

EchoAssist's models are trained and cross-validated on standardized clinical datasets:

### Cardiac (Heart)
- **Datasets:** PhysioNet 2016, PASCAL, CirCor DigiScope 2022
- **Classes:** 
  - *Normal Heart Sound*
  - *Cardiac Murmur*
  - *Extrasystole / PVC*
  - *Artifact*

### Respiratory (Lung)
- **Datasets:** ICBHI 2017, HF Lung, RespiratoryDB
- **Classes:**
  - *Normal Breath Sound*
  - *Crackles / Rales*
  - *Wheezes*
  - *Mixed (Both)*

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v16+)
- Python (3.9+)

### 1. Start the Backend (FastAPI)
Navigate to the root directory and install Python dependencies:
```bash
pip install fastapi uvicorn python-multipart torch librosa noisereduce soundfile pandas numpy
```
Start the backend server:
```bash
uvicorn src.api.main:app --reload --port 8000
```

### 2. Start the Frontend (Vite + React)
Open a new terminal, navigate to the `frontend` directory:
```bash
cd frontend
npm install
npm run dev
```
The application will be running at `http://localhost:5173`.

---

## 👥 Team & Architecture Roles

EchoAssist is a collaborative effort built on clear contracts:

- **Preprocessing (Ankit):** Owns `src/preprocessing/`. Responsible for denoising, resampling, and standardizing datasets into the unified `data/processed/metadata.csv`.
- **Segmentation (Chaitanya):** Owns acoustic boundary detection (S1/Systole/S2/Diastole) for overlay generation.
- **Modeling & Integration (Dhanush):** Owns `src/modeling/` and `src/api/`. Responsible for the CNN classifier, Grad-CAM explainability, and the FastAPI backend.
- **Frontend Dashboard (Harsitaa):** Owns `frontend/`. Responsible for the Vite+React application, integrating API endpoints, and delivering the polished UI/UX.

---

*Note: EchoAssist is a decision-support tool designed to augment clinical reasoning. It is not a diagnostic system and should be used alongside standard physical examinations and patient symptoms.*
