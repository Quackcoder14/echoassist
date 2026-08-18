import React, { useEffect, useRef } from 'react';
import { Activity, CheckCircle2, AlertTriangle, HeartPulse, Info, ShieldCheck, Sparkles, Waves, Zap, Wind, Droplets } from 'lucide-react';
import { Clock } from 'lucide-react';
import { animate, stagger } from 'animejs';

const DETAILS = {
  s1s2_sharpness: {
    title: 'Valve closure sound',
    plain: 'How crisp the familiar "lub-dub" sounds are.',
    good: 'The valve sounds are clear and well-defined.',
    concern: 'The valve sounds are less distinct than expected.',
    icon: Activity,
    color: '#2563EB',
  },
  systolic_turbulence: {
    title: 'Blood-flow sound',
    plain: 'Whether a whooshing sound appears while the heart pumps.',
    good: 'No prominent whooshing sound was detected.',
    concern: 'A whooshing sound was detected while the heart pumps.',
    icon: Waves,
    color: '#D97706',
  },
  diastolic_quiescence: {
    title: 'Resting interval',
    plain: 'How quiet the heart is as it relaxes between beats.',
    good: 'The resting interval is quiet as expected.',
    concern: 'Extra sound was detected during the resting interval.',
    icon: Clock,
    color: '#7C3AED',
  },
  rhythm_regularity: {
    title: 'Heartbeat timing',
    plain: 'Whether each beat arrives at a steady, even pace.',
    good: 'The timing between beats is steady.',
    concern: 'The timing between beats is uneven.',
    icon: Zap,
    color: '#059669',
  },
  disturbance_index: {
    title: 'Recording clarity',
    plain: 'Whether noise or movement could interfere with the reading.',
    good: 'The recording is clear enough to interpret.',
    concern: 'Noise or movement may affect the recording.',
    icon: Wind,
    color: '#DC2626',
  },
};

const OUTCOME = {
  normal: {
    title: 'No concerning pattern found',
    description: 'The recording most closely matches a normal heart-sound pattern.',
    color: 'var(--green)',
    note: 'This is a decision-support result, not a diagnosis.',
  },
  murmur: {
    title: 'Murmur pattern detected',
    description: 'The recording contains a whooshing blood-flow pattern that may warrant clinical review.',
    color: 'var(--yellow)',
    note: 'A clinician should interpret this alongside symptoms and an examination.',
  },
  extrasystole: {
    title: 'Irregular beat pattern detected',
    description: 'The timing suggests an early or irregular beat in this recording.',
    color: 'var(--purple)',
    note: 'A clinician should interpret this alongside symptoms and an examination.',
  },
  artifact: {
    title: 'Recording needs attention',
    description: 'Noise or movement makes this recording less reliable for interpretation.',
    color: 'var(--red)',
    note: 'Try a quieter location and keep the stethoscope still while recording.',
  },
};

const RESP_DETAILS = {
  crackles_band_power: {
    title: 'Crackle sounds (popping)',
    plain: 'Short, explosive popping sounds usually caused by fluid or collapsed airways.',
    good: 'No prominent crackle sounds detected in this recording.',
    concern: 'Elevated popping/crackle sounds detected. May indicate fluid in the airways.',
    icon: Droplets,
    color: '#0EA5E9',
  },
  wheeze_band_power: {
    title: 'Wheeze sounds (whistling)',
    plain: 'Continuous musical or whistling sounds caused by narrowed or obstructed airways.',
    good: 'No prominent wheeze sounds detected in this recording.',
    concern: 'Continuous whistling wheeze sounds detected. May indicate airway narrowing (e.g. Asthma).',
    icon: Wind,
    color: '#7C3AED',
  },
  respiratory_disturbance: {
    title: 'Recording clarity',
    plain: 'Whether noise or movement could interfere with the reading.',
    good: 'The recording is clear enough to interpret accurately.',
    concern: 'Stethoscope friction or movement may be affecting the recording quality.',
    icon: Activity,
    color: '#DC2626',
  },
};

