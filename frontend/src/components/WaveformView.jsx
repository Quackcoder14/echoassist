import React, { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { Play, Pause, RotateCcw, Volume2, ZoomIn, Activity } from 'lucide-react';

export default function WaveformView({ file, onTimeUpdate }) {
  const containerRef = useRef(null);
  const wavesurferRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [zoom, setZoom] = useState(50);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current || !file) return;

    // Destroy existing instance if any
    if (wavesurferRef.current) {
      wavesurferRef.current.destroy();
    }

    setIsReady(false);
    setIsPlaying(false);
    setCurrentTime(0);

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: 'rgba(6, 182, 212, 0.45)', // Cyan wave
      progressColor: '#06b6d4',             // Vivid cyan progress
      cursorColor: '#38bdf8',
      cursorWidth: 2,
      height: 120,
      barWidth: 2,
      barGap: 2,
      barRadius: 2,
      normalize: true,
      minPxPerSec: zoom,
      fillParent: true,
      interact: true
    });

    wavesurferRef.current = ws;

    // Load file as Blob URL
    const fileUrl = URL.createObjectURL(file);
    ws.load(fileUrl);

    ws.on('ready', () => {
      setIsReady(true);
      const totalDur = ws.getDuration();
      setDuration(totalDur);
    });

    ws.on('audioprocess', () => {
      const current = ws.getCurrentTime();
      setCurrentTime(current);
      if (onTimeUpdate) onTimeUpdate(current);
    });

    ws.on('seeking', () => {
      const current = ws.getCurrentTime();
      setCurrentTime(current);
      if (onTimeUpdate) onTimeUpdate(current);
    });

    ws.on('play', () => setIsPlaying(true));
    ws.on('pause', () => setIsPlaying(false));
    ws.on('finish', () => setIsPlaying(false));

    return () => {
      URL.revokeObjectURL(fileUrl);
      ws.destroy();
    };
  }, [file]);

  useEffect(() => {
    if (wavesurferRef.current && isReady) {
      wavesurferRef.current.zoom(zoom);
    }
  }, [zoom, isReady]);

  const handlePlayPause = () => {
    if (wavesurferRef.current) {
      wavesurferRef.current.playPause();
    }
  };

  const handleRestart = () => {
    if (wavesurferRef.current) {
      wavesurferRef.current.seekTo(0);
      wavesurferRef.current.play();
    }
  };

  const formatTime = (timeInSec) => {
    const min = Math.floor(timeInSec / 60);
    const sec = (timeInSec % 60).toFixed(2);
    return `${min}:${sec.padStart(5, '0')}`;
  };

  return (
    <div className="glass-card p-5 space-y-4">
      {/* Header Info */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide">Phonocardiogram (PCG) Acoustic Signal</h3>
            <p className="text-[11px] text-[var(--text-secondary)]">Raw auscultation waveform & cardiac cycle track</p>
          </div>
        </div>

        {/* Time Counters */}
        <div className="flex items-center gap-2 font-mono text-xs text-cyan-300 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-700/60">
          <span>{formatTime(currentTime)}</span>
          <span className="text-slate-500">/</span>
          <span className="text-slate-400">{formatTime(duration)}</span>
        </div>
      </div>

      {/* Waveform Container */}
      <div className="relative bg-slate-950/80 rounded-xl p-3 border border-slate-800/80 overflow-hidden">
        {!isReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/70 z-10 text-xs text-cyan-400 font-mono">
            Loading audio waveform...
          </div>
        )}
        <div ref={containerRef} className="w-full" />
      </div>

      {/* Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePlayPause}
            disabled={!isReady}
            className="btn-primary text-xs py-2 px-4"
          >
            {isPlaying ? (
              <>
                <Pause className="w-4 h-4 fill-white" /> Pause
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-white" /> Listen PCG
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleRestart}
            disabled={!isReady}
            className="btn-secondary text-xs p-2"
            title="Restart playback"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Zoom & Navigation Slider */}
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <ZoomIn className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-[11px]">Zoom:</span>
          <input
            type="range"
            min="20"
            max="150"
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-24 accent-cyan-400 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
          />
        </div>
      </div>
    </div>
  );
}
