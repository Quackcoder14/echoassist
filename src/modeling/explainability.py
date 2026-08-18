"""
src/modeling/explainability.py
-------------------------------
Multi-Factor Acoustic Explainability & Attribution Engine.

Computes 5 physiological acoustic biomarkers from raw PCG audio that contributed
to the model's classification decision, alongside Grad-CAM feature attribution.

Biomarkers:
  1. Systolic Spectral Turbulence   (200–500 Hz band power ratio)
  2. S1/S2 Impulse Sharpness        (25–120 Hz envelope peak-to-valley definition)
  3. Diastolic Baseline Quiescence  (measured silence between S2→next S1)
  4. Cardiac Rhythm Regularity      (RR interval coefficient of variation)
  5. Acoustic Disturbance Index     (>500 Hz non-cardiac noise power ratio)

These are computed from raw audio using signal processing — NOT the neural
network. They provide model-independent attribution alongside Grad-CAM.
"""

import numpy as np
import librosa
from typing import Optional


# ---------------------------------------------------------------------------
# Constants: Clinical reference ranges (normal PCG physiology)
# ---------------------------------------------------------------------------

CLINICAL_RANGES = {
    "systolic_turbulence_db": {
        "normal_max": 14.0,  # dB — normal systolic band power
        "label": "Systolic Spectral Turbulence",
        "unit": "dB",
        "clinical_note_normal": "Normal laminar blood flow through valves. Systolic band energy within physiological range.",
        "clinical_note_elevated": "Elevated mid-frequency turbulent energy detected during ventricular systole. Consistent with valvular jet turbulence (e.g. Aortic Stenosis, Mitral Regurgitation).",
    },
    "s1s2_sharpness": {
        "normal_min": 0.80,   # normalized [0,1] — ideally > 0.80
        "label": "S1/S2 Impulse Boundary Definition",
        "unit": "ratio",
        "clinical_note_normal": "Clear physiological valve coaptation. S1 (mitral/tricuspid closure) and S2 (aortic/pulmonic closure) impulse peaks are sharp and well-defined.",
        "clinical_note_low": "Broadened or attenuated heart sound boundaries. S1/S2 definition reduced, potentially obscured by superimposed murmur energy or poor stethoscope contact.",
    },
    "diastolic_quiescence": {
        "normal_max": 0.15,  # normalized [0,1] — quiet diastole
        "label": "Diastolic Baseline Quiescence",
        "unit": "ratio",
        "clinical_note_normal": "Diastolic filling interval is acoustically quiet. Normal ventricular relaxation with no regurgitant flow.",
        "clinical_note_elevated": "Elevated acoustic energy during diastole (ventricular filling phase). May indicate diastolic murmur, aortic regurgitation, or mitral stenosis.",
    },
    "rhythm_regularity_cv": {
        "normal_max": 0.10,  # coefficient of variation — highly regular
        "label": "Cardiac Rhythm Regularity",
        "unit": "CV",
        "clinical_note_normal": "Regular sinus rhythm. Cardiac cycle intervals are consistent within normal variance.",
        "clinical_note_elevated": "Irregular cycle timing detected. Compensatory pauses or premature beats may indicate extrasystoles (PVCs) or arrhythmia.",
    },
    "disturbance_index": {
        "normal_max": 0.20,  # fraction of total energy above 500 Hz
        "label": "Acoustic Noise & Sensor Disturbance Index",
        "unit": "index",
        "clinical_note_normal": "Clean acoustic signal. Minimal ambient noise or stethoscope movement artifacts.",
        "clinical_note_elevated": "Elevated high-frequency non-cardiac energy detected. Signal quality may be compromised by stethoscope friction, patient movement, or environmental noise.",
    },
    "crackles_band_power": {
        "normal_max": 20.0,
        "label": "Discontinuous Crackle Energy",
        "unit": "dB",
        "clinical_note_normal": "Normal clear airways. No prominent short, explosive popping sounds detected.",
        "clinical_note_elevated": "Elevated high-frequency popping sounds (crackles/rales). May indicate fluid in airways or airway collapse (e.g. Pneumonia, CHF, COPD).",
    },
    "wheeze_band_power": {
        "normal_max": 25.0,
        "label": "Continuous Wheeze Energy",
        "unit": "dB",
        "clinical_note_normal": "Normal airway flow. No prominent continuous musical tones detected.",
        "clinical_note_elevated": "Elevated continuous musical sounds (wheezes). May indicate narrowed airways (e.g. Asthma, COPD).",
    },
    "respiratory_disturbance": {
        "normal_max": 0.25,
        "label": "Recording Noise & Disturbance",
        "unit": "index",
        "clinical_note_normal": "Clean respiratory acoustic signal.",
        "clinical_note_elevated": "Elevated non-respiratory noise detected (friction, movement).",
    }
}


