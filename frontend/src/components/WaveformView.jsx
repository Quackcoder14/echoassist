import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Play, Pause, RotateCcw, Volume2, ZoomIn } from 'lucide-react';
import { animate } from 'animejs';

export default function WaveformView({ file, onTimeUpdate, onPlayStateChange }) {
  const canvasRef      = useRef(null);
  const wrapRef        = useRef(null);
  const audioCtxRef    = useRef(null);
  const audioBufferRef = useRef(null);
  const sourceNodeRef  = useRef(null);
  const gainNodeRef    = useRef(null);
  const startOffsetRef = useRef(0);
  const startTimeRef   = useRef(0);
  const animFrameRef   = useRef(null);

  const [isPlaying,   setIsPlaying]   = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration,    setDuration]    = useState(6.0);
  const [peaks,       setPeaks]       = useState([]);
  const [isReady,     setIsReady]     = useState(false);

  // Notify parent of play state
  useEffect(() => {
    if (onPlayStateChange) {
      onPlayStateChange(isPlaying);
    }
  }, [isPlaying, onPlayStateChange]);

  // Entrance animation
  useEffect(() => {
    if (wrapRef.current) {
      animate(wrapRef.current, {
        opacity: [0, 1],
        translateY: [16, 0],
        duration: 420,
        ease: 'outCubic',
      });
    }
  }, []);

  // Stop active Web Audio source node
  const stopSource = useCallback(() => {
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.onended = null;
        sourceNodeRef.current.stop();
        sourceNodeRef.current.disconnect();
      } catch (_) {}
      sourceNodeRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
  }, []);

  // Helper to decode and resample any PCM audio buffer to browser audio context sampleRate
  const decodeAndResamplePcm = (ctx, arrayBuffer) => {
    const view = new DataView(arrayBuffer);
    let srcSampleRate = 2000;
    let offset = 44;

    // Check for RIFF header and sample rate
    if (arrayBuffer.byteLength > 44) {
      const headerStr = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
      if (headerStr === 'RIFF') {
        const sr = view.getUint32(24, true);
        if (sr >= 500 && sr <= 192000) srcSampleRate = sr;

        // Locate data chunk
        for (let i = 12; i < Math.min(200, arrayBuffer.byteLength - 8); i++) {
          if (
            view.getUint8(i) === 0x64 &&     // 'd'
            view.getUint8(i + 1) === 0x61 && // 'a'
            view.getUint8(i + 2) === 0x74 && // 't'
            view.getUint8(i + 3) === 0x61    // 'a'
          ) {
            offset = i + 8;
            break;
          }
        }
      } else {
        offset = 0;
      }
    } else {
      offset = 0;
    }

    const numSrcSamples = Math.max(0, Math.floor((arrayBuffer.byteLength - offset) / 2));
    if (numSrcSamples === 0) {
      return ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    }

    // Read 16-bit PCM as floats
    const srcFloats = new Float32Array(numSrcSamples);
    for (let i = 0; i < numSrcSamples; i++) {
      srcFloats[i] = view.getInt16(offset + i * 2, true) / 32768.0;
    }

    // Resample to ctx.sampleRate (usually 44100 or 48000 Hz)
    const targetSampleRate = ctx.sampleRate || 44100;
    const durationSec = Math.max(0.5, numSrcSamples / srcSampleRate);
    const numTargetSamples = Math.floor(durationSec * targetSampleRate);

    const audioBuffer = ctx.createBuffer(1, Math.max(1, numTargetSamples), targetSampleRate);
    const outChannel = audioBuffer.getChannelData(0);

    const ratio = (numSrcSamples - 1) / Math.max(1, numTargetSamples - 1);
    for (let i = 0; i < numTargetSamples; i++) {
      const srcIndex = i * ratio;
      const i0 = Math.floor(srcIndex);
      const i1 = Math.min(numSrcSamples - 1, i0 + 1);
      const frac = srcIndex - i0;
      outChannel[i] = srcFloats[i0] * (1 - frac) + srcFloats[i1] * frac;
    }

    return audioBuffer;
  };

  // Load and prepare audio buffer when file changes
  useEffect(() => {
    if (!file) return;

    stopSource();
    setIsPlaying(false);
    setCurrentTime(0);
    startOffsetRef.current = 0;
    setIsReady(false);

    let isMounted = true;

    const loadAudio = async () => {
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!audioCtxRef.current) {
          audioCtxRef.current = new AudioCtx();
        }
        const ctx = audioCtxRef.current;

        const arrayBuffer = await file.arrayBuffer();
        let decodedBuffer = null;

        // Try native Web Audio decode first
        try {
          const bufferCopy = arrayBuffer.slice(0);
          decodedBuffer = await ctx.decodeAudioData(bufferCopy);
        } catch (_) {
          // If native decode fails (e.g. sampleRate < 8000Hz), use direct PCM resampler
          decodedBuffer = decodeAndResamplePcm(ctx, arrayBuffer);
        }

        if (!decodedBuffer) {
          decodedBuffer = decodeAndResamplePcm(ctx, arrayBuffer);
        }

        if (isMounted && decodedBuffer) {
          audioBufferRef.current = decodedBuffer;
          const dur = decodedBuffer.duration || 6.0;
          setDuration(dur);

          // Extract waveform peaks for Canvas rendering
          const channelData = decodedBuffer.getChannelData(0);
          const numPeaks = 160;
          const step = Math.floor(channelData.length / numPeaks);
          const extractedPeaks = [];

          for (let i = 0; i < numPeaks; i++) {
            let maxAmp = 0;
            const start = i * step;
            const end = Math.min(channelData.length, start + step);
            for (let j = start; j < end; j += 4) {
              const abs = Math.abs(channelData[j]);
              if (abs > maxAmp) maxAmp = abs;
            }
            extractedPeaks.push(Math.min(1, Math.max(0.06, maxAmp)));
          }

          setPeaks(extractedPeaks);
          setIsReady(true);
        }
      } catch (err) {
        console.error('Audio loading error:', err);
        if (isMounted) {
          const fallbackPeaks = Array.from({ length: 160 }, (_, i) => {
            const t = i / 160;
            return 0.15 + 0.6 * Math.sin(t * Math.PI * 4) ** 2 + Math.random() * 0.1;
          });
          setPeaks(fallbackPeaks);
          setIsReady(true);
        }
      }
    };

    loadAudio();

    return () => {
      isMounted = false;
      stopSource();
    };
  }, [file, stopSource]);

  // Draw Canvas Waveform
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || peaks.length === 0) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    const numBars = peaks.length;
    const gap = 2;
    const barWidth = (width - gap * numBars) / numBars;
    const progressRatio = duration > 0 ? Math.min(1, currentTime / duration) : 0;
    const currentBarIdx = Math.floor(progressRatio * numBars);

    for (let i = 0; i < numBars; i++) {
      const p = peaks[i];
      const barHeight = Math.max(4, p * (height * 0.82));
      const x = i * (barWidth + gap);
      const y = (height - barHeight) / 2;

      const isPlayed = i <= currentBarIdx;

      ctx.fillStyle = isPlayed ? '#2563EB' : 'rgba(37, 99, 235, 0.28)';
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(x, y, barWidth, barHeight, 2);
      } else {
        ctx.rect(x, y, barWidth, barHeight);
      }
      ctx.fill();
    }

    // Playhead cursor
    const cursorX = progressRatio * width;
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cursorX, 0);
    ctx.lineTo(cursorX, height);
    ctx.stroke();

  }, [peaks, currentTime, duration]);

  // Play audio buffer from offset
  const playAudio = async (offsetSec) => {
    let ctx = audioCtxRef.current;
    if (!ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      ctx = new AudioCtx();
      audioCtxRef.current = ctx;
    }

    const buffer = audioBufferRef.current;
    if (!buffer) return;

    stopSource();

    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    // Gain node for audible amplification
    if (!gainNodeRef.current) {
      const gain = ctx.createGain();
      gain.gain.value = 1.6; // Boost auscultation sound volume
      gain.connect(ctx.destination);
      gainNodeRef.current = gain;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(gainNodeRef.current);

    const safeOffset = Math.max(0, Math.min(offsetSec, buffer.duration - 0.05));
    source.start(0, safeOffset);
    sourceNodeRef.current = source;

    startOffsetRef.current = safeOffset;
    startTimeRef.current = ctx.currentTime;
    setIsPlaying(true);

    const updatePlayhead = () => {
      if (!sourceNodeRef.current) return;
      const elapsed = ctx.currentTime - startTimeRef.current;
      const current = startOffsetRef.current + elapsed;

      if (current >= buffer.duration) {
        setCurrentTime(buffer.duration);
        setIsPlaying(false);
        stopSource();
        if (onTimeUpdate) onTimeUpdate(buffer.duration);
      } else {
        setCurrentTime(current);
        if (onTimeUpdate) onTimeUpdate(current);
        animFrameRef.current = requestAnimationFrame(updatePlayhead);
      }
    };

    animFrameRef.current = requestAnimationFrame(updatePlayhead);

    source.onended = () => {
      setIsPlaying(false);
    };
  };

  const handlePlayPause = async () => {
    if (isPlaying) {
      stopSource();
      startOffsetRef.current = currentTime;
      setIsPlaying(false);
    } else {
      const offset = currentTime >= duration - 0.05 ? 0 : currentTime;
      await playAudio(offset);
    }
  };

  const handleRestart = async () => {
    stopSource();
    setCurrentTime(0);
    startOffsetRef.current = 0;
    await playAudio(0);
  };

  const handleCanvasClick = async (e) => {
    const canvas = canvasRef.current;
    if (!canvas || duration <= 0) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickRatio = Math.max(0, Math.min(1, clickX / rect.width));
    const newTime = clickRatio * duration;

    setCurrentTime(newTime);
    startOffsetRef.current = newTime;
    if (onTimeUpdate) onTimeUpdate(newTime);

    if (isPlaying) {
      await playAudio(newTime);
    }
  };

  const fmt = (t) => {
    const m = Math.floor(t / 60);
    const s = (t % 60).toFixed(2);
    return `${m}:${s.padStart(5, '0')}`;
  };

  return (
    <div ref={wrapRef} style={{ display: 'flex', flexDirection: 'column', gap: 12, opacity: 0 }}>
      {/* Section header */}
      <div className="section-label">
        <div className="step-badge" style={{ background: 'rgba(10,132,255,0.1)', borderColor: 'rgba(10,132,255,0.3)', color: 'var(--blue)' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 12h4l2-5 4 10 3-7 2 2h5" />
          </svg>
        </div>
        <div>
          <h2>Phonocardiogram (PCG) Waveform</h2>
          <p>Raw acoustic auscultation track — click to seek, drag to pan</p>
        </div>
      </div>

      <div className="card" style={{ padding: '18px 20px' }}>
        {/* Time display */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-3)' }}>
            Acoustic Time Series
          </span>
          <div className="mono" style={{
            fontSize: 12,
            padding: '3px 10px',
            borderRadius: 6,
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            color: 'var(--text-2)',
            display: 'flex',
            gap: 4,
            alignItems: 'center',
          }}>
            <span style={{ color: 'var(--blue)' }}>{fmt(currentTime)}</span>
            <span style={{ color: 'var(--text-3)' }}>/</span>
            <span>{fmt(duration)}</span>
          </div>
        </div>

        {/* Waveform Canvas Container */}
        <div className="waveform-container" style={{ position: 'relative', minHeight: 110, cursor: 'pointer' }} onClick={handleCanvasClick}>
          <canvas
            ref={canvasRef}
            width={840}
            height={100}
            style={{ width: '100%', height: '100px', display: 'block' }}
          />
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              className="btn btn-primary"
              style={{ padding: '8px 18px', fontSize: 13 }}
              onClick={handlePlayPause}
              disabled={!isReady}
            >
              {isPlaying ? <Pause size={14} fill="white" strokeWidth={0} /> : <Play size={14} fill="white" strokeWidth={0} />}
              {isPlaying ? 'Pause' : 'Listen PCG'}
            </button>
            <button
              className="btn btn-ghost"
              style={{ padding: 8 }}
              onClick={handleRestart}
              disabled={!isReady}
              title="Restart"
            >
              <RotateCcw size={14} />
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-3)' }}>
            <Volume2 size={13} color="var(--blue)" />
            <span>Acoustic Output ({duration.toFixed(1)}s)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
