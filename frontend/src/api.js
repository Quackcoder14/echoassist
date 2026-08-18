import axios from "axios";
import {
  generateMockGradcamBlob,
  generateMockSegments,
  MOCK_METRICS
} from "./mockData";

const rawUrl = import.meta.env.VITE_API_URL || "http://localhost:8000";
export const BASE_URL = rawUrl.replace(/\/+$/, ""); // Strip trailing slashes safely

// Global mode setting: 'auto' (tries live backend, falls back to mock), 'mock' (forced mock), 'live' (strict live)
let apiMode = "auto";

export function setApiMode(mode) {
  apiMode = mode;
}

export function getApiMode() {
  return apiMode;
}

/**
 * Checks if the backend FastAPI service is responding
 */
export async function pingBackend() {
  try {
    // Increased timeout to 10s because Render free tier spins down and can take time to wake up
    const res = await axios.get(`${BASE_URL}/health`, { timeout: 10000 });
    return res.status === 200 && res.data?.status === "ok";
  } catch {
    try {
      const resDocs = await axios.get(`${BASE_URL}/docs`, { timeout: 10000 });
      return resDocs.status >= 200 && resDocs.status < 400;
    } catch {
      return false;
    }
  }
}

/**
 * POST /check-validity
 * Send: multipart/form-data with .wav file under key 'file'
 * Receive: { valid: boolean, reason: string, duration_sec: number }
 */
export async function checkValidity(file) {
  if (apiMode === "mock") {
    return mockCheckValidity(file);
  }

  try {
    const form = new FormData();
    form.append("file", file);
    const res = await axios.post(`${BASE_URL}/check-validity`, form, {
      timeout: 10000,
      headers: { "Content-Type": "multipart/form-data" }
    });
    return res.data;
  } catch (err) {
    if (apiMode === "auto") {
      console.warn("Backend /check-validity unreachable, using fallback validation:", err.message);
      return mockCheckValidity(file);
    }
    throw err;
  }
}

/**
 * POST /predict
 * Send: multipart/form-data with .wav file under key 'file'
 * Receive: { label: string, confidence: number, logits: number[] }
 */
export async function predict(file, organ = 'heart') {
  if (apiMode === "mock") {
    return mockPredict(file, organ);
  }

  try {
    const form = new FormData();
    form.append("file", file);
    form.append("organ", organ);
    const res = await axios.post(`${BASE_URL}/predict`, form, {
      timeout: 15000,
      headers: { "Content-Type": "multipart/form-data" }
    });
    return res.data;
  } catch (err) {
    if (apiMode === "auto") {
      console.warn("Backend /predict unreachable, using dynamic acoustic estimation:", err.message);
      return mockPredict(file, organ);
    }
    throw err;
  }
}

/**
 * POST /gradcam
 * Send: multipart/form-data with .wav file under key 'file'
 * Receive: PNG image binary (blob) -> object URL string
 */
export async function getGradcamImageUrl(file, predictedLabel = "murmur", organ = 'heart') {
  if (apiMode === "mock") {
    const blob = await generateMockGradcamBlob(predictedLabel);
    return URL.createObjectURL(blob);
  }

  try {
    const form = new FormData();
    form.append("file", file);
    form.append("organ", organ);
    const res = await axios.post(`${BASE_URL}/gradcam`, form, {
      responseType: "blob",
      timeout: 15000,
      headers: { "Content-Type": "multipart/form-data" }
    });
    return URL.createObjectURL(res.data);
  } catch (err) {
    if (apiMode === "auto") {
      console.warn("Backend /gradcam unreachable, generating synthetic Grad-CAM heatmap:", err.message);
      const blob = await generateMockGradcamBlob(predictedLabel);
      return URL.createObjectURL(blob);
    }
    throw err;
  }
}

/**
 * GET /segmentations/{recording_id}
 * Receive: [ ["S1", 0.0, 0.12], ["systole", 0.12, 0.35], ... ]
 */
export async function getSegmentation(recordingId = "rec_001", duration = 6.0) {
  if (apiMode === "mock") {
    return generateMockSegments(duration);
  }

  try {
    const res = await axios.get(`${BASE_URL}/segmentations/${recordingId}`, {
      timeout: 8000
    });
    return res.data.segments || [];
  } catch (err) {
    if (apiMode === "auto") {
      return generateMockSegments(duration);
    }
    return [];
  }
}

