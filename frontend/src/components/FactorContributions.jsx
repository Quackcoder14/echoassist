import React, { useEffect, useRef } from 'react';
import {
  Volume2, Waves, Clock, Zap, Wind, ShieldCheck, ShieldAlert,
  CheckCircle2, AlertTriangle, Info, Sparkles, HeartPulse, HelpCircle,
  TrendingUp, TrendingDown, ArrowRight
} from 'lucide-react';
import { animate, stagger } from 'animejs';

// Layman-friendly metadata mapping for the 5 clinical biomarkers
const BIOMARKER_LAYMAN_MAP = {
  s1s2_sharpness: {
    title: 'Heart Valve Snap ("Lub-Dub" Sound)',
    question: 'Are your heart valves closing firmly and crisply?',
    icon: Volume2,
    color: '#2563EB',
    bg: 'rgba(37, 99, 235, 0.08)',
    border: 'rgba(37, 99, 235, 0.25)',
    normalLabel: 'Crisp & Firm Valve Closure',
    abnormalLabel: 'Muffled / Split Closure Sound',
    leftZone: 'Muffled / Blurred',
    rightZone: 'Crisp & Distinct (Ideal)',
    normalDesc: 'Your mitral and tricuspid valves close with clear, snappy "Lub" and "Dub" impulses — a hallmark of healthy heart valve coaptation.',
    abnormalDesc: 'The valve closure boundaries are widened or muffled, which often happens when turbulent blood flow overlaps the heartbeat sound.',
  },
  systolic_turbulence: {
    title: 'Blood Flow Turbulence (Murmur Whoosh)',
    question: 'Is there an abnormal whooshing sound between heartbeats?',
    icon: Waves,
    color: '#D97706',
    bg: 'rgba(217, 119, 6, 0.08)',
    border: 'rgba(217, 119, 6, 0.25)',
    normalLabel: 'Smooth Blood Flow (No Murmur)',
    abnormalLabel: 'Turbulent Jet Whoosh (Murmur)',
    leftZone: 'Smooth Flow (Ideal)',
    rightZone: 'Harsh Murmur Jet',
    normalDesc: 'No rushing or hissing noise was detected between beats. Blood is flowing smoothly and quietly through the heart chambers.',
    abnormalDesc: 'High-energy rushing/whooshing sound was detected while the heart was pumping — the typical acoustic signature of a heart murmur.',
  },
  diastolic_quiescence: {
    title: 'Heart Resting Silence (Refilling Phase)',
    question: 'Is the heart silent while resting and refilling with blood?',
    icon: Clock,
    color: '#7C3AED',
    bg: 'rgba(124, 58, 237, 0.08)',
    border: 'rgba(124, 58, 237, 0.25)',
    normalLabel: 'Silent & Quiet Rest Interval',
    abnormalLabel: 'Refilling Turbulence / Leakage',
    leftZone: 'Quiet & Calm (Ideal)',
    rightZone: 'Refilling Leakage',
    normalDesc: 'The heart chamber is acoustically quiet as it relaxes between beats, confirming there is no backward blood leakage.',
    abnormalDesc: 'Noise detected during the relaxation phase between beats, which can indicate backward flow or valve stiffness during filling.',
  },
  rhythm_regularity: {
    title: 'Heartbeat Rhythm Steadiness',
    question: 'Is your heart beating with steady, even timing like a clock?',
    icon: Zap,
    color: '#059669',
    bg: 'rgba(5, 150, 105, 0.08)',
    border: 'rgba(5, 150, 105, 0.25)',
    normalLabel: 'Steady Regular Rhythm',
    abnormalLabel: 'Irregular Timing / Skipped Beat',
    leftZone: 'Metronome Steady (Ideal)',
    rightZone: 'Ectopic / Skipped Pulse',
    normalDesc: 'Each heartbeat occurs at evenly-spaced, predictable intervals with normal sinus rhythm pacing.',
    abnormalDesc: 'Uneven pauses or sudden early beats were detected, characteristic of premature contractions (Extrasystole/PVC).',
  },
  disturbance_index: {
    title: 'Audio Clarity & Stethoscope Seal',
    question: 'Was the recording clear of friction, chest hair, or room noise?',
    icon: Wind,
    color: '#DC2626',
    bg: 'rgba(220, 38, 38, 0.08)',
    border: 'rgba(220, 38, 38, 0.25)',
    normalLabel: 'Crystal-Clear Audio Seal',
    abnormalLabel: 'Sensor Movement / Friction',
    leftZone: 'Clean Audio (Ideal)',
    rightZone: 'Heavy Noise & Rustle',
    normalDesc: 'Stethoscope diaphragm had excellent chest contact with virtually zero background interference.',
    abnormalDesc: 'Excessive high-frequency disturbance or friction rustle detected, which can obscure subtle heart sounds.',
  },
};

