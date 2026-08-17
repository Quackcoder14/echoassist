import axios from "axios";
import {
  generateMockGradcamBlob,
  generateMockSegments,
  MOCK_METRICS
} from "./mockData";

export const BASE_URL = "http://localhost:8000";

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
    const res = await axios.get(`${BASE_URL}/docs`, { timeout: 1500 });
    return res.status >= 200 && res.status < 400;
  } catch {
    return false;
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
      timeout: 4000,
      headers: { "Content-Type": "multipart/form-data" }
    });
    return res.data;
  } catch (err) {
    if (apiMode === "auto") {
      console.warn("Backend /check-validity unreachable, using mock validation:", err.message);
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
export async function predict(file) {
  if (apiMode === "mock") {
    return mockPredict(file);
  }

  try {
    const form = new FormData();
    form.append("file", file);
    const res = await axios.post(`${BASE_URL}/predict`, form, {
      timeout: 6000,
      headers: { "Content-Type": "multipart/form-data" }
    });
    return res.data;
  } catch (err) {
    if (apiMode === "auto") {
      console.warn("Backend /predict unreachable, using mock prediction:", err.message);
      return mockPredict(file);
    }
    throw err;
  }
}

/**
 * POST /gradcam
 * Send: multipart/form-data with .wav file under key 'file'
 * Receive: PNG image binary (blob) -> object URL string
 */
export async function getGradcamImageUrl(file, predictedLabel = "murmur") {
  if (apiMode === "mock") {
    const blob = await generateMockGradcamBlob(predictedLabel);
    return URL.createObjectURL(blob);
  }

  try {
    const form = new FormData();
    form.append("file", file);
    const res = await axios.post(`${BASE_URL}/gradcam`, form, {
      responseType: "blob",
      timeout: 8000,
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
      timeout: 4000
    });
    return res.data.segments || [];
  } catch (err) {
    if (apiMode === "auto") {
      console.warn("Backend /segmentations unreachable, generating mock segments:", err.message);
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
    const res = await axios.get(`${BASE_URL}/metrics`, { timeout: 3000 });
    return res.data;
  } catch (err) {
    if (apiMode === "auto") {
      return MOCK_METRICS;
    }
    throw err;
  }
}

// ----------------------------------------------------
// Mock Implementation Handlers
// ----------------------------------------------------

async function mockCheckValidity(file) {
  await new Promise((r) => setTimeout(r, 450)); // realistic latency
  const name = (file?.name || "").toLowerCase();

  // Test edge cases via filename or size
  if (name.includes("silent") || name.includes("unusable") || name.includes("corrupt") || file?.size < 1000) {
    return {
      valid: false,
      reason: "Signal-to-Noise Ratio (SNR < 3dB) below clinical threshold: recording is silent or heavily distorted.",
      duration_sec: 2.1
    };
  }

  return {
    valid: true,
    reason: "ok",
    duration_sec: 6.4
  };
}

async function mockPredict(file) {
  await new Promise((r) => setTimeout(r, 650));
  const name = (file?.name || "").toLowerCase();

  if (name.includes("murmur") || name.includes("stenosis")) {
    return {
      label: "murmur",
      confidence: 0.894,
      logits: [0.04, 0.894, 0.042, 0.024]
    };
  } else if (name.includes("extrasystole") || name.includes("pvc") || name.includes("ectopic")) {
    return {
      label: "extrasystole",
      confidence: 0.821,
      logits: [0.065, 0.071, 0.821, 0.043]
    };
  } else if (name.includes("artifact") || name.includes("noise")) {
    return {
      label: "artifact",
      confidence: 0.768,
      logits: [0.091, 0.052, 0.089, 0.768]
    };
  }

  // Default normal
  return {
    label: "normal",
    confidence: 0.932,
    logits: [0.932, 0.028, 0.022, 0.018]
  };
}