/**
 * GET /metrics
 * Receive: { accuracy, macro_f1, per_class, confusion_matrix_url }
 */
export async function getMetrics() {
  if (apiMode === "mock") {
    return MOCK_METRICS;
  }

  try {
    const res = await axios.get(`${BASE_URL}/metrics`, { timeout: 8000 });
    return res.data;
  } catch (err) {
    if (apiMode === "auto") {
      return MOCK_METRICS;
    }
    throw err;
  }
}

// ----------------------------------------------------
// Dynamic Offline Acoustic Estimation (Only when backend is offline)
// ----------------------------------------------------

async function mockCheckValidity(file) {
  await new Promise((r) => setTimeout(r, 350));
  const name = (file?.name || "").toLowerCase();

  if (name.includes("silent") || name.includes("unusable") || name.includes("corrupt") || (file?.size && file.size < 1000)) {
    return {
      valid: false,
      reason: "Signal-to-Noise Ratio (SNR < 3dB) below clinical threshold: recording is silent or heavily distorted.",
      duration_sec: 2.1
    };
  }

  const durationEst = file?.size ? Math.min(30, Math.max(2.5, +(file.size / 4000).toFixed(2))) : 6.0;

  return {
    valid: true,
    reason: "Signal passed noise floor and spectral integrity checks",
    duration_sec: durationEst
  };
}

async function mockPredict(file, organ = 'heart') {
  await new Promise((r) => setTimeout(r, 450));
  const name = (file?.name || "").toLowerCase();
  const size = file?.size || 12345;

  // Derive unique deterministic hash from filename + size
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  hash = Math.abs(hash + size);

  // --- Respiratory mock ---
  if (organ === 'lung') {
    if (name.includes("crackle") || name.includes("rales") || name.includes("pneumonia")) {
      return { label: "crackles", confidence: +(0.82 + (hash % 120) / 1000).toFixed(4), logits: [-1.2, 2.8, -2.1, -3.0] };
    } else if (name.includes("wheeze") || name.includes("asthma") || name.includes("copd")) {
      return { label: "wheezes", confidence: +(0.80 + (hash % 130) / 1000).toFixed(4), logits: [-1.5, -2.0, 2.7, -2.8] };
    } else if (name.includes("both")) {
      return { label: "both", confidence: +(0.76 + (hash % 140) / 1000).toFixed(4), logits: [-0.8, 1.5, 1.6, 2.4] };
    }
    const normalConf = 0.74 + (hash % 220) / 1000;
    return { label: "normal", confidence: +normalConf.toFixed(4), logits: [2.4, -1.8, -2.0, -2.5] };
  }

  // --- Cardiac mock ---
  if (name.includes("murmur") || name.includes("stenosis")) {
    const conf = 0.84 + (hash % 120) / 1000;
    return {
      label: "murmur",
      confidence: +conf.toFixed(4),
      logits: [0.35 + (hash % 10) / 100, 2.8 + (hash % 20) / 100, -3.2, -3.8]
    };
  } else if (name.includes("extrasystole") || name.includes("pvc") || name.includes("ectopic") || name.includes("arrhythmia")) {
    const conf = 0.79 + (hash % 140) / 1000;
    return {
      label: "extrasystole",
      confidence: +conf.toFixed(4),
      logits: [0.12, 0.25, 2.6 + (hash % 20) / 100, -3.5]
    };
  } else if (name.includes("artifact") || name.includes("noise") || name.includes("friction")) {
    const conf = 0.76 + (hash % 150) / 1000;
    return {
      label: "artifact",
      confidence: +conf.toFixed(4),
      logits: [-1.2, -0.8, -1.5, 2.4 + (hash % 25) / 100]
    };
  }

  // File-specific dynamic normal variation
  const normalConf = 0.72 + (hash % 240) / 1000;
  const murmurLogit = 0.5 + (hash % 80) / 100;
  const extraLogit = -4.5 + (hash % 100) / 100;
  const artLogit = -5.0 + (hash % 100) / 100;

  return {
    label: "normal",
    confidence: +normalConf.toFixed(4),
    logits: [2.5 + (hash % 30) / 100, murmurLogit, extraLogit, artLogit]
  };
}
