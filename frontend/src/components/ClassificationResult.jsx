import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, AlertOctagon, Zap, Heart, BarChart2, Activity } from 'lucide-react';
import { animate } from 'animejs';

const CLASS_CONFIG = {
  normal: {
    label:       'Normal Heart Sound',
    description: 'Rhythmic S1/S2 acoustic boundaries with no pathological murmurs detected.',
    tag:         'Physiological Auscultation',
    color:       'var(--green)',
    pillClass:   'pill-green',
    icon:        CheckCircle2,
  },
  murmur: {
    label:       'Cardiac Murmur',
    description: 'High-frequency turbulence during systolic ejection — suggestive of valvular flow anomaly.',
    tag:         'Pathological Auscultation',
    color:       'var(--yellow)',
    pillClass:   'pill-yellow',
    icon:        Heart,
  },
  extrasystole: {
    label:       'Extrasystole — PVC',
    description: 'Premature acoustic contraction with interrupted diastolic timing (ventricular ectopy).',
    tag:         'Rhythm Anomaly',
    color:       'var(--purple)',
    pillClass:   'pill-purple',
    icon:        Zap,
  },
  artifact: {
    label:       'Acoustic Artifact',
    description: 'High ambient noise or sensor displacement. Signal quality degraded.',
    tag:         'Low Fidelity',
    color:       'var(--red)',
    pillClass:   'pill-red',
    icon:        AlertOctagon,
  },
};

const RADIUS = 42;
const CIRC   = 2 * Math.PI * RADIUS;

// Compute true softmax probabilities [0, 1] from raw logits
function computeSoftmax(logits) {
  if (!logits || !Array.isArray(logits) || logits.length === 0) return [0.85, 0.15];
  const maxL = Math.max(...logits);
  const exps = logits.map(l => Math.exp(l - maxL));
  const sumE = exps.reduce((a, b) => a + b, 0);
  return exps.map(e => e / sumE);
}

