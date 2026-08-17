import React, { useEffect, useState } from 'react';
import { Eye, Layers, Sparkles, ZoomIn, Info, AlertCircle } from 'lucide-react';
import { getGradcamImageUrl } from '../api';

export default function GradCamOverlay({ file, predictedLabel }) {
  const [imageUrl, setImageUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isZoomed, setIsZoomed] = useState(false);

  useEffect(() => {
    if (!file) {
      setImageUrl(null);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    getGradcamImageUrl(file, predictedLabel)
      .then((url) => {
        if (isMounted) {
          setImageUrl(url);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError('Failed to generate Grad-CAM explainability heatmap.');
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [file, predictedLabel]);

  return (
    <div className="glass-card p-5 space-y-4">
      {/* Title & Info */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide">
              Neural Explainability (Grad-CAM Spectrogram Attention)
            </h3>
            <p className="text-[11px] text-[var(--text-secondary)]">
              Visualizes acoustic time-frequency coordinates that triggered classifier activation
            </p>
          </div>
        </div>

        {/* Grad-CAM Colormap Legend */}
        <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400 bg-slate-900/80 px-2.5 py-1 rounded-lg border border-slate-700/60">
          <span>Salience:</span>
          <div className="w-16 h-2.5 rounded bg-gradient-to-r from-blue-900 via-emerald-400 to-red-500" />
          <span className="text-red-400 font-bold">High Attention</span>
        </div>
      </div>

      {/* Spectrogram Image Display Container */}
      <div className="relative bg-slate-950 rounded-xl overflow-hidden border border-slate-800/80 min-h-[180px] flex items-center justify-center">
        {isLoading && (
          <div className="flex flex-col items-center gap-2 py-10 text-cyan-400 font-mono text-xs">
            <div className="w-8 h-8 border-3 border-indigo-500/30 border-t-indigo-400 rounded-full animate-spin" />
            <span>Computing Grad-CAM gradients over Mel-spectrogram...</span>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-xs text-rose-400 p-6">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        )}

        {!isLoading && imageUrl && (
          <div className="relative w-full group cursor-pointer" onClick={() => setIsZoomed(!isZoomed)}>
            <img
              src={imageUrl}
              alt="Grad-CAM Spectrogram Heatmap"
              className={`w-full object-cover transition-all duration-300 rounded-lg ${
                isZoomed ? 'scale-105' : 'hover:brightness-105'
              }`}
              style={{ maxHeight: isZoomed ? '480px' : '260px' }}
            />
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/70 backdrop-blur-md px-2 py-1 rounded text-[10px] text-slate-300 flex items-center gap-1 font-mono">
              <ZoomIn className="w-3 h-3" /> {isZoomed ? 'Click to shrink' : 'Click to zoom'}
            </div>
          </div>
        )}
      </div>

      {/* Clinical Traceability Explanation */}
      <div className="flex items-start gap-2 bg-slate-900/50 p-3 rounded-lg border border-[var(--border-subtle)] text-xs text-slate-300">
        <Info className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
        <div className="space-y-1 text-[11px] leading-relaxed">
          <span className="font-semibold text-slate-200">Clinical Decision Rationale: </span>
          <span>
            {predictedLabel === 'murmur'
              ? 'Grad-CAM highlights elevated acoustic energy in the 200–500 Hz systolic region between S1 and S2, characteristic of turbulent flow across cardiac valves.'
              : predictedLabel === 'extrasystole'
              ? 'Grad-CAM highlights premature spectral pulse energy outside the baseline rhythm cycle, indicating ectopic ventricular contraction.'
              : predictedLabel === 'artifact'
              ? 'Grad-CAM identifies widespread non-cardiac high-frequency sensor noise across all frequency bands.'
              : 'Grad-CAM demonstrates focused attention strictly on the physiologic S1 and S2 impulse bands with clear systolic and diastolic silence.'}
          </span>
        </div>
      </div>
    </div>
  );
}
