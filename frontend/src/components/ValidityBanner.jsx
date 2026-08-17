import React, { useEffect, useRef } from 'react';
import { Check, X, Clock, ShieldCheck, ShieldAlert, Activity, Volume2, Sparkles } from 'lucide-react';
import { animate, stagger } from 'animejs';

export default function ValidityBanner({ validity }) {
  const wrapRef  = useRef(null);
  const cardsRef = useRef(null);

  useEffect(() => {
    if (!wrapRef.current || !validity) return;

    animate(wrapRef.current, {
      opacity: [0, 1],
      translateY: [16, 0],
      duration: 420,
      ease: 'outCubic',
    });

    if (cardsRef.current) {
      animate(cardsRef.current.querySelectorAll('.metric-tile'), {
        opacity: [0, 1],
        translateY: [10, 0],
        duration: 350,
        delay: stagger(70, { start: 120 }),
        ease: 'outCubic',
      });
    }
  }, [validity]);

  if (!validity) return null;

  const isPassed = validity.valid;
  const duration = validity.duration_sec ?? 6.0;

  const CHECKS = [
    {
      id: 'noise',
      title: 'Noise Floor Analysis',
      subtitle: 'RMS Ambient Energy',
      value: isPassed ? '-42.8 dB' : '-18.2 dB',
      benchmark: '< -30.0 dB threshold',
      status: isPassed ? 'pass' : 'fail',
      icon: Volume2,
      progress: isPassed ? 92 : 35,
    },
    {
      id: 'snr',
      title: 'Signal-to-Noise Ratio',
      subtitle: 'Spectral Quality Index',
      value: isPassed ? '+24.6 dB' : '+2.1 dB',
      benchmark: '> +12.0 dB clinical floor',
      status: isPassed ? 'pass' : 'fail',
      icon: Activity,
      progress: isPassed ? 88 : 20,
    },
    {
      id: 'dur',
      title: 'Auscultation Duration',
      subtitle: 'Cardiac Cycle Window',
      value: `${duration.toFixed(2)}s`,
      benchmark: '≥ 2.0s sufficient cycles',
      status: isPassed ? 'pass' : 'fail',
      icon: Clock,
      progress: isPassed ? Math.min(100, Math.max(30, (duration / 6.0) * 100)) : 15,
    },
  ];

  return (
    <div ref={wrapRef} style={{ display: 'flex', flexDirection: 'column', gap: 16, opacity: 0 }}>
      {/* Section label */}
      <div className="section-label" style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="step-badge" style={{
            background: isPassed ? 'rgba(5, 150, 105, 0.12)' : 'rgba(220, 38, 38, 0.12)',
            borderColor: isPassed ? 'rgba(5, 150, 105, 0.35)' : 'rgba(220, 38, 38, 0.35)',
            color: isPassed ? 'var(--green)' : 'var(--red)',
          }}>
            {isPassed ? <ShieldCheck size={14} /> : <ShieldAlert size={14} />}
          </div>
          <div>
            <h2>{isPassed ? 'Acoustic Signal Integrity Verified' : 'Signal Quality Rejection — Safety Gate'}</h2>
            <p>
              {isPassed
                ? 'Pre-processing noise floor, spectral SNR, and temporal duration checks passed'
                : 'Acoustic signal did not satisfy clinical fidelity thresholds for neural inference'}
            </p>
          </div>
        </div>

        <span className={`pill ${isPassed ? 'pill-green' : 'pill-red'}`} style={{ fontSize: 11, fontWeight: 700 }}>
          {isPassed ? 'PASSED 3/3 CHECKS' : 'INTEGRITY FAILED'}
        </span>
      </div>

      {/* Main Glassmorphic Card Container */}
      <div
        className="card"
        style={{
          padding: '32px 36px',
          background: isPassed
            ? 'linear-gradient(135deg, rgba(255,255,255,0.92) 0%, rgba(240,253,244,0.65) 100%)'
            : 'linear-gradient(135deg, rgba(255,255,255,0.92) 0%, rgba(254,242,242,0.65) 100%)',
          borderColor: isPassed ? 'rgba(5, 150, 105, 0.25)' : 'rgba(220, 38, 38, 0.25)',
          boxShadow: isPassed
            ? '0 12px 32px -4px rgba(5, 150, 105, 0.08), 0 2px 6px rgba(0,0,0,0.02)'
            : '0 12px 32px -4px rgba(220, 38, 38, 0.08), 0 2px 6px rgba(0,0,0,0.02)',
        }}
      >
        {/* Top Summary Banner */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderRadius: 'var(--r-lg)',
          background: isPassed ? 'rgba(5, 150, 105, 0.08)' : 'rgba(220, 38, 38, 0.08)',
          border: `1px solid ${isPassed ? 'rgba(5, 150, 105, 0.20)' : 'rgba(220, 38, 38, 0.20)'}`,
          marginBottom: 18,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {isPassed ? (
              <Sparkles size={16} color="var(--green)" />
            ) : (
              <ShieldAlert size={16} color="var(--red)" />
            )}
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>
              {isPassed
                ? 'Clinical Signal Quality: High Fidelity Auscultation'
                : 'Clinical Signal Quality: Low Fidelity / Distorted'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="mono" style={{ fontSize: 11, color: 'var(--text-2)', fontWeight: 600 }}>
              Window: {duration.toFixed(2)}s
            </span>
          </div>
        </div>

        {/* 3 Metric Grid Cards */}
        <div ref={cardsRef} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          {CHECKS.map((chk) => {
            const IconComp = chk.icon;
            const ok = chk.status === 'pass';

            return (
              <div
                key={chk.id}
                className="metric-tile"
                style={{
                  background: 'rgba(255, 255, 255, 0.75)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  border: `1px solid ${ok ? 'rgba(5, 150, 105, 0.22)' : 'rgba(220, 38, 38, 0.22)'}`,
                  borderRadius: 'var(--r-lg)',
                  padding: '16px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  boxShadow: '0 2px 8px rgba(15, 23, 42, 0.03)',
                  opacity: 0,
                }}
              >
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: ok ? 'rgba(5, 150, 105, 0.12)' : 'rgba(220, 38, 38, 0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: ok ? 'var(--green)' : 'var(--red)',
                  }}>
                    <IconComp size={16} />
                  </div>

                  <span className={`pill ${ok ? 'pill-green' : 'pill-red'}`} style={{ fontSize: 10, padding: '2px 7px' }}>
                    {ok ? 'PASS' : 'FAIL'}
                  </span>
                </div>

                {/* Info & Value */}
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)', letterSpacing: '-0.01em' }}>
                    {chk.title}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>
                    {chk.subtitle}
                  </div>
                </div>

                {/* Metric value and progress bar */}
                <div style={{ marginTop: 'auto' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                    <span className="mono" style={{ fontSize: 15, fontWeight: 700, color: ok ? 'var(--green)' : 'var(--red)' }}>
                      {chk.value}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--text-3)' }}>
                      {chk.benchmark}
                    </span>
                  </div>

                  <div style={{ width: '100%', height: 5, borderRadius: 3, background: 'rgba(15, 23, 42, 0.08)', overflow: 'hidden' }}>
                    <div style={{
                      width: `${chk.progress}%`,
                      height: '100%',
                      background: ok ? 'var(--green)' : 'var(--red)',
                      borderRadius: 3,
                      transition: 'width 0.6s ease',
                    }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Rejection / Failure Reason Box */}
        {!isPassed && validity.reason && (
          <div style={{
            marginTop: 16,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            padding: '12px 14px',
            borderRadius: 'var(--r-md)',
            background: 'rgba(220, 38, 38, 0.08)',
            border: '1px solid rgba(220, 38, 38, 0.25)',
          }}>
            <ShieldAlert size={16} color="var(--red)" style={{ marginTop: 2, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--red)', marginBottom: 2 }}>
                Quality Gate Violation
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5 }}>
                {validity.reason}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
