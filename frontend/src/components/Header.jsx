import React, { useEffect, useRef } from 'react';
import { BarChart3, ShieldAlert, Wifi, WifiOff, Heart, Wind } from 'lucide-react';
import { animate, stagger } from 'animejs';

export default function Header({ isBackendLive, apiMode, onToggleMode, onOpenMetrics, organMode, onOrganChange }) {
  const navRef = useRef(null);

  useEffect(() => {
    if (!navRef.current) return;
    animate(navRef.current.querySelectorAll('.nav-item'), {
      opacity: [0, 1],
      translateY: [-8, 0],
      duration: 480,
      delay: stagger(60, { start: 100 }),
      ease: 'outCubic',
    });
  }, []);

  const isHeart = organMode === 'heart';
  const primary = isHeart ? '#DC2626' : '#2563EB';
  const primaryBg = isHeart ? 'rgba(220,38,38,0.09)' : 'rgba(37,99,235,0.08)';
  const primaryBorder = isHeart ? 'rgba(220,38,38,0.25)' : 'rgba(37,99,235,0.25)';

  return (
    <header
      ref={navRef}
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'rgba(255, 255, 255, 0.88)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        borderBottom: '1px solid var(--border)',
        boxShadow: '0 1px 4px rgba(15, 23, 42, 0.04)',
        transition: 'border-color 0.5s ease',
      }}
    >
      <div style={{
        maxWidth: 1360,
        margin: '0 auto',
        padding: '0 24px',
        height: 56,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
      }}>
        {/* Brand */}
        <div className="nav-item" style={{ display: 'flex', alignItems: 'center', gap: 12, opacity: 0 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: primaryBg,
            border: `1px solid ${primaryBorder}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.5s ease, border-color 0.5s ease',
          }}>
            {isHeart
              ? <Heart size={17} color={primary} strokeWidth={2.2} />
              : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={primary} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12h4l2-5 4 10 3-7 2 2h5" /></svg>
            }
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--text-1)' }}>
                EchoAssist
              </span>
              <span className="pill pill-blue" style={{ fontSize: 10, letterSpacing: '0.06em', padding: '2px 7px' }}>
                PS-S01
              </span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', letterSpacing: '-0.01em', transition: 'color 0.4s ease' }}>
              {isHeart ? 'Cardiac Acoustic Intelligence' : 'Respiratory Acoustic Intelligence'}
            </div>
          </div>
        </div>

        {/* Right controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>

          {/* ── Organ Toggle ── */}
          <div
            className="nav-item"
            style={{
              opacity: 0,
              display: 'flex',
              alignItems: 'center',
              background: 'rgba(248,250,252,0.90)',
              border: '1px solid var(--border-mid)',
              borderRadius: 'var(--r-full)',
              padding: '3px',
              gap: 2,
              backdropFilter: 'blur(8px)',
            }}
          >
            <button
              onClick={() => onOrganChange('heart')}
              title="Heart / Cardiac Mode"
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '5px 12px', borderRadius: 'var(--r-full)',
                border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                fontSize: 12, fontWeight: 700,
                background: isHeart ? '#DC2626' : 'transparent',
                color: isHeart ? '#fff' : 'var(--text-3)',
                transition: 'all 0.3s cubic-bezier(.4,0,.2,1)',
                boxShadow: isHeart ? '0 2px 8px rgba(220,38,38,0.35)' : 'none',
              }}
            >
              <Heart size={12} />
              Heart
            </button>
            <button
              onClick={() => onOrganChange('lung')}
              title="Lung / Respiratory Mode"
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '5px 12px', borderRadius: 'var(--r-full)',
                border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                fontSize: 12, fontWeight: 700,
                background: !isHeart ? '#2563EB' : 'transparent',
                color: !isHeart ? '#fff' : 'var(--text-3)',
                transition: 'all 0.3s cubic-bezier(.4,0,.2,1)',
                boxShadow: !isHeart ? '0 2px 8px rgba(37,99,235,0.35)' : 'none',
              }}
            >
              <Wind size={12} />
              Lungs
            </button>
          </div>

          {/* Non-diagnostic disclaimer */}
          <div
            className="nav-item"
            style={{
              opacity: 0,
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '4px 10px', borderRadius: 999,
              background: 'rgba(217, 119, 6, 0.08)',
              border: '1px solid rgba(217, 119, 6, 0.25)',
              fontSize: 11, fontWeight: 600, color: '#B45309',
            }}
          >
            <ShieldAlert size={11} />
            <span>Decision Support — Non-Diagnostic</span>
          </div>

          {/* Backend status */}
          <button
            className="nav-item btn btn-ghost"
            onClick={onToggleMode}
            title="Toggle API mode"
            style={{ opacity: 0, padding: '5px 12px', fontSize: 12, gap: 5 }}
          >
            {isBackendLive ? (
              <>
                <Wifi size={12} color="var(--green)" />
                <span style={{ color: 'var(--green)' }}>Live API</span>
              </>
            ) : (
              <>
                <WifiOff size={12} color="var(--yellow)" />
                <span style={{ color: 'var(--yellow)' }}>
                  {apiMode === 'mock' ? 'Mock' : 'Offline'}
                </span>
              </>
            )}
          </button>

          {/* Metrics button */}
          <button
            className="nav-item btn btn-ghost"
            onClick={onOpenMetrics}
            style={{ opacity: 0, padding: '5px 12px', fontSize: 12, gap: 5 }}
          >
            <BarChart3 size={13} color="var(--blue)" />
            <span>Metrics</span>
          </button>
        </div>
      </div>
    </header>
  );
}
