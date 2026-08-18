import React, { useState, useEffect, useCallback, useRef } from 'react';
import Header from './components/Header';
import FileUpload from './components/FileUpload';
import ValidityBanner from './components/ValidityBanner';
import WaveformView from './components/WaveformView';
import ClassificationResult from './components/ClassificationResult';
import GradCamOverlay from './components/GradCamOverlay';
import SegmentationOverlay from './components/SegmentationOverlay';
import FactorContributions from './components/FactorContributions';
import MetricsPanel from './components/MetricsPanel';
import SplashScreen from './components/SplashScreen';
import { checkValidity, predict, pingBackend, setApiMode, getApiMode } from './api';
import { RefreshCw, AlertCircle, Check, ArrowRight, ArrowLeft } from 'lucide-react';
import { animate, stagger } from 'animejs';

const STAGES = [
  { id: 'ingest',   num: 1, label: 'Ingest',   desc: 'Upload recording' },
  { id: 'validate', num: 2, label: 'Validate',  desc: 'Signal quality check' },
  { id: 'analyse',  num: 3, label: 'Analyse',   desc: 'Neural classification' },
  { id: 'explain',  num: 4, label: 'Explain',   desc: 'Acoustic explainability' },
];

export default function App() {
  const [showSplash, setShowSplash]     = useState(true);
  const [file, setFile]                 = useState(null);
  const [validity, setValidity]         = useState(null);
  const [prediction, setPrediction]     = useState(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isPredicting, setIsPredicting] = useState(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [isPlayingPcg, setIsPlayingPcg] = useState(false);
  const [isBackendLive, setIsBackendLive] = useState(false);
  const [apiMode, setModeState]         = useState(getApiMode());
  const [isMetricsOpen, setIsMetricsOpen] = useState(false);
  const [generalError, setGeneralError] = useState(null);
  const [currentStep, setCurrentStep]   = useState(1);
  const [organMode, setOrganMode]       = useState('lung'); // 'heart' | 'lung'

  const pageRef = useRef(null);

  /* ── Apply organ theme to body ───────────────────────────────────── */
  useEffect(() => {
    document.body.setAttribute('data-theme', organMode);
  }, [organMode]);

  /* ── Initial theme ────────────────────────────────────────────────── */
  useEffect(() => {
    document.body.setAttribute('data-theme', 'lung');
  }, []);

  /* ── Health check ──────────────────────────────────────────────── */
  useEffect(() => {
    let live = true;
    const check = async () => { const a = await pingBackend(); if (live) setIsBackendLive(a); };
    check();
    const iv = setInterval(check, 8000);
    return () => { live = false; clearInterval(iv); };
  }, []);

  /* ── Animate page content in on step change ─────────────────────── */
  useEffect(() => {
    if (!pageRef.current) return;
    animate(pageRef.current, {
      opacity: [0, 1], translateY: [18, 0],
      duration: 420, ease: 'outCubic',
    });
  }, [currentStep]);

  /* ── Navigation ─────────────────────────────────────────────────── */
  const goToStep = (n) => {
    setCurrentStep(n);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleToggleMode = () => {
    const next = apiMode === 'auto' ? 'mock' : 'auto';
    setApiMode(next); setModeState(next);
  };

  const handleOrganChange = (mode) => {
    setOrganMode(mode);
    // Reset analysis when switching organ mode
    setFile(null); setValidity(null); setPrediction(null);
    setGeneralError(null); setAudioCurrentTime(0); setCurrentStep(1);
  };

  const handleFileSelected = useCallback(async (selectedFile) => {
    if (!selectedFile) return;
    setFile(selectedFile); setValidity(null); setPrediction(null);
    setGeneralError(null); setAudioCurrentTime(0); setIsValidating(true);
    setCurrentStep(2);
    try {
      const vr = await checkValidity(selectedFile);
      setValidity(vr); setIsValidating(false);
      if (!vr?.valid) return;
      setIsPredicting(true);
      const pr = await predict(selectedFile, organMode);
      setPrediction(pr); setIsPredicting(false);
    } catch (err) {
      setGeneralError(err.message || 'Processing error.');
      setIsValidating(false); setIsPredicting(false);
    }
  }, [organMode]);

  const handleReset = () => {
    setFile(null); setValidity(null); setPrediction(null);
    setGeneralError(null); setAudioCurrentTime(0); setCurrentStep(1);
  };

  const maxUnlocked = !file ? 1
    : isValidating ? 2
    : validity && !validity.valid ? 2
    : isPredicting ? 3
    : prediction ? 4 : 3;

  if (showSplash) return <SplashScreen onFinished={() => setShowSplash(false)} />;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>

      {/* ── Sticky Header ── */}
      <Header
        isBackendLive={isBackendLive}
        apiMode={apiMode}
        onToggleMode={handleToggleMode}
        onOpenMetrics={() => setIsMetricsOpen(true)}
        organMode={organMode}
        onOrganChange={handleOrganChange}
      />

      {/* ── Sticky Pipeline Stage Bar (directly below header) ── */}
      <div style={{
        position: 'sticky', top: 56, zIndex: 40,
        background: 'rgba(238,245,255,0.85)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        borderBottom: '1px solid var(--border)',
        boxShadow: '0 2px 16px -4px rgba(37,99,235,0.08)',
      }}>
        <div style={{ maxWidth: 1360, margin: '0 auto', padding: '0 28px' }}>
          <div style={{ display: 'flex', alignItems: 'stretch', gap: 0 }}>
            {STAGES.map((s, idx) => {
              const isActive   = currentStep === s.num;
              const isUnlocked = s.num <= maxUnlocked;
              const isDone     = s.num < currentStep;
              return (
                <React.Fragment key={s.id}>
                  <button
                    onClick={() => isUnlocked && goToStep(s.num)}
                    disabled={!isUnlocked}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '14px 20px', border: 'none', background: 'none',
                      cursor: isUnlocked ? 'pointer' : 'not-allowed',
                      borderBottom: isActive ? '2.5px solid var(--blue)' : '2.5px solid transparent',
                      transition: 'all .25s ease', fontFamily: 'inherit', flex: 1,
                      justifyContent: 'center',
                      opacity: isUnlocked ? 1 : 0.38,
                    }}
                  >
                    <div style={{
                      width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 700,
                      background: isDone ? 'var(--green)' : isActive ? 'var(--blue)' : 'rgba(37,99,235,0.10)',
                      color: isDone || isActive ? '#fff' : 'var(--blue)',
                      border: `1.5px solid ${isDone ? 'var(--green)' : isActive ? 'var(--blue)' : 'rgba(37,99,235,0.25)'}`,
                      boxShadow: isActive ? '0 0 12px rgba(37,99,235,0.35)' : 'none',
                      transition: 'all .3s ease',
                    }}>
                      {isDone ? <Check size={12} /> : s.num}
                    </div>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{
                        fontSize: 13, fontWeight: 700, letterSpacing: '-0.01em',
                        color: isActive ? 'var(--blue)' : isDone ? 'var(--green)' : 'var(--text-3)',
                        transition: 'color .25s ease',
                      }}>{s.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 1 }}>{s.desc}</div>
                    </div>
                  </button>
                  {idx < STAGES.length - 1 && (
                    <div style={{
                      width: 1, margin: '10px 0',
                      background: 'var(--border)',
                    }} />
                  )}
                </React.Fragment>
              );
            })}

            {/* Right: Reset button */}
            {file && (
              <button
                onClick={handleReset}
                className="btn btn-ghost btn-sm"
                style={{ margin: 'auto 0 auto 16px', flexShrink: 0 }}
              >
                <RefreshCw size={13} /> New
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Main Content ── */}
      <main style={{ flex: 1, maxWidth: 1360, width: '100%', margin: '0 auto', padding: '32px 28px 72px', display: 'flex', flexDirection: 'column', gap: 28 }}>

        {/* Error Banner */}
        {generalError && (
          <div style={{
            padding: '14px 20px', borderRadius: 'var(--r-lg)',
            background: 'rgba(220,38,38,0.07)', border: '1px solid rgba(220,38,38,0.25)',
            display: 'flex', alignItems: 'center', gap: 12,
            color: 'var(--red)', fontSize: 14,
          }}>
            <AlertCircle size={18} />
            <span>{generalError}</span>
          </div>
        )}

        {/* ── PAGE 1: INGEST ── */}
        {currentStep === 1 && (
          <div ref={pageRef} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <FileUpload
              onFileSelected={handleFileSelected}
              currentFile={file}
              isProcessing={isValidating || isPredicting}
              organMode={organMode}
            />
            {file && (
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn btn-primary btn-lg" onClick={() => goToStep(2)} style={{ gap: 10 }}>
                  <span>Continue to Validation</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── PAGE 2: VALIDATE ── */}
        {currentStep === 2 && (
          <div ref={pageRef} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {isValidating && (
              <div className="card" style={{
                padding: '36px', textAlign: 'center',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14,
                fontSize: 15, color: 'var(--blue)',
                background: 'linear-gradient(135deg,rgba(255,255,255,.94),rgba(235,244,255,.92))',
              }}>
                <div style={{ width: 22, height: 22, border: '2.5px solid rgba(37,99,235,0.15)', borderTopColor: 'var(--blue)', borderRadius: '50%', animation: 'spin 0.75s linear infinite', flexShrink: 0 }} />
                <span>Running acoustic signal quality checks…</span>
              </div>
            )}
            <ValidityBanner validity={validity} organMode={organMode} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <button className="btn btn-ghost" onClick={() => goToStep(1)}>
                <ArrowLeft size={15} /> Back
              </button>
              {validity?.valid && (
                <button className="btn btn-primary btn-lg" onClick={() => goToStep(3)} disabled={isPredicting} style={{ gap: 10 }}>
                  <span>{isPredicting ? 'Analysing…' : 'Proceed to Analysis'}</span>
                  <ArrowRight size={16} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── PAGE 3: ANALYSE ── */}
        {currentStep === 3 && (
          <div ref={pageRef} style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            <WaveformView
              file={file}
              onTimeUpdate={(t) => setAudioCurrentTime(t)}
              onPlayStateChange={(p) => setIsPlayingPcg(p)}
              organMode={organMode}
            />
            <ClassificationResult
              result={prediction}
              isPredicting={isPredicting}
              isPlayingAudio={isPlayingPcg}
              organMode={organMode}
            />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <button className="btn btn-ghost" onClick={() => goToStep(2)}>
                <ArrowLeft size={15} /> Back
              </button>
              <button className="btn btn-primary btn-lg" onClick={() => goToStep(4)} disabled={!prediction} style={{ gap: 10 }}>
                <span>View Full Explanation</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ── PAGE 4: EXPLAIN ── */}
        {currentStep === 4 && (
          <div ref={pageRef} style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            <FactorContributions
              explanation={prediction?.explanation}
              predictedClass={prediction?.label}
              organMode={organMode}
            />
            {/* Only show cardiac segmentation for heart mode */}
            {organMode === 'heart' && (
              <SegmentationOverlay
                file={file}
                currentTime={audioCurrentTime}
                totalDuration={validity?.duration_sec || 6.0}
              />
            )}
            <GradCamOverlay
              file={file}
              predictedLabel={prediction?.label || 'normal'}
              organMode={organMode}
            />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <button className="btn btn-ghost" onClick={() => goToStep(3)}>
                <ArrowLeft size={15} /> Back
              </button>
              <button className="btn btn-ghost" onClick={handleReset} style={{ color: 'var(--blue)', borderColor: 'var(--border-strong)' }}>
                <RefreshCw size={14} /> Analyze New Recording
              </button>
            </div>
          </div>
        )}

      </main>

      <MetricsPanel isOpen={isMetricsOpen} onClose={() => setIsMetricsOpen(false)} organMode={organMode} />

      <footer style={{ borderTop: '1px solid var(--border)', background: 'rgba(255,255,255,0.72)', backdropFilter: 'blur(16px)', padding: '18px 32px' }}>
        <div style={{ maxWidth: 1360, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, fontSize: 12, color: 'var(--text-3)' }}>
          <span style={{ fontWeight: 600, color: 'var(--text-2)' }}>EchoAssist · Clinical Acoustic Intelligence</span>
          <span>{organMode === 'lung' ? 'ICBHI 2017 · HF Lung · RespiratoryDB' : 'PASCAL · PhysioNet 2016 · CirCor DigiScope 2022'}</span>
        </div>
      </footer>
    </div>
  );
}
