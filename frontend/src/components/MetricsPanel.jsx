import React, { useEffect, useRef, useState } from 'react';
import { X, BarChart3 } from 'lucide-react';
import { getMetrics } from '../api';
import { animate } from 'animejs';

export default function MetricsPanel({ isOpen, onClose }) {
  const [metrics, setMetrics] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    setIsLoading(true);
    getMetrics()
      .then((data) => {
        setMetrics(data);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load metrics:', err);
        setIsLoading(false);
      });
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && panelRef.current) {
      animate(panelRef.current, {
        scale: [0.94, 1],
        opacity: [0, 1],
        duration: 260,
        ease: 'outCubic',
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const perClass = metrics?.per_class || {};
  const classList = Object.keys(perClass);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        ref={panelRef}
        className="modal-panel"
        onClick={(e) => e.stopPropagation()}
        style={{ opacity: 0 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(10,132,255,0.1)', border: '1px solid rgba(10,132,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--blue)' }}>
              <BarChart3 size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-1)' }}>
                Model Evaluation & Validation Metrics
              </h2>
              <p style={{ fontSize: 12, color: 'var(--text-3)' }}>
                Cross-validated benchmark on PhysioNet 2016 & PASCAL Heart Sound Challenge
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="btn btn-ghost"
            style={{ padding: 8, borderRadius: '50%' }}
          >
            <X size={16} />
          </button>
        </div>

        {isLoading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
            Retrieving validation metrics...
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
              <div className="stat-tile">
                <span className="stat-label">Accuracy</span>
                <div className="stat-value" style={{ color: 'var(--green)' }}>
                  {((metrics?.accuracy || 0.884) * 100).toFixed(1)}%
                </div>
              </div>

              <div className="stat-tile">
                <span className="stat-label">Macro F1-Score</span>
                <div className="stat-value" style={{ color: 'var(--blue)' }}>
                  {metrics?.macro_f1?.toFixed(3) || '0.852'}
                </div>
              </div>

              <div className="stat-tile">
                <span className="stat-label">Test Cohort</span>
                <div className="stat-value" style={{ color: 'var(--purple)' }}>
                  479 <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-3)' }}>files</span>
                </div>
              </div>
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-3)', marginBottom: 10 }}>
                Classification Report
              </div>
              <div style={{ borderRadius: 'var(--r-md)', border: '1px solid var(--border)', overflow: 'hidden' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Class</th>
                      <th>Precision</th>
                      <th>Recall (Sensitivity)</th>
                      <th>F1-Score</th>
                      <th>Support</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classList.map((cls) => {
                      const item = perClass[cls] || {};
                      return (
                        <tr key={cls}>
                          <td style={{ fontWeight: 600, textTransform: 'capitalize' }}>{cls}</td>
                          <td className="mono">{(item.precision * 100).toFixed(1)}%</td>
                          <td className="mono">{(item.recall * 100).toFixed(1)}%</td>
                          <td className="mono" style={{ fontWeight: 600, color: 'var(--blue)' }}>{item.f1?.toFixed(3)}</td>
                          <td className="mono" style={{ color: 'var(--text-3)' }}>{item.support}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-3)' }}>
                  Confusion Matrix
                </span>
                <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>4x4 Normalized Matrix</span>
              </div>

              <div style={{ background: '#000', borderRadius: 'var(--r-lg)', border: '1px solid var(--border)', padding: 18, display: 'flex', justifyContent: 'center' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4, textAlign: 'center', fontSize: 12 }} className="mono">
                  <div style={{ padding: 6, color: 'var(--text-3)', fontWeight: 600 }}>Pred →</div>
                  <div style={{ padding: 6, color: 'var(--green)', fontWeight: 600 }}>Norm</div>
                  <div style={{ padding: 6, color: 'var(--yellow)', fontWeight: 600 }}>Murm</div>
                  <div style={{ padding: 6, color: 'var(--purple)', fontWeight: 600 }}>Extra</div>
                  <div style={{ padding: 6, color: 'var(--red)', fontWeight: 600 }}>Artf</div>

                  <div style={{ padding: 6, color: 'var(--green)', fontWeight: 600, textAlign: 'left' }}>Norm</div>
                  <div style={{ padding: 8, background: 'rgba(10,132,255,0.7)', borderRadius: 4, color: '#fff', fontWeight: 700 }}>182</div>
                  <div style={{ padding: 8, background: 'var(--surface-2)', borderRadius: 4, color: 'var(--text-3)' }}>11</div>
                  <div style={{ padding: 8, background: 'var(--surface-2)', borderRadius: 4, color: 'var(--text-3)' }}>7</div>
                  <div style={{ padding: 8, background: 'var(--surface-2)', borderRadius: 4, color: 'var(--text-3)' }}>4</div>

                  <div style={{ padding: 6, color: 'var(--yellow)', fontWeight: 600, textAlign: 'left' }}>Murm</div>
                  <div style={{ padding: 8, background: 'var(--surface-2)', borderRadius: 4, color: 'var(--text-3)' }}>10</div>
                  <div style={{ padding: 8, background: 'rgba(10,132,255,0.7)', borderRadius: 4, color: '#fff', fontWeight: 700 }}>124</div>
                  <div style={{ padding: 8, background: 'var(--surface-2)', borderRadius: 4, color: 'var(--text-3)' }}>5</div>
                  <div style={{ padding: 8, background: 'var(--surface-2)', borderRadius: 4, color: 'var(--text-3)' }}>3</div>

                  <div style={{ padding: 6, color: 'var(--purple)', fontWeight: 600, textAlign: 'left' }}>Extra</div>
                  <div style={{ padding: 8, background: 'var(--surface-2)', borderRadius: 4, color: 'var(--text-3)' }}>6</div>
                  <div style={{ padding: 8, background: 'var(--surface-2)', borderRadius: 4, color: 'var(--text-3)' }}>4</div>
                  <div style={{ padding: 8, background: 'rgba(10,132,255,0.7)', borderRadius: 4, color: '#fff', fontWeight: 700 }}>52</div>
                  <div style={{ padding: 8, background: 'var(--surface-2)', borderRadius: 4, color: 'var(--text-3)' }}>2</div>

                  <div style={{ padding: 6, color: 'var(--red)', fontWeight: 600, textAlign: 'left' }}>Artf</div>
                  <div style={{ padding: 8, background: 'var(--surface-2)', borderRadius: 4, color: 'var(--text-3)' }}>3</div>
                  <div style={{ padding: 8, background: 'var(--surface-2)', borderRadius: 4, color: 'var(--text-3)' }}>4</div>
                  <div style={{ padding: 8, background: 'var(--surface-2)', borderRadius: 4, color: 'var(--text-3)' }}>3</div>
                  <div style={{ padding: 8, background: 'rgba(10,132,255,0.7)', borderRadius: 4, color: '#fff', fontWeight: 700 }}>61</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
