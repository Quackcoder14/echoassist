import React, { useEffect, useRef } from 'react';
import { BarChart3, ShieldAlert, Wifi, WifiOff } from 'lucide-react';
import { animate, stagger } from 'animejs';

export default function Header({ isBackendLive, apiMode, onToggleMode, onOpenMetrics }) {
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
      }}
    >
      <div style={{
        maxWidth: 1120,
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
          {/* Heartbeat icon */}
          <div style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            background: 'rgba(37, 99, 235, 0.08)',
            border: '1px solid rgba(37, 99, 235, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 12h4l2-5 4 10 3-7 2 2h5" />
            </svg>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{
                fontSize: 17,
                fontWeight: 700,
                letterSpacing: '-0.03em',
                color: 'var(--text-1)',
              }}>
                EchoAssist
              </span>
              <span className="pill pill-blue" style={{ fontSize: 10, letterSpacing: '0.06em', padding: '2px 7px' }}>
                PS-S01
              </span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', letterSpacing: '-0.01em', marginTop: 0 }}>
              Cardiac Acoustic Intelligence
            </div>
          </div>
        </div>

        {/* Right controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Non-diagnostic disclaimer */}
          <div
            className="nav-item"
            style={{
              opacity: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 10px',
              borderRadius: 999,
              background: 'rgba(217, 119, 6, 0.08)',
              border: '1px solid rgba(217, 119, 6, 0.25)',
              fontSize: 11,
              fontWeight: 600,
              color: '#B45309',
            }}
          >
            <ShieldAlert size={11} />
            <span style={{ display: 'block' }}>Decision Support — Non-Diagnostic</span>
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