const RESP_OUTCOME = {
  normal: {
    title: 'Clear airways detected',
    description: 'The recording closely matches a normal respiratory sound pattern with no prominent crackles or wheezes.',
    color: 'var(--green)',
    note: 'This is a decision-support result, not a clinical diagnosis.',
  },
  crackles: {
    title: 'Crackle pattern detected',
    description: 'The recording contains short, explosive popping sounds (crackles/rales). This may be associated with fluid in the airways, pneumonia, or COPD.',
    color: '#0EA5E9',
    note: 'A clinician should interpret this alongside symptoms and a physical examination.',
  },
  wheezes: {
    title: 'Wheeze pattern detected',
    description: 'The recording contains continuous musical or whistling sounds (wheezes). This may indicate narrowed airways, such as in asthma or COPD.',
    color: 'var(--purple)',
    note: 'A clinician should interpret this alongside symptoms and a physical examination.',
  },
  both: {
    title: 'Both crackles and wheezes detected',
    description: 'The recording contains both popping (crackle) and whistling (wheeze) sounds, suggesting complex or mixed airway pathology.',
    color: 'var(--yellow)',
    note: 'This combination often warrants prompt clinical evaluation.',
  },
};

/* ── Signal Card ──────────────────────────────────────────────────── */
function SignalCard({ factor, index, detailMap = DETAILS }) {
  const detail = detailMap[factor.id] || DETAILS.systolic_turbulence || Object.values(detailMap)[0];
  const Icon = detail.icon;
  const reassuring = ['normal', 'clean', 'regular'].includes(factor.status);
  const amount = Math.max(8, Math.min(100, Math.abs(factor.contribution_pct || (factor.score_norm * 100) || 25)));

  return (
    <div
      style={{
        opacity: 0,
        background: 'rgba(255,255,255,0.90)',
        border: `1.5px solid ${reassuring ? 'rgba(5,150,105,0.20)' : 'rgba(217,119,6,0.28)'}`,
        borderRadius: 'var(--r-xl)',
        padding: '24px 26px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        boxShadow: '0 4px 20px -4px rgba(15,23,42,0.05)',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
      }}
      className="sig-card"
    >
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12,
          background: `${detail.color}18`,
          border: `1px solid ${detail.color}30`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: detail.color, flexShrink: 0,
        }}>
          <Icon size={18} />
        </div>
        <span className={`pill ${reassuring ? 'pill-green' : 'pill-yellow'}`}>
          {reassuring ? '✓ Reassuring' : '⚠ Review signal'}
        </span>
      </div>

      {/* Title & plain-english */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-4)', marginBottom: 4 }}>
          Signal 0{index + 1}
        </div>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)', letterSpacing: '-0.015em', marginBottom: 4 }}>
          {detail.title}
        </h3>
        <p style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.55 }}>
          {detail.plain}
        </p>
      </div>

      {/* Meter */}
      <div style={{ background: 'var(--surface-2)', borderRadius: 'var(--r-md)', padding: '12px 14px', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 10, color: 'var(--text-4)', fontWeight: 600 }}>
          <span>Signal intensity</span>
          <span className="mono">{factor.measured_value || '—'}</span>
        </div>
        <div style={{ height: 7, borderRadius: 4, background: '#D1DCF0', overflow: 'hidden' }}>
          <div style={{
            width: `${amount}%`, height: '100%', borderRadius: 4,
            background: reassuring ? 'var(--green)' : 'var(--yellow)',
            transition: 'width 0.8s cubic-bezier(.4,0,.2,1)',
          }} />
        </div>
        <div style={{ marginTop: 4, fontSize: 10, color: 'var(--text-4)' }}>
          Target: {factor.reference_range || '—'}
        </div>
      </div>

      {/* Verdict */}
      <p style={{
        fontSize: 13, fontWeight: 500, lineHeight: 1.55,
        color: reassuring ? '#047857' : '#B45309',
        padding: '10px 14px',
        borderRadius: 'var(--r-md)',
        background: reassuring ? 'rgba(5,150,105,0.07)' : 'rgba(217,119,6,0.07)',
        border: `1px solid ${reassuring ? 'rgba(5,150,105,0.20)' : 'rgba(217,119,6,0.20)'}`,
      }}>
        {reassuring ? detail.good : detail.concern}
      </p>
    </div>
  );
}

