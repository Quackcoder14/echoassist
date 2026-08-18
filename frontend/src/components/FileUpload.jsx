import React, { useRef, useState, useEffect } from 'react';
import { UploadCloud, FileAudio, CheckCircle2, Activity, Zap, VolumeX, Heart, ChevronRight, Sparkles, Wind, Droplets } from 'lucide-react';
import { PRESET_SAMPLES, LUNG_PRESET_SAMPLES, createSyntheticWavBlob } from '../mockData';
import { animate, stagger } from 'animejs';

const PRESET_CONFIG = {
  normal:       { icon: Heart,     color: '#059669', bg: 'rgba(5,150,105,0.10)',  pill: 'pill-green',  cls: 'preset-normal'       },
  murmur:       { icon: Activity,  color: '#D97706', bg: 'rgba(217,119,6,0.10)',  pill: 'pill-yellow', cls: 'preset-murmur'       },
  extrasystole: { icon: Zap,       color: '#7C3AED', bg: 'rgba(124,58,237,0.10)', pill: 'pill-purple', cls: 'preset-extrasystole' },
  artifact:     { icon: VolumeX,   color: '#DC2626', bg: 'rgba(220,38,38,0.10)',  pill: 'pill-red',    cls: 'preset-artifact'     },
};

const LUNG_PRESET_CONFIG = {
  normal:   { icon: Wind,     color: '#059669', bg: 'rgba(5,150,105,0.10)',  pill: 'pill-green',  cls: 'preset-normal'   },
  crackles: { icon: Droplets, color: '#0EA5E9', bg: 'rgba(14,165,233,0.10)', pill: 'pill-blue',   cls: 'preset-murmur'   },
  wheezes:  { icon: Zap,      color: '#7C3AED', bg: 'rgba(124,58,237,0.10)', pill: 'pill-purple', cls: 'preset-extrasystole' },
  silent:   { icon: VolumeX,  color: '#DC2626', bg: 'rgba(220,38,38,0.10)',  pill: 'pill-red',    cls: 'preset-artifact' },
};

/* ── Animated ECG line in the hero ─────────────────────────────────── */
function EcgLine() {
  const pathRef = useRef(null);
  useEffect(() => {
    if (!pathRef.current) return;
    const p = pathRef.current;
    const len = p.getTotalLength?.() || 300;
    p.style.strokeDasharray = len;
    p.style.strokeDashoffset = len;
    const loop = () => animate(p, {
      strokeDashoffset: [len, -len],
      duration: 2600,
      ease: 'linear',
      onComplete: loop,
    });
    loop();
  }, []);
  return (
    <svg viewBox="0 0 320 60" fill="none" style={{ width: '100%', maxWidth: 380, height: 60, opacity: 0.55 }}>
      <path
        ref={pathRef}
        d="M0,30 L40,30 L55,12 L70,48 L85,20 L100,38 L120,38 L135,30 L180,30 L195,10 L210,50 L225,18 L240,36 L260,36 L275,30 L320,30"
        stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  );
}