export default function ClassificationResult({ result, isPredicting, isPlayingAudio }) {
  const wrapRef       = useRef(null);
  const barsRef       = useRef(null);
  const ringRef       = useRef(null);
  const animFrameRef  = useRef(null);

  const rawLogits = result?.logits || [2.5, 0.5];
  const activeClassNames = rawLogits.length === 2 ? ['normal', 'murmur'] : ['normal', 'murmur', 'extrasystole', 'artifact'];
  const probs = computeSoftmax(rawLogits);

  const [liveConf, setLiveConf] = useState(null);

  // Entrance animation
  useEffect(() => {
    if (!wrapRef.current || isPredicting) return;
    animate(wrapRef.current, {
      opacity: [0, 1],
      translateY: [20, 0],
      duration: 450,
      ease: 'outCubic',
    });
  }, [isPredicting]);

  // Handle static vs oscillating animation loop
  useEffect(() => {
    if (!result || !barsRef.current) return;

    const basePct = result.confidence ?? probs[0];
    const fills = barsRef.current.querySelectorAll('.prob-bar-fill');

    if (isPlayingAudio) {
      // Audio is playing -> run live real-time sinusoidal oscillation
      let startTime = performance.now();

      const loop = (now) => {
        const elapsed = (now - startTime) / 1000;
        
        // Gentle micro-pulse (cardiac rhythm pacing ~72 bpm, amplitude +-0.8%)
        const wave = Math.sin(elapsed * 4.5) * 0.008 + Math.sin(elapsed * 9.0) * 0.003;
        const currentConf = Math.min(0.99, Math.max(0.05, basePct + wave));
        setLiveConf(currentConf);

        // Modulate stroke dashoffset
        if (ringRef.current) {
          const offset = CIRC - currentConf * CIRC;
          ringRef.current.setAttribute('stroke-dashoffset', offset);
        }

        // Modulate per-class probability bars
        fills.forEach((el, i) => {
          const baseP = probs[i] || 0;
          const barWave = Math.sin(elapsed * 4.5 + i * 1.5) * 0.006;
          const liveP = Math.min(1, Math.max(0.01, baseP + (i === 0 ? barWave : -barWave)));
          el.style.width = `${(liveP * 100).toFixed(1)}%`;
        });

        animFrameRef.current = requestAnimationFrame(loop);
      };

      animFrameRef.current = requestAnimationFrame(loop);

      return () => {
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      };
    } else {
      // Audio stopped -> cancel oscillation and animate back smoothly to static value
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }

      setLiveConf(null);

      fills.forEach((el, i) => {
        animate(el, {
          width: [`${el.style.width || '0%'}`, `${((probs[i] || 0) * 100).toFixed(1)}%`],
          duration: 600,
          delay: i * 60,
          ease: 'outCubic',
        });
      });

      if (ringRef.current) {
        const offset = CIRC - basePct * CIRC;
        animate(ringRef.current, {
          strokeDashoffset: [ringRef.current.getAttribute('stroke-dashoffset') || CIRC, offset],
          duration: 700,
          ease: 'outCubic',
        });
      }
    }
  }, [result, probs, isPlayingAudio]);

  if (isPredicting) {
    return (
      <div className="card" style={{ padding: '32px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        <svg width="40" height="40" viewBox="0 0 40 40">
          <circle cx="20" cy="20" r="16" fill="none" stroke="rgba(123,178,217,0.12)" strokeWidth="3" />
          <circle
            cx="20" cy="20" r="16" fill="none"
            stroke="var(--blue)" strokeWidth="3"
            strokeDasharray="100" strokeDashoffset="60" strokeLinecap="round"
          >
            <animateTransform attributeName="transform" type="rotate" from="0 20 20" to="360 20 20" dur="0.8s" repeatCount="indefinite" />
          </circle>
        </svg>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-2)' }}>
          Evaluating mel-spectrogram through PyTorch CNN...
        </span>
      </div>
    );
  }

  if (!result) return null;

  const labelKey  = (result.label || 'normal').toLowerCase();
  const cfg       = CLASS_CONFIG[labelKey] || CLASS_CONFIG.normal;
  const IconComp  = cfg.icon;
  const activeConf = liveConf ?? (result.confidence ?? probs[0]);
  const confPct   = (activeConf * 100).toFixed(1);

  return (
    <div ref={wrapRef} style={{ display: 'flex', flexDirection: 'column', gap: 12, opacity: 0 }}>
      <div className="section-label" style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="step-badge" style={{ background: 'rgba(78,202,136,0.1)', borderColor: 'rgba(78,202,136,0.3)', color: 'var(--green)' }}>
            <BarChart2 size={13} />
          </div>
          <div>
            <h2>Neural Classification Result</h2>
            <p>3-block CNN Softmax posterior probability & salience scores</p>
          </div>
        </div>

        {isPlayingAudio && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 12px',
            borderRadius: 20,
            background: 'rgba(123, 178, 217, 0.12)',
            border: '1px solid rgba(123, 178, 217, 0.35)',
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--blue)',
          }}>
            <Activity size={13} className="animate-spin" style={{ animationDuration: '2s' }} />
            <span>LIVE AUDITORY PACING</span>
          </div>
        )}
      </div>

      <div className="card" style={{ padding: '32px 36px' }}>
        <div className="grid-2col" style={{ gap: 32, alignItems: 'center' }}>

          {/* Left Column: Predicted Label & Radial Confidence Arc */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              {/* Radial Arc Gauge */}
              <div style={{ position: 'relative', width: 96, height: 96, flexShrink: 0 }}>
                <svg width="96" height="96" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
                  <circle cx="50" cy="50" r={RADIUS} fill="none" stroke="var(--surface-2)" strokeWidth="8" />
                  <circle
                    ref={ringRef}
                    cx="50" cy="50" r={RADIUS}
                    fill="none"
                    stroke={cfg.color}
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={CIRC}
                    strokeDashoffset={CIRC}
                    style={{ transition: isPlayingAudio ? 'none' : 'stroke-dashoffset 0.6s cubic-bezier(0.4, 0, 0.2, 1)' }}
                  />
                </svg>
                <div style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span className="mono font-semibold" style={{ fontSize: 17, color: 'var(--text-1)', lineHeight: 1 }}>
                    {confPct}%
                  </span>
                  <span style={{ fontSize: 9, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 3 }}>
                    Confidence
                  </span>
                </div>
              </div>

              {/* Text Info */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span className={`pill ${cfg.pillClass}`} style={{ fontSize: 11, fontWeight: 600 }}>
                    <IconComp size={11} style={{ marginRight: 4 }} />
                    {cfg.tag}
                  </span>
                </div>
                <h3 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-1)' }}>
                  {cfg.label}
                </h3>
                <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.45, maxWidth: 280 }}>
                  {cfg.description}
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Per-class Softmax Probability Bars */}
          <div ref={barsRef} style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingLeft: 12, borderLeft: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-3)' }}>
                Softmax Class Probabilities
              </span>
              {isPlayingAudio && (
                <span style={{ fontSize: 10, color: 'var(--blue)', fontWeight: 600 }}>
                  Oscillating
                </span>
              )}
            </div>

            {activeClassNames.map((cls, idx) => {
              const itemCfg = CLASS_CONFIG[cls] || CLASS_CONFIG.normal;
              const prob    = probs[idx] ?? 0;
              const probPct = (prob * 100).toFixed(1);
              const isTop   = cls === labelKey;

              return (
                <div key={cls} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: isTop ? 'var(--text-1)' : 'var(--text-3)', fontWeight: isTop ? 600 : 400 }}>
                    <span>{itemCfg.label}</span>
                    <span className="mono">{probPct}%</span>
                  </div>
                  <div style={{ width: '100%', height: 6, borderRadius: 3, background: 'var(--surface-2)', overflow: 'hidden' }}>
                    <div
                      className="prob-bar-fill"
                      style={{
                        height: '100%',
                        width: '0%',
                        borderRadius: 3,
                        background: isTop ? itemCfg.color : 'var(--text-3)',
                        opacity: isTop ? 1 : 0.45,
                        transition: isPlayingAudio ? 'none' : 'width 0.5s ease-out',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </div>
    </div>
  );
}
