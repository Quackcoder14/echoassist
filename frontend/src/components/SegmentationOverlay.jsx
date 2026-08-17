import React, { useEffect, useState } from 'react';
import { Clock, Scissors, Info } from 'lucide-react';
import { getSegmentation } from '../api';

const SEGMENT_COLORS = {
  S1: {
    bg: 'bg-emerald-500/30',
    border: 'border-emerald-400/60',
    text: 'text-emerald-300',
    label: 'S1 (Mitral/Tricuspid Closure)'
  },
  systole: {
    bg: 'bg-amber-500/25',
    border: 'border-amber-400/50',
    text: 'text-amber-300',
    label: 'Systole (Ventricular Ejection)'
  },
  S2: {
    bg: 'bg-cyan-500/30',
    border: 'border-cyan-400/60',
    text: 'text-cyan-300',
    label: 'S2 (Aortic/Pulmonic Closure)'
  },
  diastole: {
    bg: 'bg-indigo-500/20',
    border: 'border-indigo-400/40',
    text: 'text-indigo-300',
    label: 'Diastole (Ventricular Filling)'
  }
};

export default function SegmentationOverlay({ file, currentTime = 0, totalDuration = 6.0 }) {
  const [segments, setSegments] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!file) {
      setSegments([]);
      return;
    }

    let isMounted = true;
    setIsLoading(true);

    getSegmentation(file.name || 'rec_001', totalDuration || 6.0)
      .then((data) => {
        if (isMounted) {
          setSegments(data || []);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setSegments([]);
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [file, totalDuration]);

  if (isLoading) {
    return (
      <div className="glass-card p-4 text-xs font-mono text-cyan-400 text-center animate-pulse">
        Segmenting cardiac cycles (S1 / Systole / S2 / Diastole)...
      </div>
    );
  }

  if (!segments || segments.length === 0) {
    return null; // Graceful empty state as specified in harsitaa.md
  }

  // Find active segment based on current audio time
  const activeSegment = segments.find(
    ([_, start, end]) => currentTime >= start && currentTime < end
  );

  const duration = totalDuration || (segments[segments.length - 1] ? segments[segments.length - 1][2] : 6.0);

  return (
    <div className="glass-card p-5 space-y-3.5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-2.5">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-teal-500/10 text-teal-400 border border-teal-500/20">
            <Scissors className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide">
              Cardiac Cycle Segmentation (Springer HMM Pipeline)
            </h3>
            <p className="text-[11px] text-[var(--text-secondary)]">
              Temporal segmentation of S1 (lub), Systole, S2 (dub), and Diastole phases
            </p>
          </div>
        </div>

        {/* Current Active Phase Badge */}
        {activeSegment && (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono bg-slate-900/90 border border-slate-700/80">
            <Clock className="w-3 h-3 text-cyan-400" />
            <span className="text-slate-400">Current:</span>
            <span className="font-bold uppercase text-cyan-300">{activeSegment[0]}</span>
            <span className="text-[10px] text-slate-500">
              ({activeSegment[1]}s–{activeSegment[2]}s)
            </span>
          </div>
        )}
      </div>

      {/* Visual Timeline Track */}
      <div className="relative h-14 bg-slate-950 rounded-xl p-1.5 border border-slate-800/80 overflow-hidden flex">
        {segments.map(([name, start, end], index) => {
          const widthPct = ((end - start) / duration) * 100;
          const config = SEGMENT_COLORS[name] || SEGMENT_COLORS.S1;
          const isActive = currentTime >= start && currentTime < end;

          return (
            <div
              key={index}
              style={{ width: `${widthPct}%` }}
              className={`h-full relative flex items-center justify-center text-[10px] font-mono font-bold uppercase transition-all border-r border-slate-900 ${
                config.bg
              } ${config.text} ${
                isActive ? 'ring-2 ring-white z-10 brightness-125 shadow-lg' : 'opacity-85'
              }`}
              title={`${name}: ${start}s - ${end}s`}
            >
              <span className="truncate px-0.5">{name}</span>
            </div>
          );
        })}

        {/* Current Playhead Indicator */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white shadow-md z-20 pointer-events-none transition-all duration-75"
          style={{ left: `${(currentTime / duration) * 100}%` }}
        />
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-slate-400">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded bg-emerald-500" />
            <span>S1 (lub)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded bg-amber-500" />
            <span>Systole</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded bg-cyan-500" />
            <span>S2 (dub)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded bg-indigo-500" />
            <span>Diastole</span>
          </div>
        </div>
        <span className="text-[10px] font-mono text-slate-500">Duration: {duration.toFixed(1)}s</span>
      </div>
    </div>
  );
}
