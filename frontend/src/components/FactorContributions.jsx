import React, { useEffect, useRef } from 'react';
import {
  Activity, Volume2, Clock, Waves, ShieldCheck, ShieldAlert,
  TrendingUp, TrendingDown, Minus, Zap, Wind
} from 'lucide-react';
import { animate, stagger } from 'animejs';

const FACTOR_ICONS = {
  systolic_turbulence:   Activity,
  s1s2_sharpness:        Waves,
  diastolic_quiescence:  Clock,
  rhythm_regularity:     Zap,
  disturbance_index:     Wind,
};

const FACTOR_COLORS = {
  systolic_turbulence:   { hue: '#D97706', bg: 'rgba(217, 119, 6, 0.10)', border: 'rgba(217, 119, 6, 0.30)' },
  s1s2_sharpness:        { hue: '#2563EB', bg: 'rgba(37, 99, 235, 0.10)',  border: 'rgba(37, 99, 235, 0.30)' },
  diastolic_quiescence:  { hue: '#7C3AED', bg: 'rgba(124, 58, 237, 0.10)', border: 'rgba(124, 58, 237, 0.30)' },
  rhythm_regularity:     { hue: '#059669', bg: 'rgba(5, 150, 105, 0.10)',   border: 'rgba(5, 150, 105, 0.30)' },
  disturbance_index:     { hue: '#DC2626', bg: 'rgba(220, 38, 38, 0.10)',   border: 'rgba(220, 38, 38, 0.30)' },
};

const QUALITY_CONFIG = {
  clean: { label: 'Clean Acoustic Signal', color: '#059669', bg: 'rgba(5,150,105,0.10)', border: 'rgba(5,150,105,0.30)', Icon: ShieldCheck },
  mild:  { label: 'Mild Sensor Friction',  color: '#D97706', bg: 'rgba(217,119,6,0.10)', border: 'rgba(217,119,6,0.30)', Icon: ShieldAlert },
  high:  { label: 'High Acoustic Disturbance', color: '#DC2626', bg: 'rgba(220,38,38,0.10)', border: 'rgba(220,38,38,0.30)', Icon: ShieldAlert },
};

