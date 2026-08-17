import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import FileUpload from './components/FileUpload';
import ValidityBanner from './components/ValidityBanner';
import WaveformView from './components/WaveformView';
import ClassificationResult from './components/ClassificationResult';
import GradCamOverlay from './components/GradCamOverlay';
import SegmentationOverlay from './components/SegmentationOverlay';
import MetricsPanel from './components/MetricsPanel';
import { checkValidity, predict, pingBackend, setApiMode, getApiMode } from './api';
import { Stethoscope, Sparkles, RefreshCw, AlertCircle } from 'lucide-react';

export default function App() {
  const [file, setFile] = useState(null);
  const [validity, setValidity] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isPredicting, setIsPredicting] = useState(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [isBackendLive, setIsBackendLive] = useState(false);
  const [apiMode, setModeState] = useState(getApiMode());
  const [isMetricsOpen, setIsMetricsOpen] = useState(false);
  const [generalError, setGeneralError] = useState(null);

  // Check backend health on mount and periodically
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

    try {
      // Step 1: Acoustic Validity Check FIRST
      const validityRes = await checkValidity(selectedFile);
      setValidity(validityRes);
      setIsValidating(false);

      // Step 2: If invalid, gracefully stop - do NOT call /predict
      if (!validityRes || !validityRes.valid) {
        return;
      }

      // Step 3: Run Classifier Prediction
      setIsPredicting(true);
      const predRes = await predict(selectedFile);
      setPrediction(predRes);
      setIsPredicting(false);
    } catch (err) {
      console.error('Processing pipeline error:', err);
      setGeneralError(err.message || 'An unexpected error occurred during audio processing.');
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
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-main)] text-[var(--text-primary)]">
      {/* Top Navbar */}
      <Header
        isBackendLive={isBackendLive}
        apiMode={apiMode}
        onToggleMode={handleToggleMode}
        onOpenMetrics={() => setIsMetricsOpen(true)}
      />

      {/* Main Content Dashboard */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Intro banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-cyan-950/40 via-slate-900/60 to-indigo-950/30 p-5 rounded-2xl border border-[var(--border-subtle)]">
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Stethoscope className="w-5 h-5 text-cyan-400" />
              Phonocardiogram Acoustic Signal Interpreter
            </h2>
            <p className="text-xs text-[var(--text-secondary)] max-w-2xl leading-relaxed">
              Transforming raw cardiac waveforms into defensible, traceable, and revisitable clinical decision-support data with Grad-CAM salience and S1/S2 cycle segmentation.
            </p>
          </div>

          {file && (
            <button
              onClick={handleReset}
              className="btn-secondary text-xs self-start sm:self-center"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>New Analysis</span>
            </button>
          )}
        </div>

        {/* Pipeline Flow Area */}
        <div className="space-y-5">
          {/* 1. File Upload Dropzone & Sample Presets */}
          <FileUpload
            onFileSelected={handleFileSelected}
            currentFile={file}
            isProcessing={isValidating || isPredicting}
          />

          {/* Validation Loading Indicator */}
          {isValidating && (
            <div className="glass-card p-4 flex items-center justify-center gap-3 text-xs font-mono text-cyan-300 animate-pulse">
              <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
              <span>Running noise-reduction & acoustic SNR validity checks...</span>
            </div>
          )}

          {/* General Pipeline Error */}
          {generalError && (
            <div className="glass-card border-rose-500/40 bg-rose-950/30 p-4 rounded-xl flex items-center gap-3 text-xs text-rose-300">
              <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />
              <span>{generalError}</span>
            </div>
          )}

          {/* 2. Validity Result Banner (Valid vs Graceful Halt) */}
          <ValidityBanner validity={validity} />

          {/* 3. Downstream Components (Displayed only if validity === true) */}
          {validity?.valid && file && (
            <div className="space-y-5 animate-fadeIn">
              {/* Primary Row: Classification Result & Confidence Logits */}
              <ClassificationResult
                result={prediction}
                isPredicting={isPredicting}
              />

              {/* Waveform Visualization (WaveSurfer.js) */}
              <WaveformView
                file={file}
                onTimeUpdate={(time) => setAudioCurrentTime(time)}
              />

              {/* S1 / Systole / S2 / Diastole Cardiac Cycle Segmentation */}
              <SegmentationOverlay
                file={file}
                currentTime={audioCurrentTime}
                totalDuration={validity.duration_sec || 6.0}
              />

              {/* Explainability: Grad-CAM Mel-Spectrogram Heatmap */}
              <GradCamOverlay
                file={file}
                predictedLabel={prediction?.label || 'normal'}
              />
            </div>
          )}
        </div>
      </main>

      {/* Evaluation Metrics Modal */}
      <MetricsPanel
        isOpen={isMetricsOpen}
        onClose={() => setIsMetricsOpen(false)}
      />

      {/* Footer */}
      <footer className="border-t border-[var(--border-subtle)] bg-[rgba(9,13,22,0.9)] py-4 text-center text-xs text-slate-500 font-mono">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>EchoAssist System • PS-S01 Clinical Acoustic Decision Support</span>
          <span>PhysioNet 2016 / PASCAL Heart Sound Challenge Pipeline</span>
        </div>
      </footer>
    </div>
  );
}
