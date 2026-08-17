/**
 * Mock data generator and fallback service for EchoAssist frontend
 * Provides realistic clinical phonocardiogram data, synthetic Grad-CAM heatmaps,
 * S1/S2 segmentation boundaries, and validation edge cases.
 */

// Helper to synthesize a valid in-memory PCM .wav audio blob for preset demos
export function createSyntheticWavBlob(type = 'normal', durationSec = 6.0, sampleRate = 44100) {
  const numSamples = Math.floor(durationSec * sampleRate);
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  // Write WAV header
  const writeString = (offset, string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size
  view.setUint16(20, 1, true);  // AudioFormat (PCM)
  view.setUint16(22, 1, true);  // NumChannels (Mono)
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // ByteRate
  view.setUint16(32, 2, true);  // BlockAlign
  view.setUint16(34, 16, true); // BitsPerSample
  writeString(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  // Synthesize cardiac sound wave
  const bpm = 72;
  const cycleDuration = 60 / bpm; // ~0.833s per heartbeat
  const s1Freq = 65; // Hz low thud
  const s2Freq = 95; // Hz sharper snap

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let sample = 0;

    if (type === 'silent') {
      // Extremely low noise / silence
      sample = (Math.random() - 0.5) * 0.002;
    } else {
      const cycleTime = t % cycleDuration;

      // S1 (first heart sound: "lub" at t = 0 to 0.12s)
      if (cycleTime < 0.12) {
        const env = Math.sin((cycleTime / 0.12) * Math.PI);
        sample += Math.sin(2 * Math.PI * s1Freq * cycleTime) * env * 0.75;
        sample += Math.sin(2 * Math.PI * (s1Freq * 1.5) * cycleTime) * env * 0.25;
      }

      // Systole period (0.12s to 0.35s)
      if (cycleTime >= 0.12 && cycleTime < 0.35) {
        if (type === 'murmur') {
          // Holosystolic / diamond ejection murmur (whooshing high freq noise)
          const systoleProgress = (cycleTime - 0.12) / 0.23;
          const murmurEnv = Math.sin(systoleProgress * Math.PI);
          const murmurNoise = (Math.random() - 0.5) * 0.55;
          const hiss = Math.sin(2 * Math.PI * 340 * cycleTime) * 0.2;
          sample += (murmurNoise + hiss) * murmurEnv;
        }
      }

      // S2 (second heart sound: "dub" at t = 0.35s to 0.45s)
      if (cycleTime >= 0.35 && cycleTime < 0.45) {
        const s2Local = cycleTime - 0.35;
        const env = Math.sin((s2Local / 0.10) * Math.PI);
        sample += Math.sin(2 * Math.PI * s2Freq * s2Local) * env * 0.65;
        sample += Math.sin(2 * Math.PI * (s2Freq * 1.8) * s2Local) * env * 0.3;
      }

      // Extrasystole ectopic beat injection at t ~ 2.5s
      if (type === 'extrasystole' && t > 2.2 && t < 2.5) {
        const ectLocal = t - 2.2;
        const env = Math.sin((ectLocal / 0.3) * Math.PI);
        sample += Math.sin(2 * Math.PI * 110 * ectLocal) * env * 0.9;
        sample += (Math.random() - 0.5) * 0.3 * env;
      }

      // Ambient clinical acoustic background noise
      sample += (Math.random() - 0.5) * 0.03;
    }

    // Clamp and write 16-bit PCM
    sample = Math.max(-1, Math.min(1, sample));
    const pcm16 = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    view.setInt16(offset, pcm16, true);
    offset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

/**
 * Creates a rich synthetic Grad-CAM heatmap overlayed on a Mel-Spectrogram
 * Returns a Promise resolving to a PNG Blob
 */
export function generateMockGradcamBlob(label = 'murmur') {
  return new Promise((resolve) => {
    const width = 800;
    const height = 340;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // 1. Draw dark spectrogram background
    const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
    bgGradient.addColorStop(0, '#0a0f1d');
    bgGradient.addColorStop(1, '#05070e');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    // 2. Draw Mel-spectrogram frequency bins & background texture
    const numCols = 160;
    const numRows = 60;
    const cellW = width / numCols;
    const cellH = height / numRows;

    for (let c = 0; c < numCols; c++) {
      const timeSec = (c / numCols) * 6.0;
      const cycleTime = timeSec % 0.833;

      for (let r = 0; r < numRows; r++) {
        const freqNorm = 1 - r / numRows; // 0 = low freq (bottom), 1 = high freq (top)
        let intensity = 0.05 + Math.random() * 0.08;

        // S1 energy (low freq, early in cycle)
        if (cycleTime < 0.14 && freqNorm < 0.35) {
          intensity += Math.sin((cycleTime / 0.14) * Math.PI) * (1 - freqNorm / 0.35) * 0.7;
        }

        // S2 energy (medium-low freq, middle of cycle)
        if (cycleTime >= 0.34 && cycleTime < 0.46 && freqNorm < 0.45) {
          intensity += Math.sin(((cycleTime - 0.34) / 0.12) * Math.PI) * (1 - freqNorm / 0.45) * 0.6;
        }

        // Murmur energy (mid-range frequencies 200-600Hz during systole)
        if (label === 'murmur' && cycleTime >= 0.14 && cycleTime < 0.34) {
          if (freqNorm > 0.15 && freqNorm < 0.65) {
            const midFreqDist = 1 - Math.abs(freqNorm - 0.4) / 0.25;
            intensity += Math.sin(((cycleTime - 0.14) / 0.20) * Math.PI) * midFreqDist * 0.75;
          }
        }

        // Extrasystole burst
        if (label === 'extrasystole' && timeSec > 2.1 && timeSec < 2.6) {
          intensity += Math.sin(((timeSec - 2.1) / 0.5) * Math.PI) * (1 - freqNorm) * 0.85;
        }

        intensity = Math.min(1, Math.max(0, intensity));

        // Mel colormap (deep purple/blue to teal)
        const red = Math.floor(intensity * 30);
        const green = Math.floor(intensity * 120 + 20);
        const blue = Math.floor(intensity * 200 + 40);
        ctx.fillStyle = `rgba(${red}, ${green}, ${blue}, 0.85)`;
        ctx.fillRect(c * cellW, r * cellH, cellW + 0.5, cellH + 0.5);
      }
    }

    // 3. Draw Grad-CAM Attention Heatmap overlay (Jet colormap / warm glow over peak regions)
    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    const numCycles = Math.floor(6.0 / 0.833);
    for (let i = 0; i < numCycles; i++) {
      const cycleStartSec = i * 0.833;
      let focalX, focalY, radiusX, radiusY, heatWeight;

      if (label === 'murmur') {
        // Focus on systolic murmur window
        const murmurMidSec = cycleStartSec + 0.24;
        focalX = (murmurMidSec / 6.0) * width;
        focalY = height * 0.6; // mid-frequency
        radiusX = width * 0.05;
        radiusY = height * 0.22;
        heatWeight = 0.9;
      } else if (label === 'extrasystole') {
        // High focus on premature beat at 2.4s
        focalX = (2.35 / 6.0) * width;
        focalY = height * 0.7;
        radiusX = width * 0.07;
        radiusY = height * 0.3;
        heatWeight = 0.95;
      } else {
        // Normal focus on S1 & S2 split
        const s1Sec = cycleStartSec + 0.06;
        focalX = (s1Sec / 6.0) * width;
        focalY = height * 0.82;
        radiusX = width * 0.035;
        radiusY = height * 0.18;
        heatWeight = 0.75;
      }

      const grad = ctx.createRadialGradient(focalX, focalY, 0, focalX, focalY, Math.max(radiusX, radiusY) * 1.6);
      grad.addColorStop(0, `rgba(255, 60, 20, ${heatWeight})`);
      grad.addColorStop(0.3, `rgba(255, 180, 0, ${heatWeight * 0.8})`);
      grad.addColorStop(0.6, `rgba(0, 230, 180, ${heatWeight * 0.4})`);
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(focalX, focalY, radiusX * 1.6, radiusY * 1.6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 4. Draw Clinical Grid Lines & Axes Labels
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let s = 1; s <= 6; s++) {
      const x = (s / 6.0) * width;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    for (let f = 1; f < 4; f++) {
      const y = (f / 4) * height;
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();

    // Text labels on canvas
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.fillText('1000 Hz', 8, 16);
    ctx.fillText('500 Hz', 8, height * 0.5);
    ctx.fillText('0 Hz', 8, height - 8);

    ctx.fillText('Grad-CAM Layer: conv2d_salience_map', width - 240, 16);
    ctx.fillText(`Focal Pathological Activation [${label.toUpperCase()}]`, width - 270, 32);

    canvas.toBlob((blob) => {
      resolve(blob);
    }, 'image/png');
  });
}

/**
 * Generates mock S1, Systole, S2, Diastole segments
 */
export function generateMockSegments(duration = 6.0) {
  const segments = [];
  const cycleDuration = 0.833; // ~72 bpm
  let t = 0;

  while (t < duration) {
    const s1End = Math.min(duration, +(t + 0.12).toFixed(2));
    segments.push(['S1', +t.toFixed(2), s1End]);

    if (s1End >= duration) break;
    const sysEnd = Math.min(duration, +(t + 0.35).toFixed(2));
    segments.push(['systole', s1End, sysEnd]);

    if (sysEnd >= duration) break;
    const s2End = Math.min(duration, +(t + 0.46).toFixed(2));
    segments.push(['S2', sysEnd, s2End]);

    if (s2End >= duration) break;
    const diaEnd = Math.min(duration, +(t + cycleDuration).toFixed(2));
    segments.push(['diastole', s2End, diaEnd]);

    t += cycleDuration;
  }

  return segments;
}

/**
 * Mock Model Evaluation Metrics
 */
export const MOCK_METRICS = {
  accuracy: 0.811,
  macro_f1: 0.624,
  per_class: {
    normal:       { precision: 0.797, recall: 0.855, f1: 0.825, support: 505 },
    murmur:       { precision: 0.842, recall: 0.767, f1: 0.803, support: 481 },
    extrasystole: { precision: 0.143, recall: 0.333, f1: 0.200, support: 3 },
    artifact:     { precision: 0.571, recall: 0.800, f1: 0.667, support: 5 }
  },
  confusion_matrix_url: '/static/confusion_matrix.png'
};

/**
 * Preset Samples for instant judge demoing
 */
export const PRESET_SAMPLES = [
  {
    id: 'sample-normal',
    name: 'Normal Heart Sound (PhysioNet A001)',
    type: 'normal',
    expectedLabel: 'normal',
    description: 'Clean S1/S2 lub-dub rhythm, no murmurs detected (SNR > 22 dB)',
    badgeColor: 'emerald'
  },
  {
    id: 'sample-murmur',
    name: 'Systolic Murmur (Aortic Stenosis)',
    type: 'murmur',
    expectedLabel: 'murmur',
    description: 'Crescendo-decrescendo turbulence in 200–500 Hz systolic band',
    badgeColor: 'amber'
  },
  {
    id: 'sample-extrasystole',
    name: 'Premature Ventricular Contraction (PVC)',
    type: 'extrasystole',
    expectedLabel: 'extrasystole',
    description: 'Ectopic early contraction cycle with compensatory pause',
    badgeColor: 'purple'
  },
  {
    id: 'sample-silent',
    name: 'Invalid / Low-SNR Silent Recording',
    type: 'silent',
    expectedLabel: 'unusable',
    description: 'Simulates edge case: amplitude below noise threshold',
    badgeColor: 'rose'
  }
];
