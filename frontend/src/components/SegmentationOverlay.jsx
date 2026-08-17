import React, { useEffect, useRef, useState } from 'react';
import { Scissors, Activity, Clock, PlayCircle, Sparkles } from 'lucide-react';
import { getSegmentation } from '../api';
import { animate } from 'animejs';

const SEGMENT_CONFIG = {
  S1: {
    name: 'S1',
    laymanName: 'S1 ("Lub" Sound)',
    desc: 'Tricuspid & Mitral valves closing (ventricles start pumping)',
    color: '#10B981', // Original Emerald for text
    barColor: '#D1FAE5', // Near-white Emerald for bar
    bg: 'rgba(16, 185, 129, 0.12)',
    border: 'rgba(16, 185, 129, 0.35)',
    pillClass: 'pill-green',
  },
  systole: {
    name: 'Systole',
    laymanName: 'Systole (Pumping Phase)',
    desc: 'Ventricles contract, pushing blood to body & lungs',
    color: '#F59E0B', // Original Amber for text
    barColor: '#FEF3C7', // Near-white Amber for bar
    bg: 'rgba(245, 158, 11, 0.12)',
    border: 'rgba(245, 158, 11, 0.35)',
    pillClass: 'pill-yellow',
  },
  S2: {
    name: 'S2',
    laymanName: 'S2 ("Dub" Sound)',
    desc: 'Aortic & Pulmonic valves closing (end of contraction)',
    color: '#0EA5E9', // Original Sky for text
    barColor: '#E0F2FE', // Near-white Sky for bar
    bg: 'rgba(14, 165, 233, 0.12)',
    border: 'rgba(14, 165, 233, 0.35)',
    pillClass: 'pill-blue',
  },
  diastole: {
    name: 'Diastole',
    laymanName: 'Diastole (Refilling Phase)',
    desc: 'Heart muscle relaxes and refills with oxygenated blood',
    color: '#8B5CF6', // Original Violet for text
    barColor: '#EDE9FE', // Near-white Violet for bar
    bg: 'rgba(139, 92, 246, 0.12)',
    border: 'rgba(139, 92, 246, 0.35)',
    pillClass: 'pill-purple',
  },
};

