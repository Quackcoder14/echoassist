import React from 'react';
import { AlertTriangle, CheckCircle2, ShieldCheck, ShieldX } from 'lucide-react';

export default function ValidityBanner({ validity }) {
  if (!validity) return null;

  if (!validity.valid) {
    return (
      <div className="glass-card border-rose-500/40 bg-rose-950/25 p-4 rounded-xl flex items-start gap-3.5 text-rose-200">
        <div className="p-2 rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/30 flex-shrink-0 mt-0.5">
          <ShieldX className="w-5 h-5" />
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-rose-300 uppercase tracking-wide">
              Acoustic Validation Check Failed — Graceful Halt
            </h3>
            <span className="text-[11px] font-mono bg-rose-900/60 px-2 py-0.5 rounded border border-rose-700/50 text-rose-300">
              Duration: {validity.duration_sec?.toFixed(1) || '0.0'}s
            </span>
          </div>
          <p className="text-xs text-rose-200/90 leading-relaxed">
            {validity.reason || 'Recording failed signal quality checks (silence or heavy artifact). Analysis aborted safely.'}
          </p>
          <div className="text-[11px] text-rose-400/80 pt-1 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>EchoAssist prevents false classification by halting when SNR is insufficient. Please provide a clear recording.</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card border-emerald-500/30 bg-emerald-950/20 p-3 rounded-xl flex items-center justify-between gap-3 text-emerald-200 text-xs">
      <div className="flex items-center gap-2.5">
        <div className="p-1 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
          <ShieldCheck className="w-4 h-4" />
        </div>
        <div>
          <span className="font-semibold text-emerald-300">Acoustic Signal Validated: </span>
          <span className="text-emerald-200/80">Passed SNR noise-floor & spectral integrity checks ({validity.reason})</span>
        </div>
      </div>
      <div className="font-mono text-emerald-400 font-medium bg-emerald-900/40 px-2.5 py-1 rounded-md border border-emerald-700/40">
        Duration: {validity.duration_sec?.toFixed(1) || '0.0'}s
      </div>
    </div>
  );
}
