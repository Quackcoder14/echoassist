import React, { useRef, useState } from 'react';
import { UploadCloud, FileAudio, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';
import { PRESET_SAMPLES, createSyntheticWavBlob } from '../mockData';

export default function FileUpload({ onFileSelected, currentFile, isProcessing }) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndPassFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      validateAndPassFile(e.target.files[0]);
    }
  };

  const validateAndPassFile = (file) => {
    onFileSelected(file);
  };

  const handleSelectPreset = (preset) => {
    // Generate synthetic WAV blob matching preset
    const blob = createSyntheticWavBlob(preset.type, 6.0);
    const file = new File([blob], `${preset.id}_${preset.type}.wav`, { type: 'audio/wav' });
    onFileSelected(file);
  };

  return (
    <div className="space-y-4">
      {/* Drag and Drop Box */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`glass-card p-6 border-2 border-dashed cursor-pointer text-center relative overflow-hidden transition-all duration-200 ${
          isDragging
            ? 'border-cyan-400 bg-cyan-950/20 scale-[1.01]'
            : 'border-slate-700/60 hover:border-cyan-500/50 hover:bg-slate-800/40'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".wav,audio/wav"
          className="hidden"
          onChange={handleFileInputChange}
          disabled={isProcessing}
        />

        <div className="flex flex-col items-center justify-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <UploadCloud className="w-7 h-7" />
          </div>

          <div>
            <p className="text-base font-semibold text-white">
              {currentFile ? (
                <span className="text-cyan-400 flex items-center justify-center gap-1.5">
                  <FileAudio className="w-4 h-4" /> {currentFile.name}
                </span>
              ) : (
                'Drop raw phonocardiogram (.wav) recording here'
              )}
            </p>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              Supports single-channel 16-bit / 44.1kHz or 4kHz PhysioNet / PASCAL heart sound recordings
            </p>
          </div>

          {currentFile && (
            <div className="flex items-center gap-3 text-xs text-slate-400 font-mono bg-slate-900/60 px-3 py-1 rounded-full border border-slate-700/50">
              <span>Size: {(currentFile.size / 1024).toFixed(1)} KB</span>
              <span>•</span>
              <span>Type: {currentFile.type || 'audio/wav'}</span>
            </div>
          )}
        </div>
      </div>

      {/* Preset Quick Select for Judges & Evaluators */}
      <div className="bg-slate-900/50 p-4 rounded-xl border border-[var(--border-subtle)]">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Interactive Demo Presets (1-Click Test Bank)</span>
          </div>
          <span className="text-[11px] text-slate-500 font-mono">Real-time PCM Audio Synthesis</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {PRESET_SAMPLES.map((preset) => {
            const isSelected = currentFile?.name?.includes(preset.id);
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleSelectPreset(preset)}
                disabled={isProcessing}
                className={`text-left p-3 rounded-lg border transition-all relative ${
                  isSelected
                    ? 'bg-cyan-950/40 border-cyan-400 shadow-md shadow-cyan-900/20'
                    : 'bg-slate-800/40 hover:bg-slate-800/80 border-slate-700/60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white line-clamp-1">{preset.name}</span>
                  {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />}
                </div>
                <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">{preset.description}</p>
                <div className="mt-2 flex items-center gap-1">
                  <span
                    className={`text-[10px] font-semibold px-1.5 py-0.5 rounded capitalize ${
                      preset.type === 'normal'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : preset.type === 'murmur'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : preset.type === 'extrasystole'
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    }`}
                  >
                    {preset.type}
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