export default function SegmentationOverlay({ file, currentTime = 0, totalDuration = 6.0 }) {
  const [segments, setSegments] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const wrapRef = useRef(null);

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

  useEffect(() => {
    if (wrapRef.current && segments.length > 0) {
      animate(wrapRef.current, {
        opacity: [0, 1],
        translateY: [16, 0],
        duration: 420,
        ease: 'outCubic',
      });
    }
  }, [segments]);

  if (isLoading) {
    return (
      <div className="card" style={{ padding: '24px', textAlign: 'center', fontSize: '13px', color: 'var(--text-3)' }}>
        <div style={{ display: 'inline-block', width: 20, height: 20, border: '2px solid rgba(14, 165, 233, 0.2)', borderTopColor: '#0EA5E9', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginRight: 10, verticalAlign: 'middle' }} />
        Mapping clinical Springer HMM heart cycle phases (S1 / Systole / S2 / Diastole)...
      </div>
    );
  }

  if (!segments || segments.length === 0) return null;

  // Compute exact timeline extent so segments span 100% of the bar edge-to-edge
  const maxEnd = segments[segments.length - 1][2] || totalDuration || 6.0;
  const activeSegment = segments.find(([_, start, end]) => currentTime >= start && currentTime < end);
  const activeCfg = activeSegment ? (SEGMENT_CONFIG[activeSegment[0]] || SEGMENT_CONFIG.S1) : null;

  // Calculate cycle statistics
  const s1Count = segments.filter(s => s[0] === 'S1').length;

  return (
    <div ref={wrapRef} style={{ display: 'flex', flexDirection: 'column', gap: 12, opacity: 0 }}>
      {/* Section Header */}
      <div className="section-label" style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="step-badge" style={{ background: 'rgba(14, 165, 233, 0.12)', borderColor: 'rgba(14, 165, 233, 0.35)', color: '#0EA5E9' }}>
            <Scissors size={13} />
          </div>
          <div>
            <h2>Cardiac Cycle Timeline Segmentation</h2>
            <p>Precise temporal timeline of your heart's 4 natural pumping and resting phases</p>
          </div>
        </div>

        {activeSegment && activeCfg && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 12px',
            borderRadius: 'var(--r-md)',
            background: activeCfg.bg,
            border: `1px solid ${activeCfg.border}`,
            fontSize: 11,
            fontWeight: 700,
            color: activeCfg.color,
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: activeCfg.color }} />
            <span>CURRENT: {activeCfg.laymanName}</span>
            <span className="mono" style={{ opacity: 0.85, marginLeft: 2 }}>
              ({activeSegment[1].toFixed(2)}s – {activeSegment[2].toFixed(2)}s)
            </span>
          </div>
        )}
      </div>

      <div className="card" style={{ padding: '32px 36px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        
        {/* Timeline Header Info */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-2)' }}>
              Continuous Cycle Flow
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
              • {s1Count} full cardiac cycles mapped
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="mono" style={{ fontSize: 12, color: 'var(--text-2)', background: 'var(--surface-2)', padding: '3px 9px', borderRadius: 6, border: '1px solid var(--border)' }}>
              <Clock size={11} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
              Total Duration: {maxEnd.toFixed(2)}s
            </span>
          </div>
        </div>

        {/* ─── Full-Width Colored Segmentation Bar (No text inside, spreads 100%) ─── */}
        <div className="seg-track-container">
          <div className="seg-track">
            {segments.map(([name, start, end], index) => {
              const widthPct = ((end - start) / maxEnd) * 100;
              const isActive = currentTime >= start && currentTime < end;
              const cfg = SEGMENT_CONFIG[name] || SEGMENT_CONFIG.S1;

              return (
                <div
                  key={index}
                  className={`seg-block ${name.toLowerCase()} ${isActive ? 'active' : ''}`}
                  style={{
                    width: `${widthPct}%`,
                    backgroundColor: cfg.barColor,
                    borderRight: '1px solid #fff',
                    opacity: 1, // Bar is already near-white, keep it fully opaque for clean look
                  }}
                  title={`${cfg.laymanName}: ${start.toFixed(2)}s to ${end.toFixed(2)}s`}
                />
              );
            })}

            {/* Playhead Marker */}
            <div
              className="seg-playhead"
              style={{
                left: `${Math.min(100, Math.max(0, (currentTime / maxEnd) * 100))}%`,
              }}
            />
          </div>

          {/* Time axis tick markers */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 10, color: 'var(--text-3)' }} className="mono">
            <span>0.0s</span>
            <span>{(maxEnd * 0.25).toFixed(1)}s</span>
            <span>{(maxEnd * 0.50).toFixed(1)}s</span>
            <span>{(maxEnd * 0.75).toFixed(1)}s</span>
            <span>{maxEnd.toFixed(1)}s</span>
          </div>
        </div>

        {/* ─── Nearby Intuitive Phase Legend (Layman's terms) ─── */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 10 }}>
            Phase Legend & What They Mean
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
            {Object.entries(SEGMENT_CONFIG).map(([key, cfg]) => {
              const isPhaseActive = activeSegment && activeSegment[0] === key;

              return (
                <div
                  key={key}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 'var(--r-lg)',
                    background: isPhaseActive ? cfg.bg : 'var(--surface-2)',
                    border: `1.5px solid ${isPhaseActive ? cfg.color : 'var(--border)'}`,
                    boxShadow: isPhaseActive ? `0 4px 14px ${cfg.bg}` : 'none',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      backgroundColor: cfg.color,
                      boxShadow: `0 0 6px ${cfg.color}`,
                      flexShrink: 0,
                    }} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>
                      {cfg.laymanName}
                    </span>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text-2)', lineHeight: 1.45 }}>
                    {cfg.desc}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