export default function FileUpload({ onFileSelected, currentFile, isProcessing, organMode = 'heart' }) {
  const isLung = organMode === 'lung';
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);
  const dropRef      = useRef(null);
  const heroRef      = useRef(null);
  const presetsRef   = useRef(null);

  /* ── Entrance animations (re-run when organ mode changes) ── */
  useEffect(() => {
    if (heroRef.current) {
      animate(heroRef.current, { opacity: [0, 1], translateY: [24, 0], duration: 560, ease: 'outExpo', delay: 60 });
    }
    if (dropRef.current) {
      animate(dropRef.current, { opacity: [0, 1], scale: [0.97, 1], duration: 500, ease: 'outExpo', delay: 180 });
    }
    if (presetsRef.current) {
      animate(presetsRef.current.querySelectorAll('.preset-tile'), {
        opacity: [0, 1], translateY: [16, 0],
        duration: 400, delay: stagger(60, { start: 340 }), ease: 'outCubic',
      });
    }
  }, [organMode]);

  const handleDragOver  = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e) => {
    e.preventDefault(); setIsDragging(false);
    if (e.dataTransfer.files?.[0]) pass(e.dataTransfer.files[0]);
  };
  const handleChange = (e) => { if (e.target.files?.[0]) pass(e.target.files[0]); };

  const pass = (f) => {
    if (dropRef.current) animate(dropRef.current, { scale: [1, 1.02, 1], duration: 300, ease: 'outCubic' });
    onFileSelected(f);
  };

  const handlePreset = (preset) => {
    const blob = createSyntheticWavBlob(preset.type, 6.0);
    pass(new File([blob], `${preset.id}_${preset.type}.wav`, { type: 'audio/wav' }));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* ── Top Section: Hero + Dropzone side-by-side ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 28, alignItems: 'stretch' }}>
        
        {/* ── Hero block ── */}
        <div
          ref={heroRef}
          style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.96) 0%, rgba(229,242,255,0.90) 100%)',
            border: '1px solid rgba(190,215,255,0.60)',
            borderRadius: 'var(--r-2xl)',
            padding: '48px 40px',
            backdropFilter: 'blur(32px) saturate(200%)',
            WebkitBackdropFilter: 'blur(32px) saturate(200%)',
            boxShadow: '0 8px 48px -8px rgba(37,99,235,0.14), inset 0 1px 0 rgba(255,255,255,0.95)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: 20,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <Sparkles size={14} color="var(--blue)" />
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--blue)' }}>
              {isLung ? 'Clinical Lung Sound Intelligence' : 'Clinical Heart Sound Intelligence'}
            </span>
          </div>
          <h1 style={{ fontSize: 38, fontWeight: 800, letterSpacing: '-0.045em', color: 'var(--text-1)', lineHeight: 1.12, maxWidth: 640 }}>
            {isLung
              ? 'Turn a lung auscultation into a clear respiratory insight.'
              : 'Turn a stethoscope recording into a clear next step.'}
          </h1>
          <p style={{ fontSize: 15.5, color: 'var(--text-2)', lineHeight: 1.72, maxWidth: 580 }}>
            {isLung
              ? 'Upload any short lung sound recording. EchoAssist checks its acoustic quality, classifies respiratory patterns (crackles, wheezes), and explains the finding — in plain language, instantly.'
              : 'Upload any short heart sound recording. EchoAssist checks its acoustic quality, classifies the pattern, and explains the finding — in plain language, instantly.'}
          </p>

          {/* Three feature chips */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
            {[
              { label: 'Quality gate check', color: 'pill-blue' },
              { label: 'Neural classification', color: 'pill-purple' },
              { label: 'Plain-English explanation', color: 'pill-green' },
            ].map(c => (
              <span key={c.label} className={`pill ${c.color}`} style={{ fontSize: 12 }}>{c.label}</span>
            ))}
          </div>

          <EcgLine />
        </div>

        {/* ── Drop zone ── */}
        <div
          ref={dropRef}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !isProcessing && fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${isDragging ? 'var(--blue)' : 'rgba(100,160,255,0.45)'}`,
            borderRadius: 'var(--r-xl)',
            background: isDragging
              ? 'rgba(37,99,235,0.06)'
              : 'rgba(255,255,255,0.70)',
            backdropFilter: 'blur(24px) saturate(180%)',
            WebkitBackdropFilter: 'blur(24px) saturate(180%)',
            padding: '52px 36px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18,
            cursor: isProcessing ? 'not-allowed' : 'pointer',
            transition: 'all 0.22s cubic-bezier(.4,0,.2,1)',
            boxShadow: isDragging
              ? '0 0 0 5px rgba(37,99,235,0.12)'
              : '0 2px 16px rgba(37,99,235,0.06)',
          }}
        >
          <input ref={fileInputRef} type="file" accept=".wav,audio/wav" style={{ display: 'none' }} onChange={handleChange} disabled={isProcessing} />

          {/* Icon ring */}
          <div style={{
            width: 72, height: 72, borderRadius: 22,
            background: isDragging ? 'rgba(37,99,235,0.14)' : 'rgba(37,99,235,0.08)',
            border: `1.5px solid ${isDragging ? 'rgba(37,99,235,0.45)' : 'rgba(37,99,235,0.22)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.22s ease',
            boxShadow: isDragging ? '0 0 24px rgba(37,99,235,0.20)' : 'none',
          }}>
            {currentFile
              ? <FileAudio size={30} color="var(--blue)" />
              : <UploadCloud size={30} color="var(--blue)" />
            }
          </div>

          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-1)', marginBottom: 6 }}>
              {currentFile
                ? <span style={{ color: 'var(--blue)' }}>{currentFile.name}</span>
                : 'Drop your recording here, or click to browse'
              }
            </p>
            <p style={{ fontSize: 13.5, color: 'var(--text-3)' }}>
              {currentFile
                ? `${(currentFile.size / 1024).toFixed(1)} KB · audio/wav`
                : 'Supports .WAV · single-channel PCG · PhysioNet / PASCAL compatible'
              }
            </p>
          </div>
        </div>
      </div>

      {/* ── Demo presets ── */}
      <div
        style={{
          background: 'rgba(255,255,255,0.78)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          border: '1px solid rgba(190,215,255,0.55)',
          borderRadius: 'var(--r-xl)',
          padding: '28px 32px',
          boxShadow: '0 4px 24px -4px rgba(37,99,235,0.07)',
        }}
        ref={presetsRef}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-2)' }}>
              Demo Acoustic Presets
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 2 }}>
              {isLung ? 'Tap any card to load a synthesised lung sound sample instantly' : 'Tap any card to load a synthesised heart sound sample instantly'}
            </p>
          </div>
          <span className="pill pill-blue" style={{ fontSize: 11 }}>Real-time PCM synthesis</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 14 }}>
          {(isLung ? LUNG_PRESET_SAMPLES : PRESET_SAMPLES).map((preset) => {
            const isSelected = currentFile?.name?.includes(preset.id);
            const cfg = (isLung ? LUNG_PRESET_CONFIG : PRESET_CONFIG)[preset.type] || (isLung ? LUNG_PRESET_CONFIG : PRESET_CONFIG).normal;
            const IconComp = cfg.icon;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handlePreset(preset)}
                disabled={isProcessing}
                className={`preset-tile ${cfg.cls} ${isSelected ? 'selected' : ''}`}
                style={{ opacity: 0 }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 12,
                    background: cfg.bg, border: `1px solid ${cfg.color}30`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: cfg.color,
                  }}>
                    <IconComp size={18} />
                  </div>
                  <span className={`pill ${cfg.pill}`} style={{ fontSize: 11 }}>{preset.type}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)', letterSpacing: '-0.01em' }}>
                      {preset.name}
                    </span>
                    {isSelected
                      ? <CheckCircle2 size={16} color={cfg.color} />
                      : <ChevronRight size={15} color="var(--text-4)" />
                    }
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.5 }}>{preset.description}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

    </div>
  );
}
