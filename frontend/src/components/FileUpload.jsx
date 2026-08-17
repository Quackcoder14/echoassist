import React, { useRef, useState, useEffect } from 'react';
import { UploadCloud, FileAudio, CheckCircle2, Activity, Zap, VolumeX, Heart, ChevronRight } from 'lucide-react';
import { PRESET_SAMPLES, createSyntheticWavBlob } from '../mockData';
import { animate, stagger } from 'animejs';

const PRESET_CONFIG = {
  normal: {
    icon: Heart,
    color: '#059669',
    bgIcon: 'rgba(5, 150, 105, 0.12)',
    pill: 'pill-green',
    className: 'preset-normal',
  },
  murmur: {
    icon: Activity,
    color: '#D97706',
    bgIcon: 'rgba(217, 119, 6, 0.12)',
    pill: 'pill-yellow',
    className: 'preset-murmur',
  },
  extrasystole: {
    icon: Zap,
    color: '#7C3AED',
    bgIcon: 'rgba(124, 58, 237, 0.12)',
    pill: 'pill-purple',
    className: 'preset-extrasystole',
  },
  artifact: {
    icon: VolumeX,
    color: '#DC2626',
    bgIcon: 'rgba(220, 38, 38, 0.12)',
    pill: 'pill-red',
    className: 'preset-artifact',
  },
};

export default function FileUpload({ onFileSelected, currentFile, isProcessing }) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);
  const dropRef      = useRef(null);
  const presetsRef   = useRef(null);

  useEffect(() => {
    if (!presetsRef.current) return;
    animate(presetsRef.current.querySelectorAll('.preset-tile'), {
      opacity: [0, 1],
      translateY: [12, 0],
      duration: 380,
      delay: stagger(55, { start: 180 }),
      ease: 'outCubic',
    });
  }, []);

  const handleDragOver  = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.[0]) validateAndPassFile(e.dataTransfer.files[0]);
  };

  const handleFileInputChange = (e) => {
    if (e.target.files?.[0]) validateAndPassFile(e.target.files[0]);
  };

  const validateAndPassFile = (file) => {
    if (dropRef.current) {
      animate(dropRef.current, {
        scale: [1, 1.015, 1],
        duration: 320,
        ease: 'outCubic',
      });
    }
    onFileSelected(file);
  };

  const handleSelectPreset = (preset) => {
    const blob = createSyntheticWavBlob(preset.type, 6.0);
    const file = new File([blob], `${preset.id}_${preset.type}.wav`, { type: 'audio/wav' });
    onFileSelected(file);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Section header */}
      <div className="section-label">
        <div className="step-badge">1</div>
        <div>
          <h2>Ingest Recording</h2>
          <p>Upload a phonocardiogram (.wav) from a digital stethoscope</p>
        </div>
      </div>

      {/* Drop zone */}
      <div
        ref={dropRef}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isProcessing && fileInputRef.current?.click()}
        style={{
          border: `1.5px dashed ${isDragging ? 'var(--blue)' : 'var(--border-strong)'}`,
          borderRadius: 'var(--r-xl)',
          background: isDragging
            ? 'rgba(37,99,235,0.06)'
            : 'var(--surface-1)',
          padding: '32px 24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 14,
          cursor: isProcessing ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)',
          boxShadow: isDragging ? '0 0 0 4px rgba(37,99,235,0.12)' : '0 1px 4px rgba(15,23,42,0.04)',
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".wav,audio/wav"
          style={{ display: 'none' }}
          onChange={handleFileInputChange}
          disabled={isProcessing}
        />

        {/* Icon */}
        <div style={{
          width: 52,
          height: 52,
          borderRadius: 16,
          background: isDragging ? 'rgba(37,99,235,0.14)' : 'rgba(37,99,235,0.08)',
          border: `1px solid ${isDragging ? 'rgba(37,99,235,0.4)' : 'rgba(37,99,235,0.2)'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s ease',
        }}>
          {currentFile ? (
            <FileAudio size={22} color="var(--blue)" />
          ) : (
            <UploadCloud size={22} color="var(--blue)" />
          )}
        </div>

        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text-1)' }}>
            {currentFile ? (
              <span style={{ color: 'var(--blue)' }}>{currentFile.name}</span>
            ) : (
              'Drop recording here or click to browse'
            )}
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>
            {currentFile
              ? `${(currentFile.size / 1024).toFixed(1)} KB — audio/wav`
              : 'Supports WAV · PhysioNet 2016 / PASCAL · single-channel PCG'}
          </p>
        </div>
      </div>

      {/* Demo presets container */}
      <div style={{
        background: 'var(--surface-1)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-xl)',
        padding: '20px 22px',
        boxShadow: '0 4px 20px -4px rgba(15, 23, 42, 0.05)',
      }} ref={presetsRef}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 14,
        }}>
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-2)' }}>
            Demo Acoustic Presets
          </span>
          <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>
            Real-time PCM synthesis
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          {PRESET_SAMPLES.map((preset) => {
            const isSelected = currentFile?.name?.includes(preset.id);
            const cfg = PRESET_CONFIG[preset.type] || PRESET_CONFIG.normal;
            const IconComp = cfg.icon;

            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleSelectPreset(preset)}
                disabled={isProcessing}
                className={`preset-tile ${cfg.className} ${isSelected ? 'selected' : ''}`}
                style={{ opacity: 0 }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{
                    width: 32,
                    height: 32,
                    borderRadius: 10,
                    background: cfg.bgIcon,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: cfg.color,
                  }}>
                    <IconComp size={16} />
                  </div>

                  <span className={`pill ${cfg.pill}`} style={{ fontSize: 10, padding: '2px 8px' }}>
                    {preset.type}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 6,
                  }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)', letterSpacing: '-0.01em' }}>
                      {preset.name}
                    </span>
                    {isSelected ? (
                      <CheckCircle2 size={15} color={cfg.color} />
                    ) : (
                      <ChevronRight size={14} color="var(--text-3)" />
                    )}
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text-2)', lineHeight: 1.45 }}>
                    {preset.description}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