/* ── Main Component ───────────────────────────────────────────────── */
export default function FactorContributions({ explanation, predictedClass, organMode = 'heart' }) {
  const cardsRef = useRef(null);
  const isLung = organMode === 'lung';

  useEffect(() => {
    if (!cardsRef.current || !explanation) return;
    animate(cardsRef.current.querySelectorAll('.sig-card'), {
      opacity: [0, 1], translateY: [20, 0],
      duration: 460, delay: stagger(70, { start: 140 }), ease: 'outCubic',
    });
  }, [explanation]);

  if (!explanation) return null;

  const factors = explanation.factors || [];
  const outcomeMap = isLung ? RESP_OUTCOME : OUTCOME;
  const result = outcomeMap[predictedClass || explanation.predicted_class] || outcomeMap.normal;
  const detailMap = isLung ? RESP_DETAILS : DETAILS;
  const confidence = ((explanation.confidence || 0.89) * 100).toFixed(0);
  const primary = factors
    .filter(f => !['normal', 'clean', 'regular'].includes(f.status))
    .sort((a, b) => Math.abs(b.contribution_pct || 0) - Math.abs(a.contribution_pct || 0))[0];
  const primaryText = primary
    ? (detailMap[primary.id] || DETAILS.systolic_turbulence).title.toLowerCase()
    : isLung ? 'a consistent pattern of clear airway sounds' : 'a consistent combination of sound and timing markers';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Section header */}
      <div className="section-label">
        <div className="step-badge" style={{ background: 'rgba(37,99,235,0.12)', borderColor: 'rgba(37,99,235,0.35)', color: 'var(--blue)' }}>
          {isLung ? <Wind size={14} /> : <HeartPulse size={14} />}
        </div>
        <div>
          <h2>{isLung ? "Here's what the recording is telling us about your lungs" : "Here's what the recording is telling us"}</h2>
          <p>{isLung ? 'Translated from respiratory acoustic data into a simple, evidence-led overview' : 'Translated from acoustic data into a simple, evidence-led overview'}</p>
        </div>
      </div>

      {/* Outcome card */}
      <div className="card" style={{
        padding: '28px 32px',
        background: `linear-gradient(135deg, rgba(255,255,255,0.95) 0%, ${result.color}12 100%)`,
        borderColor: `${result.color}30`,
        display: 'flex', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap',
      }}>
        <div style={{
          width: 52, height: 52, borderRadius: 16, flexShrink: 0,
          background: `${result.color}15`, border: `1.5px solid ${result.color}35`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: result.color,
        }}>
          {isLung ? <Wind size={24} /> : <HeartPulse size={24} />}
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-4)', marginBottom: 4 }}>
            Primary finding
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-1)', marginBottom: 6 }}>
            {result.title}
          </h2>
          <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.6, maxWidth: 560 }}>
            {result.description}
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            border: `3px solid ${result.color}`,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(255,255,255,0.80)',
          }}>
            <span style={{ fontSize: 20, fontWeight: 800, color: result.color, lineHeight: 1 }}>{confidence}%</span>
            <span style={{ fontSize: 9, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>confidence</span>
          </div>
        </div>
      </div>

      {/* Most influenced by */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 18px', borderRadius: 'var(--r-lg)',
        background: 'rgba(37,99,235,0.06)', border: '1px solid rgba(37,99,235,0.18)',
        fontSize: 13, color: 'var(--text-2)',
      }}>
        <Activity size={15} color="var(--blue)" style={{ flexShrink: 0 }} />
        <span>Most influenced by</span>
        <strong style={{ color: 'var(--text-1)' }}>{primaryText}</strong>
      </div>

      {/* Signal grid heading */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)', letterSpacing: '-0.02em' }}>Why the model reached this result</h3>
          <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 3 }}>Each card explains one part of the heart sound in everyday terms.</p>
        </div>
        <span className="pill pill-blue">
          <ShieldCheck size={11} /> {factors.length} signals checked
        </span>
      </div>

      {/* Signal cards grid */}
      <div
        ref={cardsRef}
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}
      >
        {factors.map((factor, index) => (
          <SignalCard key={factor.id} factor={factor} index={index} detailMap={detailMap} />
        ))}
      </div>

      {/* Disclaimer */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 12,
        padding: '14px 18px', borderRadius: 'var(--r-md)',
        background: 'var(--surface-2)', border: '1px solid var(--border)',
        fontSize: 13, color: 'var(--text-3)', lineHeight: 1.55,
      }}>
        <Info size={15} color="var(--blue)" style={{ flexShrink: 0, marginTop: 1 }} />
        <p><strong style={{ color: 'var(--text-2)' }}>Good to know:</strong> {result.note}{isLung ? '' : ' The timeline below shows where these sounds occur in each heartbeat.'}</p>
      </div>

    </div>
  );
}