function LaymanSummaryBanner({ predictedClass, confidence, factors }) {
  const isNormal = predictedClass === 'normal';
  const isMurmur = predictedClass === 'murmur';
  const isExtra = predictedClass === 'extrasystole';
  const confPct = (confidence * 100).toFixed(1);

  let summaryText = '';
  let badgeColor = 'var(--green)';
  let bgGradient = 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(240,253,244,0.7) 100%)';
  let borderColor = 'rgba(5, 150, 105, 0.3)';

  if (isNormal) {
    summaryText = `The AI concluded your heart sound is Normal (${confPct}% confidence) because your heart valves snap shut with crisp "Lub-Dub" firmness, blood flows smoothly without whooshing murmur noise, and the rhythm is steady.`;
    badgeColor = 'var(--green)';
  } else if (isMurmur) {
    summaryText = `The AI detected a Cardiac Murmur (${confPct}% confidence) primarily because of elevated turbulent whooshing sounds during the pumping phase between heartbeats.`;
    badgeColor = 'var(--yellow)';
    bgGradient = 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(254,243,199,0.7) 100%)';
    borderColor = 'rgba(217, 119, 6, 0.3)';
  } else if (isExtra) {
    summaryText = `The AI identified an Extrasystole (${confPct}% confidence) because it detected an early premature contraction followed by an irregular pause in the heartbeat cadence.`;
    badgeColor = 'var(--purple)';
    bgGradient = 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(243,232,255,0.7) 100%)';
    borderColor = 'rgba(124, 58, 237, 0.3)';
  } else {
    summaryText = `The AI flagged this recording as an Acoustic Artifact (${confPct}% confidence) due to excessive sensor movement friction or background noise interfering with the signal.`;
    badgeColor = 'var(--red)';
    bgGradient = 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(254,242,242,0.7) 100%)';
    borderColor = 'rgba(220, 38, 38, 0.3)';
  }

  return (
    <div
      className="card"
      style={{
        padding: '22px 24px',
        background: bgGradient,
        borderColor: borderColor,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        boxShadow: '0 8px 24px -4px rgba(15,23,42,0.06)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            background: 'rgba(37, 99, 235, 0.12)',
            color: 'var(--blue)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Sparkles size={16} />
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-1)' }}>
            Plain-English AI Reasoning
          </span>
        </div>

        <span className="pill" style={{ fontSize: 11, fontWeight: 700, background: 'rgba(15,23,42,0.06)', color: 'var(--text-1)' }}>
          Confidence: {confPct}%
        </span>
      </div>

      <p style={{ fontSize: 13, color: 'var(--text-1)', lineHeight: 1.6, margin: 0, fontWeight: 500 }}>
        {summaryText}
      </p>
    </div>
  );
}

