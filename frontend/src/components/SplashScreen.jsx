import React, { useEffect, useRef } from 'react';
import { animate, stagger } from 'animejs';

const ECG_PATH = "M2,30 L18,30 L24,8 L30,52 L36,22 L42,36 L52,36 L58,30 L80,30";

export default function SplashScreen({ onFinished }) {
  const containerRef = useRef(null);
  const logoRef      = useRef(null);
  const titleRef     = useRef(null);
  const subtitleRef  = useRef(null);
  const ecgRef       = useRef(null);
  const taglineRef   = useRef(null);
  const dotsRef      = useRef(null);

  useEffect(() => {
    // ECG path draw
    if (ecgRef.current) {
      const path = ecgRef.current;
      const len = path.getTotalLength?.() || 120;
      path.style.strokeDasharray = len;
      path.style.strokeDashoffset = len;
      animate(path, { strokeDashoffset: [len, 0], duration: 900, ease: 'inOutQuad', delay: 200 });
    }

    // Sequential entrance with manual delays
    animate(logoRef.current,     { opacity: [0,1], scale: [0.72,1], duration: 700, ease: 'outExpo', delay: 0 });
    animate(titleRef.current,    { opacity: [0,1], translateY: [22,0], duration: 600, ease: 'outExpo', delay: 220 });
    animate(subtitleRef.current, { opacity: [0,1], translateY: [14,0], duration: 500, ease: 'outExpo', delay: 380 });
    animate(taglineRef.current,  { opacity: [0,1], translateY: [10,0], duration: 450, ease: 'outExpo', delay: 520 });

    if (dotsRef.current) {
      animate(dotsRef.current.querySelectorAll('.dot'), {
        opacity: [0,1], scale: [0.4,1], duration: 300, ease: 'outBack',
        delay: stagger(110, { start: 720 }),
      });
    }

    // Exit after 2.4s
    const t = setTimeout(() => {
      if (containerRef.current) {
        animate(containerRef.current, {
          opacity: [1, 0], scale: [1, 1.03],
          duration: 560, ease: 'inCubic',
          onComplete: () => onFinished(),
        });
      }
    }, 2600);

    return () => clearTimeout(t);
  }, [onFinished]);

  return (
    <div
      ref={containerRef}
      className="splash"
      style={{ userSelect: 'none' }}
    >
      {/* Logo Card */}
      <div
        ref={logoRef}
        className="splash-logo-ring"
        style={{ opacity: 0, marginBottom: 28 }}
      >
        <svg width="44" height="44" viewBox="0 0 82 44" fill="none">
          <path
            ref={ecgRef}
            d={ECG_PATH}
            stroke="#2563EB"
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      </div>

      {/* Title */}
      <h1
        ref={titleRef}
        style={{
          opacity: 0,
          fontSize: 48,
          fontWeight: 800,
          letterSpacing: '-0.04em',
          color: '#0F172A',
          lineHeight: 1,
          marginBottom: 10,
        }}
      >
        Echo<span style={{ color: '#2563EB' }}>Assist</span>
      </h1>

      {/* Subtitle */}
      <p
        ref={subtitleRef}
        style={{
          opacity: 0,
          fontSize: 16,
          fontWeight: 500,
          color: '#64748B',
          letterSpacing: '0.01em',
          marginBottom: 32,
        }}
      >
        Listening for what matters
      </p>

      {/* Tagline chips */}
      <div
        ref={taglineRef}
        style={{
          opacity: 0,
          display: 'flex',
          gap: 10,
          flexWrap: 'wrap',
          justifyContent: 'center',
          marginBottom: 48,
        }}
      >
        {['Check quality', 'Find patterns', 'Explain clearly'].map(t => (
          <span key={t} className="pill pill-blue" style={{ fontSize: 11 }}>{t}</span>
        ))}
      </div>

      {/* Loading dots */}
      <div ref={dotsRef} style={{ display: 'flex', gap: 8 }}>
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="dot"
            style={{
              opacity: 0,
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: i === 1 ? '#2563EB' : '#93C5FD',
            }}
          />
        ))}
      </div>
    </div>
  );
}
