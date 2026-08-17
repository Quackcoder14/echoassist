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
import { checkValidity, predict, pingBackend, setApiMode, getApiMode } from './api';
import { Stethoscope, RefreshCw, AlertCircle, Check, ArrowRight, ArrowLeft } from 'lucide-react';
import { animate, stagger } from 'animejs';

const STAGES = [
  { id: 'ingest',   num: 1, label: 'Ingest' },
  { id: 'validate', num: 2, label: 'Validate' },
  { id: 'analyse',  num: 3, label: 'Analyse' },
  { id: 'explain',  num: 4, label: 'Explain' },
];

export default function App() {
  const [file, setFile] = useState(null);
  const [validity, setValidity] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isPredicting, setIsPredicting] = useState(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [isPlayingPcg, setIsPlayingPcg] = useState(false);
  const [isBackendLive, setIsBackendLive] = useState(false);
  const [apiMode, setModeState] = useState(getApiMode());
  const [isMetricsOpen, setIsMetricsOpen] = useState(false);
  const [generalError, setGeneralError] = useState(null);

  // Active step page (1..4)
  const [currentStep, setCurrentStep] = useState(1);

  const heroRef = useRef(null);
  const stagesTrackRef = useRef(null);

  // Health check
  useEffect(() => {
    let isMounted = true;
    const checkLive = async () => {
      const alive = await pingBackend();
      if (isMounted) setIsBackendLive(alive);
    };

    checkLive();
    const interval = setInterval(checkLive, 8000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Entrance animations for Hero and Stage Track
  useEffect(() => {
    if (heroRef.current) {
      animate(heroRef.current, {
        opacity: [0, 1],
        translateY: [20, 0],
        duration: 500,
        ease: 'outCubic',
      });
    }

    if (stagesTrackRef.current) {
      animate(stagesTrackRef.current.querySelectorAll('.pipeline-step'), {
        opacity: [0, 1],
        translateX: [-10, 0],
        duration: 400,
        delay: stagger(70, { start: 200 }),
        ease: 'outCubic',
      });
    }
  }, []);

  // Animate step transitions
  const goToStep = (stepNum) => {
    setCurrentStep(stepNum);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleToggleMode = () => {
    const nextMode = apiMode === 'auto' ? 'mock' : 'auto';
    setApiMode(nextMode);
    setModeState(nextMode);
  };

  const handleFileSelected = useCallback(async (selectedFile) => {
    if (!selectedFile) return;

    setFile(selectedFile);
    setValidity(null);
    setPrediction(null);
    setGeneralError(null);
    setAudioCurrentTime(0);
    setIsValidating(true);

    // Auto-advance to Step 2 (Validate)
    setCurrentStep(2);

    try {
      // Step 1: Acoustic Validity Check
      const validityRes = await checkValidity(selectedFile);
      setValidity(validityRes);
      setIsValidating(false);

      // Step 2: If invalid, remain on Step 2 to display failure reason
      if (!validityRes || !validityRes.valid) {
        return;
      }

      // Step 3: Run Classifier Prediction
      setIsPredicting(true);
      const predRes = await predict(selectedFile);
      setPrediction(predRes);
      setIsPredicting(false);
    } catch (err) {
      console.error('Pipeline error:', err);
      setGeneralError(err.message || 'An error occurred during audio processing.');
      setIsValidating(false);
      setIsPredicting(false);
    }
  }, []);

  const handleReset = () => {
    setFile(null);
    setValidity(null);
    setPrediction(null);
    setGeneralError(null);
    setAudioCurrentTime(0);
    setCurrentStep(1);
  };

  // Determine max unlocked step based on pipeline state
  const maxUnlockedStep = !file
    ? 1
    : isValidating
    ? 2
    : validity && !validity.valid
    ? 2
    : isPredicting
    ? 3
    : prediction
    ? 4
    : 3;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      {/* Header */}
      <Header
        isBackendLive={isBackendLive}
        apiMode={apiMode}
        onToggleMode={handleToggleMode}
        onOpenMetrics={() => setIsMetricsOpen(true)}
      />

      {/* Main Container */}
      <main style={{ flex: 1, maxWidth: 1080, width: '100%', margin: '0 auto', padding: '24px 20px 48px 20px', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Hero Banner */}
        <div ref={heroRef} className="card" style={{ padding: '22px 26px', opacity: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                background: 'rgba(10,132,255,0.1)',
                border: '1px solid rgba(10,132,255,0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--blue)',
                flexShrink: 0,
              }}>
                <Stethoscope size={22} />
              </div>
              <div>
                <h1 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.025em', color: 'var(--text-1)' }}>
                  Clinical Acoustic Decision Support System
                </h1>
                <p style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2, maxWidth: 640 }}>
                  Transforming raw phonocardiograms into defensible, traceable clinical data via deep learning, Grad-CAM salience maps, and Springer HMM cycle segmentation.
                </p>
              </div>
            </div>

            {file && (
              <button onClick={handleReset} className="btn btn-ghost" style={{ fontSize: 12 }}>
                <RefreshCw size={13} />
                <span>New Analysis</span>
              </button>
            )}
          </div>
        </div>

        {/* Interactive Step-by-Step Navigation Bar */}
        <div className="card" style={{ padding: '12px 20px' }}>
          <div ref={stagesTrackRef} className="pipeline-track" style={{ justifyContent: 'space-between' }}>
            {STAGES.map((s, idx) => {
              const isActive = currentStep === s.num;
              const isUnlocked = s.num <= maxUnlockedStep;
              const isDone = s.num < currentStep;

              return (
                <React.Fragment key={s.id}>
                  <button
                    onClick={() => isUnlocked && goToStep(s.num)}
                    disabled={!isUnlocked}
                    className={`pipeline-step ${isActive ? 'active' : ''} ${isDone ? 'completed' : ''}`}
                    style={{
                      opacity: 0,
                      cursor: isUnlocked ? 'pointer' : 'not-allowed',
                      border: 'none',
                      background: 'none',
                    }}
                  >
                    <div className="step-num">
                      {isDone ? <Check size={11} /> : s.num}
                    </div>
                    <span>{s.label}</span>
                  </button>

                  {idx < STAGES.length - 1 && (
                    <div className={`pipeline-connector ${s.num < maxUnlockedStep ? 'done' : ''}`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* General Error Banner */}
        {generalError && (
          <div className="card" style={{ padding: '14px 18px', borderColor: 'rgba(255,69,58,0.3)', background: 'rgba(255,69,58,0.08)', display: 'flex', alignItems: 'center', gap: 10, color: 'var(--red)', fontSize: 13 }}>
            <AlertCircle size={16} />
            <span>{generalError}</span>
          </div>
        )}

        {/* PAGE 1: INGEST */}
        {currentStep === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <FileUpload
              onFileSelected={handleFileSelected}
              currentFile={file}
              isProcessing={isValidating || isPredicting}
            />

            {file && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                <button
                  className="btn btn-primary"
                  onClick={() => goToStep(2)}
                  style={{ gap: 8 }}
                >
                  <span>Continue to Validation</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* PAGE 2: VALIDATE */}
        {currentStep === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {isValidating && (
              <div className="card" style={{ padding: '28px', textAlign: 'center', fontSize: 13, color: 'var(--blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                <div style={{ width: 20, height: 20, border: '2px solid rgba(10,132,255,0.2)', borderTopColor: 'var(--blue)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                <span>Running acoustic signal noise-floor & SNR integrity checks...</span>
              </div>
            )}

            <ValidityBanner validity={validity} />

            {/* Navigation buttons */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
              <button className="btn btn-ghost" onClick={() => goToStep(1)}>
                <ArrowLeft size={14} />
                <span>Back to Ingest</span>
              </button>

              {validity?.valid && (
                <button
                  className="btn btn-primary"
                  onClick={() => goToStep(3)}
                  disabled={isPredicting}
                  style={{ gap: 8 }}
                >
                  <span>{isPredicting ? 'Analysing...' : 'Proceed to Analysis'}</span>
                  <ArrowRight size={14} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* PAGE 3: ANALYSE */}
        {currentStep === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Waveform Player */}
            <WaveformView
              file={file}
              onTimeUpdate={(t) => setAudioCurrentTime(t)}
              onPlayStateChange={(playing) => setIsPlayingPcg(playing)}
            />

            {/* Neural Classification Result */}
            <ClassificationResult
              result={prediction}
              isPredicting={isPredicting}
              isPlayingAudio={isPlayingPcg}
            />

            {/* Navigation Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
              <button className="btn btn-ghost" onClick={() => goToStep(2)}>
                <ArrowLeft size={14} />
                <span>Back to Validation</span>
              </button>

              <button
                className="btn btn-primary"
                onClick={() => goToStep(4)}
                disabled={!prediction}
                style={{ gap: 8 }}
              >
                <span>View Explainability & Segmentation</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* PAGE 4: EXPLAIN */}
        {currentStep === 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Multi-Factor Acoustic Explainability */}
            <FactorContributions
              explanation={prediction?.explanation}
              predictedClass={prediction?.label}
            />

            {/* Cardiac Cycle Segmentation */}
            <SegmentationOverlay
              file={file}
              currentTime={audioCurrentTime}
              totalDuration={validity?.duration_sec || 6.0}
            />

            {/* Grad-CAM Spectrogram Explainability */}
            <GradCamOverlay
              file={file}
              predictedLabel={prediction?.label || 'normal'}
            />

            {/* Navigation Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
              <button className="btn btn-ghost" onClick={() => goToStep(3)}>
                <ArrowLeft size={14} />
                <span>Back to Analysis</span>
              </button>

              <button className="btn btn-ghost" onClick={handleReset} style={{ color: 'var(--blue)' }}>
                <RefreshCw size={13} />
                <span>Analyze New Recording</span>
              </button>
            </div>
          </div>
        )}

      </main>

      {/* Evaluation Metrics Modal */}
      <MetricsPanel
        isOpen={isMetricsOpen}
        onClose={() => setIsMetricsOpen(false)}
      />

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--border)', background: 'rgba(0,0,0,0.8)', padding: '16px 24px', textAlign: 'center', fontSize: 11, color: 'var(--text-3)' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <span>EchoAssist System • PS-S01 Clinical Acoustic Decision Support</span>
          <span>PASCAL · PhysioNet 2016 · CirCor DigiScope 2022 — Tri-Dataset Pipeline</span>
        </div>
      </footer>
    </div>
  );
}
