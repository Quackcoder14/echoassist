import React from 'react';
import { Activity, ShieldAlert, Wifi, WifiOff, BarChart3, HeartPulse } from 'lucide-react';

export default function Header({ isBackendLive, apiMode, onToggleMode, onOpenMetrics }) {
  return (
    <header className="border-b border-[var(--border-subtle)] bg-[rgba(9,13,22,0.85)] backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Brand & Identity */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 text-white animate-pulse">
            <HeartPulse className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                EchoAssist
                <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                  PS-S01
                </span>
              </h1>
            </div>
            <p className="text-xs text-[var(--text-secondary)]">
              Intelligent Acoustic Analysis & Clinical Decision Support System
            </p>
          </div>
        </div>

        {/* Disclaimer & Status Tools */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Decision support disclaimer badge */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
            <span>Decision Support Tool • Non-Diagnostic</span>
          </div>

          {/* Backend Status / Mode Toggle */}
          <button
            onClick={onToggleMode}
            title="Click to toggle between Auto/Live and Mock Mode"
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-slate-800/80 hover:bg-slate-700/80 border border-[var(--border-subtle)] text-slate-300 transition-all"
          >
            {isBackendLive ? (
              <>
                <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-300">Live API</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-amber-300">{apiMode === 'mock' ? 'Mock Mode' : 'Offline (Mock Fallback)'}</span>
              </>
            )}
          </button>

          {/* Model Metrics Toggle */}
          <button
            onClick={onOpenMetrics}
            className="btn-secondary text-xs px-3 py-1"
          >
            <BarChart3 className="w-3.5 h-3.5 text-cyan-400" />
            <span>Evaluation Metrics</span>
          </button>
        </div>
      </div>
    </header>
  );
}
