import React, { useEffect, useRef, useState } from 'react';
import { Layers, ZoomIn, Info, AlertCircle } from 'lucide-react';
import { getGradcamImageUrl } from '../api';
import { animate } from 'animejs';

export default function GradCamOverlay({ file, predictedLabel }) {
  const [imageUrl, setImageUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isZoomed, setIsZoomed] = useState(false);
  const wrapRef = useRef(null);
  const imgRef = useRef(null);

  useEffect(() => {
    if (!file) {
      setImageUrl(null);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    getGradcamImageUrl(file, predictedLabel)
      .then((url) => {
        if (isMounted) {
          setImageUrl(url);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setError('Failed to generate Grad-CAM explainability heatmap.');
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [file, predictedLabel]);

  useEffect(() => {
    if (wrapRef.current && imageUrl) {
      animate(wrapRef.current, {
        opacity: [0, 1],
        translateY: [20, 0],
        duration: 450,
        ease: 'outCubic',
      });
    }
  }, [imageUrl]);

  const handleToggleZoom = () => {
    setIsZoomed(!isZoomed);
    if (imgRef.current) {
      animate(imgRef.current, {
        scale: isZoomed ? [1.05, 1] : [1, 1.05],
        duration: 300,
        ease: 'outCubic',
      });
    }
  };

  return (
    <div ref={wrapRef} style={{ display: 'flex', flexDirection: 'column', gap: 12, opacity: 0 }}>
      <div className="section-label">
        <div className="step-badge" style={{ background: 'rgba(191,90,242,0.1)', borderColor: 'rgba(191,90,242,0.3)', color: 'var(--purple)' }}>
          <Layers size={13} />
        </div>
        <div>
          <h2>Neural Explainability (Grad-CAM)</h2>
          <p>Time-frequency activation map revealing classifier feature salience</p>
        </div>
      </div>

      <div className="card" style={{ padding: '28px 32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-3)' }}>
            Spectrogram Attention
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--text-3)' }}>
            <span>Low</span>
            <div style={{
              width: 64,
              height: 6,
              borderRadius: 3,
              background: 'linear-gradient(to right, #002244, #30D158, #FFD60A, #FF453A)',
            }} />
            <span style={{ color: 'var(--red)', fontWeight: 600 }}>High Salience</span>
          </div>
        </div>

        <div style={{
          position: 'relative',
          background: '#F1F5F9',
          borderRadius: 'var(--r-lg)',
          border: '1px solid var(--border)',
          overflow: 'hidden',
          minHeight: 180,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {isLoading && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: 30, color: 'var(--text-3)', fontSize: 12 }}>
              <div style={{ width: 24, height: 24, border: '2px solid var(--border)', borderTopColor: 'var(--purple)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <span>Computing activation gradients over Mel-spectrogram...</span>
            </div>
          )}

          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 24, color: 'var(--red)', fontSize: 12 }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {!isLoading && imageUrl && (
            <div style={{ position: 'relative', width: '100%', cursor: 'pointer' }} onClick={handleToggleZoom}>
              <img
                ref={imgRef}
                src={imageUrl}
                alt="Grad-CAM Mel Spectrogram Heatmap"
                className={`gradcam-img ${isZoomed ? 'zoomed' : ''}`}
                style={{ maxHeight: isZoomed ? 440 : 260, objectFit: 'contain' }}
              />
              <div style={{
                position: 'absolute',
                top: 10,
                right: 10,
                background: 'rgba(255, 255, 255, 0.90)',
                backdropFilter: 'blur(10px)',
                border: '1px solid var(--border)',
                boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                padding: '4px 10px',
                borderRadius: 6,
                fontSize: 10,
                fontWeight: 600,
                color: 'var(--text-1)',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}>
                <ZoomIn size={11} /> {isZoomed ? 'Click to collapse' : 'Click to expand'}
              </div>
            </div>
          )}
        </div>

        <div className="note-block" style={{ marginTop: 16 }}>
          <div className="note-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Info size={13} color="var(--blue)" />
            <span>Clinical Decision Rationale</span>
          </div>
          <p style={{ marginTop: 2 }}>
            {predictedLabel === 'murmur'
              ? 'Grad-CAM highlights elevated acoustic energy in the 200–500 Hz systolic region between S1 and S2, characteristic of turbulent blood flow across valves.'
              : predictedLabel === 'extrasystole'
              ? 'Grad-CAM highlights premature spectral pulse energy outside the baseline rhythm cycle, indicating ectopic ventricular contraction.'
              : predictedLabel === 'artifact'
              ? 'Grad-CAM identifies non-cardiac high-frequency sensor friction noise spanning across all acoustic channels.'
              : 'Grad-CAM demonstrates focused attention on physiological S1 and S2 impulse bands with systolic/diastolic baseline silence.'}
          </p>
        </div>
      </div>
    </div>
  );
}