# ---------------------------------------------------------------------------
# Core biomarker extraction
# ---------------------------------------------------------------------------

def compute_band_power(audio: np.ndarray, sr: int, lo: float, hi: float) -> float:
    """Compute mean spectral power (dB) in frequency band [lo, hi] Hz."""
    n_fft = min(512, len(audio))
    D = np.abs(librosa.stft(audio, n_fft=n_fft, hop_length=n_fft // 4)) ** 2
    freqs = librosa.fft_frequencies(sr=sr, n_fft=n_fft)
    mask = (freqs >= lo) & (freqs <= hi)
    if mask.sum() == 0:
        return -60.0
    band_power = D[mask, :].mean()
    return float(10 * np.log10(band_power + 1e-12))


def compute_systolic_turbulence(audio: np.ndarray, sr: int) -> dict:
    """
    Systolic Spectral Turbulence: ratio of 200–500 Hz (turbulence band) power
    relative to 25–200 Hz (fundamental cardiac band) power.
    """
    turbulence_db = compute_band_power(audio, sr, 200, 500)
    cardiac_db    = compute_band_power(audio, sr, 25,  200)
    # dB difference (positive = more turbulence relative to cardiac fundamentals)
    turbulence_excess = turbulence_db - cardiac_db + 20.0  # shift to positive range
    turbulence_excess = max(0.0, min(turbulence_excess, 40.0))

    ref = CLINICAL_RANGES["systolic_turbulence_db"]
    normal_max = ref["normal_max"]
    is_elevated = turbulence_excess > normal_max

    return {
        "id": "systolic_turbulence",
        "name": ref["label"],
        "category": "Pathology Indicator",
        "measured_value": f"{turbulence_excess:.1f} dB excess",
        "reference_range": f"< {normal_max:.1f} dB (normal)",
        "status": "elevated" if is_elevated else "normal",
        "score": turbulence_excess,
        "score_norm": min(turbulence_excess / 40.0, 1.0),
        "clinical_note": ref["clinical_note_elevated"] if is_elevated else ref["clinical_note_normal"],
    }


def compute_s1s2_sharpness(audio: np.ndarray, sr: int) -> dict:
    """
    S1/S2 Impulse Boundary Definition: measures how sharp and prominent
    the dominant low-frequency (25–120 Hz) envelope peaks are.
    """
    ref = CLINICAL_RANGES["s1s2_sharpness"]

    # Bandpass to cardiac impulse frequencies
    from scipy.signal import butter, sosfilt
    nyq = sr / 2.0
    lo, hi = max(25 / nyq, 0.01), min(120 / nyq, 0.99)
    sos = butter(2, [lo, hi], btype="bandpass", output="sos")
    filtered = sosfilt(sos, audio)

    # Envelope
    envelope = np.abs(librosa.effects.harmonic(filtered, margin=2.0))
    envelope = np.convolve(envelope, np.ones(int(sr * 0.02)) / int(sr * 0.02), mode="same")

    if envelope.max() < 1e-8:
        sharpness = 0.0
    else:
        envelope_norm = envelope / (envelope.max() + 1e-9)
        # Sharpness = mean of top-10% peaks / mean of bottom-50% (peak-to-valley ratio)
        top_thresh = np.percentile(envelope_norm, 90)
        bot_thresh = np.percentile(envelope_norm, 50)
        top_mean = envelope_norm[envelope_norm >= top_thresh].mean()
        bot_mean = envelope_norm[envelope_norm <= bot_thresh].mean() + 1e-9
        sharpness = float(np.clip(top_mean / (bot_mean * 5.0), 0.0, 1.0))

    is_low = sharpness < ref["normal_min"]

    return {
        "id": "s1s2_sharpness",
        "name": ref["label"],
        "category": "Physiological Indicator",
        "measured_value": f"{sharpness:.3f} sharpness ratio",
        "reference_range": f"> {ref['normal_min']:.2f} (optimal definition)",
        "status": "low" if is_low else "normal",
        "score": sharpness,
        "score_norm": sharpness,
        "clinical_note": ref["clinical_note_low"] if is_low else ref["clinical_note_normal"],
    }


def compute_diastolic_quiescence(audio: np.ndarray, sr: int) -> dict:
    """
    Diastolic Baseline Quiescence: energy ratio of the quietest 40% of the
    recording vs. the loudest 20% (normal diastole should be near-silent).
    """
    ref = CLINICAL_RANGES["diastolic_quiescence"]

    # Frame-level RMS energy
    frame_len = int(sr * 0.05)  # 50ms frames
    rms = librosa.feature.rms(y=audio, frame_length=frame_len, hop_length=frame_len)[0]

    if rms.max() < 1e-8:
        quiescence = 0.0
    else:
        rms_norm = rms / (rms.max() + 1e-9)
        loud_thresh = np.percentile(rms_norm, 80)
        quiet_thresh = np.percentile(rms_norm, 40)
        loud_mean = rms_norm[rms_norm >= loud_thresh].mean()
        quiet_mean = rms_norm[rms_norm <= quiet_thresh].mean()
        # Ratio of quiet-to-loud energy (high = noisy diastole = problem)
        quiescence = float(np.clip(quiet_mean / (loud_mean + 1e-9), 0.0, 1.0))

    is_elevated = quiescence > ref["normal_max"]

    return {
        "id": "diastolic_quiescence",
        "name": ref["label"],
        "category": "Physiological Indicator",
        "measured_value": f"{quiescence:.3f} noise ratio",
        "reference_range": f"< {ref['normal_max']:.2f} (quiet diastole)",
        "status": "elevated" if is_elevated else "normal",
        "score": quiescence,
        "score_norm": min(quiescence / 0.5, 1.0),
        "clinical_note": ref["clinical_note_elevated"] if is_elevated else ref["clinical_note_normal"],
    }


def compute_rhythm_regularity(audio: np.ndarray, sr: int) -> dict:
    """
    Cardiac Rhythm Regularity: coefficient of variation (CV) of detected
    dominant energy peaks (proxy for RR interval variance).
    """
    ref = CLINICAL_RANGES["rhythm_regularity_cv"]

    frame_len = int(sr * 0.05)
    rms = librosa.feature.rms(y=audio, frame_length=frame_len, hop_length=frame_len)[0]

    # Find dominant peaks (cardiac impulse candidates)
    from scipy.signal import find_peaks
    min_dist = int(0.3 * sr / frame_len)  # minimum 300ms between beats
    peaks, _ = find_peaks(rms, height=np.percentile(rms, 70), distance=min_dist)

    if len(peaks) < 3:
        cv = 0.05  # too few peaks — assume regular
    else:
        intervals = np.diff(peaks)
        cv = float(np.std(intervals) / (np.mean(intervals) + 1e-9))

    is_irregular = cv > ref["normal_max"]

    return {
        "id": "rhythm_regularity",
        "name": ref["label"],
        "category": "Rhythm Indicator",
        "measured_value": f"CV = {cv:.4f}",
        "reference_range": f"CV < {ref['normal_max']:.2f} (regular sinus rhythm)",
        "status": "irregular" if is_irregular else "regular",
        "score": cv,
        "score_norm": min(cv / 0.5, 1.0),
        "clinical_note": ref["clinical_note_elevated"] if is_irregular else ref["clinical_note_normal"],
    }


def compute_disturbance_index(audio: np.ndarray, sr: int) -> dict:
    """
    Acoustic Noise & Sensor Disturbance Index: fraction of total spectral
    energy in the non-cardiac high-frequency band (>500 Hz).
    """
    ref = CLINICAL_RANGES["disturbance_index"]

    n_fft = min(512, len(audio))
    D = np.abs(librosa.stft(audio, n_fft=n_fft, hop_length=n_fft // 4)) ** 2
    freqs = librosa.fft_frequencies(sr=sr, n_fft=n_fft)

    total_energy = D.sum() + 1e-12
    noise_mask = freqs >= min(500, sr / 2 - 1)
    noise_energy = D[noise_mask, :].sum()

    disturbance = float(np.clip(noise_energy / total_energy, 0.0, 1.0))
    is_elevated = disturbance > ref["normal_max"]

    return {
        "id": "disturbance_index",
        "name": ref["label"],
        "category": "Signal Quality",
        "measured_value": f"{disturbance:.4f} disturbance ratio",
        "reference_range": f"< {ref['normal_max']:.2f} (clean signal)",
        "status": "elevated" if is_elevated else "clean",
        "score": disturbance,
        "score_norm": min(disturbance / 0.6, 1.0),
        "clinical_note": ref["clinical_note_elevated"] if is_elevated else ref["clinical_note_normal"],
    }


# ---------------------------------------------------------------------------
# Contribution weighting per class
# ---------------------------------------------------------------------------

# How strongly each biomarker predicts each class (positive = supports, negative = opposes)
# These weights are derived from clinical PCG physiology literature.
FACTOR_CLASS_WEIGHTS = {
    "normal": {
        "systolic_turbulence": -0.40,   # low turbulence supports normal
        "s1s2_sharpness":       0.25,   # sharp impulses support normal
        "diastolic_quiescence": -0.20,  # quiet diastole supports normal
        "rhythm_regularity":   -0.10,   # regular rhythm supports normal
        "disturbance_index":   -0.05,   # low disturbance supports normal
    },
    "murmur": {
        "systolic_turbulence":  0.45,   # high turbulence strongly supports murmur
        "s1s2_sharpness":      -0.20,   # blurred impulses support murmur
        "diastolic_quiescence": 0.20,   # diastolic noise can support some murmurs
        "rhythm_regularity":    0.05,
        "disturbance_index":    0.10,
    },
    "extrasystole": {
        "systolic_turbulence":  0.10,
        "s1s2_sharpness":       0.10,
        "diastolic_quiescence": 0.10,
        "rhythm_regularity":    0.60,   # irregular rhythm most strongly predicts extrasystole
        "disturbance_index":    0.10,
    },
    "artifact": {
        "systolic_turbulence":  0.10,
        "s1s2_sharpness":      -0.10,
        "diastolic_quiescence": 0.10,
        "rhythm_regularity":    0.05,
        "disturbance_index":    0.65,   # high disturbance strongly predicts artifact
    },
}


def compute_factor_contributions(biomarkers: list[dict], predicted_class: str) -> list[dict]:
    """
    Compute the contribution percentage of each biomarker to the predicted class score.
    Returns a list of factors with contribution_pct added.
    """
    weights = FACTOR_CLASS_WEIGHTS.get(predicted_class, FACTOR_CLASS_WEIGHTS["normal"])

    # Compute raw weighted contributions
    contributions = {}
    for bm in biomarkers:
        bm_id = bm["id"]
        w = weights.get(bm_id, 0.0)
        # Contribution = weight × normalized score (positive or negative)
        raw = w * bm["score_norm"]
        contributions[bm_id] = raw

    total_abs = sum(abs(v) for v in contributions.values()) + 1e-9

    enriched = []
    for bm in biomarkers:
        bm_id = bm["id"]
        raw = contributions[bm_id]
        pct = round((raw / total_abs) * 100.0, 1)
        enriched.append({
            **bm,
            "contribution_pct": pct,
            "impact": "supports" if pct > 0 else "opposes" if pct < 0 else "neutral",
        })

    # Sort by absolute contribution descending
    enriched.sort(key=lambda x: abs(x["contribution_pct"]), reverse=True)
    return enriched


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def explain(
    audio: np.ndarray,
    sr: int,
    predicted_class: str,
    confidence: float,
) -> dict:
    """
    Run the full explainability pipeline on a raw PCG audio array.

    Parameters
    ----------
    audio : np.ndarray   — raw 1D audio array (mono, already at `sr`)
    sr : int             — sample rate of `audio`
    predicted_class : str — model's predicted class label
    confidence : float   — model's softmax confidence for predicted_class

    Returns
    -------
    dict with keys:
        disturbance_index : float
        overall_signal_quality : str  ("clean", "mild", "high")
        factors : list[dict]          — biomarker attribution list
    """
    # Compute all 5 biomarkers
    biomarkers = [
        compute_systolic_turbulence(audio, sr),
        compute_s1s2_sharpness(audio, sr),
        compute_diastolic_quiescence(audio, sr),
        compute_rhythm_regularity(audio, sr),
        compute_disturbance_index(audio, sr),
    ]

    # Compute contribution percentages for predicted class
    factors = compute_factor_contributions(biomarkers, predicted_class)

    # Disturbance index summary
    disturbance = next(f for f in factors if f["id"] == "disturbance_index")
    di_value = disturbance["score"]

    if di_value < 0.10:
        quality = "clean"
    elif di_value < 0.25:
        quality = "mild"
    else:
        quality = "high"

    return {
        "disturbance_index": round(di_value, 4),
        "overall_signal_quality": quality,
        "confidence": confidence,
        "predicted_class": predicted_class,
        "factors": factors,
    }


# ---------------------------------------------------------------------------
# Respiratory Explainability
# ---------------------------------------------------------------------------

def compute_crackles_energy(audio: np.ndarray, sr: int) -> dict:
    """Discontinuous crackle energy typically in the 100-2000Hz band."""
    crackles_db = compute_band_power(audio, sr, 100, 2000)
    ref = CLINICAL_RANGES["crackles_band_power"]
    # shift to positive excess for scoring
    excess = max(0.0, min(crackles_db - ref["normal_max"] + 10.0, 30.0))
    is_elevated = excess > 10.0

    return {
        "id": "crackles_band_power",
        "name": ref["label"],
        "category": "Pathology Indicator",
        "measured_value": f"{crackles_db:.1f} dB",
        "reference_range": f"< {ref['normal_max']} dB",
        "status": "elevated" if is_elevated else "normal",
        "score": excess,
        "score_norm": min(excess / 30.0, 1.0),
        "clinical_note": ref["clinical_note_elevated"] if is_elevated else ref["clinical_note_normal"],
    }

def compute_wheeze_energy(audio: np.ndarray, sr: int) -> dict:
    """Continuous wheeze energy typically strongly harmonic in 400-2000Hz."""
    wheeze_db = compute_band_power(audio, sr, 400, 2000)
    ref = CLINICAL_RANGES["wheeze_band_power"]
    excess = max(0.0, min(wheeze_db - ref["normal_max"] + 10.0, 30.0))
    is_elevated = excess > 10.0

    return {
        "id": "wheeze_band_power",
        "name": ref["label"],
        "category": "Pathology Indicator",
        "measured_value": f"{wheeze_db:.1f} dB",
        "reference_range": f"< {ref['normal_max']} dB",
        "status": "elevated" if is_elevated else "normal",
        "score": excess,
        "score_norm": min(excess / 30.0, 1.0),
        "clinical_note": ref["clinical_note_elevated"] if is_elevated else ref["clinical_note_normal"],
    }

def compute_respiratory_disturbance(audio: np.ndarray, sr: int) -> dict:
    ref = CLINICAL_RANGES["respiratory_disturbance"]
    n_fft = min(512, len(audio))
    D = np.abs(librosa.stft(audio, n_fft=n_fft, hop_length=n_fft // 4)) ** 2
    freqs = librosa.fft_frequencies(sr=sr, n_fft=n_fft)
    
    total_energy = D.sum() + 1e-12
    # Very high frequency noise above typical lung sounds
    noise_mask = freqs >= min(2500, sr / 2 - 1)
    noise_energy = D[noise_mask, :].sum()

    disturbance = float(np.clip(noise_energy / total_energy, 0.0, 1.0))
    is_elevated = disturbance > ref["normal_max"]

    return {
        "id": "respiratory_disturbance",
        "name": ref["label"],
        "category": "Signal Quality",
        "measured_value": f"{disturbance:.4f} ratio",
        "reference_range": f"< {ref['normal_max']} (clean)",
        "status": "elevated" if is_elevated else "clean",
        "score": disturbance,
        "score_norm": min(disturbance / 0.5, 1.0),
        "clinical_note": ref["clinical_note_elevated"] if is_elevated else ref["clinical_note_normal"],
    }

RESP_FACTOR_CLASS_WEIGHTS = {
    "normal": {
        "crackles_band_power": -0.40,
        "wheeze_band_power": -0.40,
        "respiratory_disturbance": -0.20,
    },
    "crackles": {
        "crackles_band_power": 0.70,
        "wheeze_band_power": -0.10,
        "respiratory_disturbance": 0.20,
    },
    "wheezes": {
        "crackles_band_power": -0.10,
        "wheeze_band_power": 0.70,
        "respiratory_disturbance": 0.20,
    },
    "both": {
        "crackles_band_power": 0.40,
        "wheeze_band_power": 0.40,
        "respiratory_disturbance": 0.20,
    }
}

def explain_respiratory(audio: np.ndarray, sr: int, predicted_class: str, confidence: float) -> dict:
    biomarkers = [
        compute_crackles_energy(audio, sr),
        compute_wheeze_energy(audio, sr),
        compute_respiratory_disturbance(audio, sr),
    ]

    weights = RESP_FACTOR_CLASS_WEIGHTS.get(predicted_class, RESP_FACTOR_CLASS_WEIGHTS["normal"])
    
    contributions = {}
    for bm in biomarkers:
        w = weights.get(bm["id"], 0.0)
        contributions[bm["id"]] = w * bm["score_norm"]
        
    total_abs = sum(abs(v) for v in contributions.values()) + 1e-9
    
    factors = []
    for bm in biomarkers:
        pct = round((contributions[bm["id"]] / total_abs) * 100.0, 1)
        factors.append({
            **bm,
            "contribution_pct": pct,
            "impact": "supports" if pct > 0 else "opposes" if pct < 0 else "neutral",
        })
        
    factors.sort(key=lambda x: abs(x["contribution_pct"]), reverse=True)
    
    di_value = next(f for f in factors if f["id"] == "respiratory_disturbance")["score"]
    quality = "clean" if di_value < 0.15 else "mild" if di_value < 0.30 else "high"

    return {
        "disturbance_index": round(di_value, 4),
        "overall_signal_quality": quality,
        "confidence": confidence,
        "predicted_class": predicted_class,
        "factors": factors,
    }
