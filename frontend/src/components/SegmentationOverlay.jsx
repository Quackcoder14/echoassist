import React, { useEffect, useRef, useState } from 'react';
import { Scissors } from 'lucide-react';
import { getSegmentation } from '../api';
import { animate } from 'animejs';

const SEGMENT_CONFIG = {
  S1:       { class: 's1',       label: 'S1 (Mitral/Tricuspid Closure)', color: '#30D158' },
  systole:  { class: 'systole',  label: 'Systole (Ejection Interval)',  color: '#FFD60A' },
  S2:       { class: 's2',       label: 'S2 (Aortic/Pulmonic Closure)', color: '#5AC8FA' },
  diastole: { class: 'diastole', label: 'Diastole (Filling Interval)', color: '#BF5AF2' },
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
      <div className="card" style={{ padding: '20px', textAlign: 'center', fontSize: '13px', color: 'var(--text-3)' }}>
        Segmenting cardiac cycles (S1 / Systole / S2 / Diastole)...
      </div>
    );
  }

  if (!segments || segments.length === 0) return null;

  const duration = totalDuration || (segments[segments.length - 1] ? segments[segments.length - 1][2] : 6.0);
  const activeSegment = segments.find(([_, start, end]) => currentTime >= start && currentTime < end);

  return (
    <div ref={wrapRef} style={{ display: 'flex', flexDirection: 'column', gap: 12, opacity: 0 }}>
      <div className="section-label">
        <div className="step-badge" style={{ background: 'rgba(90,200,250,0.1)', borderColor: 'rgba(90,200,250,0.3)', color: 'var(--teal)' }}>
          <Scissors size={13} />
        </div>
        <div>
          <h2>Cardiac Cycle Segmentation</h2>
          <p>Temporal alignment of S1, Systole, S2, and Diastole cardiac phases</p>
        </div>
      </div>

      <div className="card" style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-3)' }}>
              Phase Tracking
            </span>
            {activeSegment && (
              <span className={`pill pill-${activeSegment[0] === 'S1' ? 'green' : activeSegment[0] === 'systole' ? 'yellow' : activeSegment[0] === 'S2' ? 'amber' : 'purple'}`}>
                {activeSegment[0]} ({activeSegment[1].toFixed(2)}s – {activeSegment[2].toFixed(2)}s)
              </span>
            )}
          </div>
          <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>
            Duration: {duration.toFixed(1)}s
          </span>
        </div>

        <div className="seg-track" style={{ marginBottom: 16 }}>
          {segments.map(([name, start, end], index) => {
            const widthPct = ((end - start) / duration) * 100;
            const isActive = currentTime >= start && currentTime < end;
            const cfg = SEGMENT_CONFIG[name] || SEGMENT_CONFIG.S1;

            return (
              <div
                key={index}
                style={{ width: `${widthPct}%` }}
                className={`seg-block ${cfg.class} ${isActive ? 'active' : ''}`}
                title={`${name}: ${start}s - ${end}s`}
              >
                <span>{name}</span>
              </div>
            );
          })}

          <div
            className="seg-playhead"
            style={{ left: `${Math.min(100, Math.max(0, (currentTime / duration) * 100))}%` }}
          />
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16, fontSize: 11, color: 'var(--text-2)' }}>
          {Object.entries(SEGMENT_CONFIG).map(([key, cfg]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: cfg.color }} />
              <span>{cfg.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