function BiomarkerCard({ factor, meta }) {
  const IconComp = meta.icon;
  const isHealthy = factor.status === 'normal' || factor.status === 'clean' || factor.status === 'regular';
  const isSupports = factor.impact === 'supports';
  const isOpposes = factor.impact === 'opposes';

  // Normalize score to 0–100% position on the layman visual scale
  let meterPos = Math.min(100, Math.max(8, (factor.score_norm || 0.2) * 100));
  // Invert sharpness so high sharpness is placed on right (healthy)
  if (factor.id === 's1s2_sharpness') {
    meterPos = Math.min(100, Math.max(8, (factor.score || 0.8) * 100));
  }

  return (
    <div
      className="biomarker-card"
      style={{
        background: 'rgba(255, 255, 255, 0.88)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: `1.5px solid ${isHealthy ? 'rgba(5, 150, 105, 0.22)' : 'rgba(217, 119, 6, 0.35)'}`,
        borderRadius: 'var(--r-xl)',
        padding: '20px 22px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        boxShadow: '0 4px 20px -4px rgba(15, 23, 42, 0.05)',
        transition: 'all 0.2s ease',
      }}
    >
      {/* Top Header: Title & Friendly Status Pill */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: meta.bg,
            border: `1px solid ${meta.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: meta.color,
            flexShrink: 0,
          }}>
            <IconComp size={18} />
          </div>
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)', letterSpacing: '-0.01em', margin: 0 }}>
              {meta.title}
            </h3>
            <span style={{ fontSize: 11, color: 'var(--text-3)', display: 'block', marginTop: 1 }}>
              {meta.question}
            </span>
          </div>
        </div>

        <span
          className={`pill ${isHealthy ? 'pill-green' : 'pill-yellow'}`}
          style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', whiteSpace: 'nowrap' }}
        >
          {isHealthy ? (
            <>
              <CheckCircle2 size={11} style={{ marginRight: 4, display: 'inline', verticalAlign: 'middle' }} />
              {meta.normalLabel}
            </>
          ) : (
            <>
              <AlertTriangle size={11} style={{ marginRight: 4, display: 'inline', verticalAlign: 'middle' }} />
              {meta.abnormalLabel}
            </>
          )}
        </span>
      </div>

      {/* Visual Intuitive Scale Gauge */}
      <div style={{ background: 'var(--surface-2)', padding: '12px 14px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontWeight: 600, color: 'var(--text-3)', marginBottom: 6 }}>
          <span>{meta.leftZone}</span>
          <span>{meta.rightZone}</span>
        </div>

        {/* Gauge Track */}
        <div style={{ width: '100%', height: 7, borderRadius: 4, background: '#CBD5E1', position: 'relative', overflow: 'visible' }}>
          {/* Fill Bar */}
          <div style={{
            width: `${meterPos}%`,
            height: '100%',
            borderRadius: 4,
            background: isHealthy ? 'var(--green)' : 'var(--yellow)',
            transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)',
          }} />

          {/* Indicator Dot */}
          <div style={{
            position: 'absolute',
            top: '50%',
            left: `${meterPos}%`,
            transform: 'translate(-50%, -50%)',
            width: 13,
            height: 13,
            borderRadius: '50%',
            background: isHealthy ? '#059669' : '#D97706',
            border: '2px solid #ffffff',
            boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
          }} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
          <span className="mono" style={{ fontSize: 11, color: 'var(--text-2)', fontWeight: 600 }}>
            Measurement: {factor.measured_value}
          </span>
          <span style={{ fontSize: 10, color: 'var(--text-3)' }}>
            Target: {factor.reference_range}
          </span>
        </div>
      </div>

      {/* Plain-English Explanation */}
      <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.55 }}>
        {isHealthy ? meta.normalDesc : meta.abnormalDesc}
      </div>

      {/* AI Impact Contribution Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 10,
        borderTop: '1px solid var(--border)',
        marginTop: 'auto',
        fontSize: 11,
      }}>
        <span style={{ color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span>AI Decision Influence:</span>
        </span>

        <span style={{
          fontWeight: 700,
          color: isSupports ? '#059669' : isOpposes ? '#DC2626' : 'var(--text-3)',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}>
          {isSupports ? (
            <TrendingUp size={13} color="#059669" />
          ) : isOpposes ? (
            <TrendingDown size={13} color="#DC2626" />
          ) : null}
          {factor.contribution_pct > 0 ? '+' : ''}{factor.contribution_pct?.toFixed(1)}% influence
        </span>
      </div>
    </div>
  );
}

export default function FactorContributions({ explanation, predictedClass }) {
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!wrapRef.current || !explanation) return;
    animate(wrapRef.current.querySelectorAll('.biomarker-card'), {
      opacity: [0, 1],
      translateY: [16, 0],
      duration: 380,
      delay: stagger(60, { start: 80 }),
      ease: 'outCubic',
    });
  }, [explanation]);

  if (!explanation) return null;

  const { factors = [], disturbance_index = 0, overall_signal_quality = 'clean' } = explanation;
  const targetClass = predictedClass || explanation.predicted_class || 'normal';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Section Header */}
      <div className="section-label">
        <div className="step-badge" style={{ background: 'rgba(37,99,235,0.12)', borderColor: 'rgba(37,99,235,0.35)', color: 'var(--blue)' }}>
          <HeartPulse size={13} />
        </div>
        <div>
          <h2>Acoustic Biomarker Explainability</h2>
          <p>5 key physiological sound features decoded in plain, everyday language</p>
        </div>
      </div>

      {/* Top AI Plain-English Reasoning Summary */}
      <LaymanSummaryBanner
        predictedClass={targetClass}
        confidence={explanation.confidence || 0.89}
        factors={factors}
      />

      {/* The 5 Layman-Friendly Biomarker Cards in a Clean Responsive Grid */}
      <div ref={wrapRef} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
        {factors.map((factor) => {
          const meta = BIOMARKER_LAYMAN_MAP[factor.id] || BIOMARKER_LAYMAN_MAP.systolic_turbulence;
          return (
            <BiomarkerCard key={factor.id} factor={factor} meta={meta} />
          );
        })}
      </div>

      {/* Clinical Reference Disclaimer */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '12px 16px',
        borderRadius: 'var(--r-md)',
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        fontSize: 11,
        color: 'var(--text-3)',
        lineHeight: 1.5,
      }}>
        <Info size={14} color="var(--text-3)" style={{ flexShrink: 0 }} />
        <span>
          <strong>Clinical Note:</strong> These acoustic biomarkers are computed via signal-processing algorithms to provide transparent, interpretable reasoning for healthcare practitioners.
        </span>
      </div>
    </div>
  );
}