function DisturbanceGauge({ disturbance = 0, quality = 'clean' }) {
  const cfg = QUALITY_CONFIG[quality] || QUALITY_CONFIG.clean;
  const { Icon } = cfg;
  const pct = Math.min(Math.round(disturbance * 100 * 4), 100); // scale 0–25% -> 0–100%

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '12px 16px',
      borderRadius: 'var(--r-lg)',
      background: cfg.bg,
      border: `1px solid ${cfg.border}`,
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 10,
        background: cfg.bg, border: `1px solid ${cfg.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: cfg.color, flexShrink: 0,
      }}>
        <Icon size={16} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: cfg.color }}>{cfg.label}</span>
          <span className="mono" style={{ fontSize: 11, color: 'var(--text-2)' }}>
            {(disturbance * 100).toFixed(2)}%
          </span>
        </div>
        <div style={{ width: '100%', height: 5, borderRadius: 3, background: 'rgba(15,23,42,0.08)', overflow: 'hidden' }}>
          <div style={{
            width: `${pct}%`,
            height: '100%',
            background: cfg.color,
            borderRadius: 3,
            transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)',
          }} />
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 3 }}>
          Threshold: &lt; 20% (clean) · 20–40% (mild) · &gt; 40% (high)
        </div>
      </div>
    </div>
  );
}

function FactorCard({ factor, maxAbsPct }) {
  const cfg = FACTOR_COLORS[factor.id] || FACTOR_COLORS.disturbance_index;
  const IconComp = FACTOR_ICONS[factor.id] || Activity;

  const absPct = Math.abs(factor.contribution_pct || 0);
  const barWidth = maxAbsPct > 0 ? (absPct / maxAbsPct) * 100 : 0;
  const isSupports = factor.impact === 'supports';
  const isOpposes  = factor.impact === 'opposes';

  return (
    <div className="factor-card" style={{
      background: 'rgba(255,255,255,0.78)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      border: `1px solid ${cfg.border}`,
      borderRadius: 'var(--r-lg)',
      padding: '16px 18px',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      boxShadow: '0 2px 8px rgba(15,23,42,0.03)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8,
            background: cfg.bg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: cfg.hue, flexShrink: 0,
          }}>
            <IconComp size={14} />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1)', lineHeight: 1.3 }}>
              {factor.name}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-3)' }}>{factor.category}</div>
          </div>
        </div>

        {/* Impact badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          {isSupports ? (
            <TrendingUp size={13} color="#059669" />
          ) : isOpposes ? (
            <TrendingDown size={13} color="#DC2626" />
          ) : (
            <Minus size={13} color="var(--text-3)" />
          )}
          <span style={{
            fontSize: 11, fontWeight: 700,
            color: isSupports ? '#059669' : isOpposes ? '#DC2626' : 'var(--text-3)',
          }}>
            {factor.contribution_pct > 0 ? '+' : ''}{factor.contribution_pct?.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Contribution bar */}
      <div>
        <div style={{ width: '100%', height: 4, borderRadius: 3, background: 'rgba(15,23,42,0.08)', overflow: 'hidden' }}>
          <div style={{
            width: `${barWidth}%`,
            height: '100%',
            background: isSupports ? '#059669' : isOpposes ? '#DC2626' : 'var(--text-3)',
            borderRadius: 3,
            transition: 'width 0.7s cubic-bezier(0.4,0,0.2,1)',
          }} />
        </div>
      </div>

      {/* Measured value + reference */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 6 }}>
        <div>
          <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: cfg.hue }}>
            {factor.measured_value}
          </span>
        </div>
        <span style={{ fontSize: 10, color: 'var(--text-3)', textAlign: 'right', maxWidth: 160, lineHeight: 1.3 }}>
          {factor.reference_range}
        </span>
      </div>

      {/* Clinical note */}
      <div style={{
        padding: '8px 10px',
        borderRadius: 8,
        background: 'rgba(15,23,42,0.04)',
        fontSize: 11,
        color: 'var(--text-2)',
        lineHeight: 1.55,
      }}>
        {factor.clinical_note}
      </div>
    </div>
  );
}

export default function FactorContributions({ explanation, predictedClass }) {
  const wrapRef  = useRef(null);

  useEffect(() => {
    if (!wrapRef.current || !explanation) return;
    animate(wrapRef.current.querySelectorAll('.factor-card'), {
      opacity: [0, 1],
      translateY: [14, 0],
      duration: 380,
      delay: stagger(60, { start: 100 }),
      ease: 'outCubic',
    });
  }, [explanation]);

  if (!explanation) return null;

  const { factors = [], disturbance_index = 0, overall_signal_quality = 'clean' } = explanation;
  const maxAbsPct = Math.max(...factors.map(f => Math.abs(f.contribution_pct || 0)), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Section header */}
      <div className="section-label">
        <div className="step-badge" style={{
          background: 'rgba(37,99,235,0.10)',
          borderColor: 'rgba(37,99,235,0.30)',
          color: 'var(--blue)',
        }}>
          <Activity size={13} />
        </div>
        <div>
          <h2>Acoustic Biomarker Attribution</h2>
          <p>5 physiological factors that drove the classification decision</p>
        </div>
      </div>

      {/* Disturbance gauge */}
      <DisturbanceGauge disturbance={disturbance_index} quality={overall_signal_quality} />

      {/* Factor cards */}
      <div ref={wrapRef} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
        {factors.map(factor => (
          <FactorCard key={factor.id} factor={factor} maxAbsPct={maxAbsPct} />
        ))}
      </div>

      {/* Disclaimer */}
      <div style={{
        fontSize: 11,
        color: 'var(--text-3)',
        lineHeight: 1.55,
        padding: '10px 12px',
        borderRadius: 'var(--r-md)',
        background: 'rgba(15,23,42,0.03)',
        border: '1px solid var(--border)',
      }}>
        <strong>Clinical Disclaimer:</strong> These acoustic biomarkers are signal-processing indicators
        and do not constitute a medical diagnosis. Results should be interpreted by a licensed clinician
        in the context of a full patient examination.
      </div>
    </div>
  );
}
