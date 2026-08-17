import React from 'react';
import { Heart, Activity, AlertOctagon, HelpCircle, CheckCircle2, Zap, BarChart2 } from 'lucide-react';

const CLASS_CONFIG = {
  normal: {
    title: 'Normal Heart Sound',
    description: 'Rhythmic S1/S2 acoustic boundaries with no pathological systolic or diastolic murmurs detected.',
    color: '#10b981', // emerald
    bgClass: 'badge-normal',
    borderClass: 'border-emerald-500/40',
    icon: CheckCircle2,
    clinicalTag: 'Physiological Auscultation'
  },
  murmur: {
    title: 'Cardiac Murmur Detected',
    description: 'High-frequency turbulence identified during systolic ejection interval (suggestive of Aortic/Mitral flow anomaly).',
    color: '#f59e0b', // amber
    bgClass: 'badge-murmur',
    borderClass: 'border-amber-500/40',
    icon: Activity,
    clinicalTag: 'Pathological Auscultation'
  },
  extrasystole: {
    title: 'Extrasystole (Arrhythmia / PVC)',
    description: 'Premature acoustic contraction cycle detected with interrupted diastolic timing.',
    color: '#a855f7', // purple
    bgClass: 'badge-extrasystole',
    borderClass: 'border-purple-500/40',
    icon: Zap,
    clinicalTag: 'Rhythm Anomaly'
  },
  artifact: {
    title: 'Acoustic Artifact / Noise',
    description: 'High ambient noise or sensor displacement detected. Signal degraded by motion or friction.',
    color: '#f43f5e', // rose
    bgClass: 'badge-artifact',
    borderClass: 'border-rose-500/40',
    icon: AlertOctagon,
    clinicalTag: 'Low Fidelity'
  }
};

const CLASS_NAMES = ['normal', 'murmur', 'extrasystole', 'artifact'];

export default function ClassificationResult({ result, isPredicting }) {
  if (isPredicting) {
    return (
      <div className="glass-card p-6 flex flex-col items-center justify-center gap-3 min-h-[220px]">
        <div className="w-10 h-10 border-4 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin" />
        <p className="text-xs font-mono text-cyan-300 animate-pulse">
          Computing neural network logits & confidence scores...
        </p>
      </div>
    );
  }

  if (!result) return null;

  const labelKey = (result.label || 'normal').toLowerCase();
  const config = CLASS_CONFIG[labelKey] || CLASS_CONFIG.normal;
  const IconComponent = config.icon;
  const confidencePct = ((result.confidence || 0.85) * 100).toFixed(1);

  // Parse logits or probabilities
  const logits = result.logits && result.logits.length === 4
    ? result.logits
    : [0.9, 0.05, 0.03, 0.02];

  return (
    <div className={`glass-card p-6 border-l-4 ${config.borderClass} space-y-5`}>
      {/* Classification Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div
            className="p-2.5 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: `${config.color}20`, border: `1px solid ${config.color}40`, color: config.color }}
          >
            <IconComponent className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md font-mono"
                    style={{ backgroundColor: `${config.color}25`, color: config.color }}>
                {config.clinicalTag}
              </span>
              <span className="text-xs text-slate-400">Class: {result.label}</span>
            </div>
            <h2 className="text-xl font-extrabold text-white mt-1">
              {config.title}
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-xl">
              {config.description}
            </p>
          </div>
        </div>

        {/* Confidence Gauge */}
        <div className="flex flex-col items-center justify-center px-4 py-2 rounded-xl bg-slate-900/70 border border-slate-800 flex-shrink-0 min-w-[130px]">
          <span className="text-[10px] uppercase font-mono text-slate-400 font-semibold tracking-wider">
            Confidence
          </span>
          <div className="text-2xl font-black font-mono mt-0.5" style={{ color: config.color }}>
            {confidencePct}%
          </div>
          <div className="w-full bg-slate-800 rounded-full h-1.5 mt-1.5 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${confidencePct}%`, backgroundColor: config.color }}
            />
          </div>
        </div>
      </div>

      {/* Probability / Logits Breakdown */}
      <div className="pt-2 border-t border-[var(--border-subtle)] space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
          <span className="flex items-center gap-1.5">
            <BarChart2 className="w-3.5 h-3.5 text-cyan-400" />
            Softmax Class Probabilities
          </span>
          <span className="text-[11px] text-slate-500">Multiclass Output</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {CLASS_NAMES.map((cls, idx) => {
            const prob = logits[idx] !== undefined ? logits[idx] : 0;
            const probPct = (prob * 100).toFixed(1);
            const isPredicted = cls === labelKey;
            const clsConf = CLASS_CONFIG[cls] || CLASS_CONFIG.normal;

            return (
              <div
                key={cls}
                className={`p-2.5 rounded-lg border transition-all ${
                  isPredicted
                    ? 'bg-slate-800/80 border-slate-600'
                    : 'bg-slate-900/40 border-slate-800/60 opacity-80'
                }`}
              >
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-semibold capitalize text-slate-200">{cls}</span>
                  <span className="font-mono text-[11px]" style={{ color: clsConf.color }}>
                    {probPct}%
                  </span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, Math.max(2, prob * 100))}%`,
                      backgroundColor: clsConf.color
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
