"""
src/modeling/dataset.py
HeartSoundDataset — loads metadata.csv, converts WAV files to mel-spectrograms.
"""

import os
import numpy as np
import pandas as pd
import librosa
import torch
from torch.utils.data import Dataset


class HeartSoundDataset(Dataset):
    """
    PyTorch Dataset for heart sound classification.

    Reads metadata.csv (columns: id, filepath, label, split, duration_sec,
    source_dataset), filters to the requested split, loads each WAV file,
    converts to a log-mel spectrogram, pads/truncates to a fixed duration,
    and returns (spectrogram_tensor, label_int).

    Parameters
    ----------
    metadata_csv_path : str
        Path to data/processed/metadata.csv.
    split : str
        One of 'train', 'val', 'test'.
    sr : int
        Target sample rate for loading (default 2000 Hz).
    duration_sec : float
        Fixed clip duration in seconds (default 5.0).
    n_mels : int
        Number of mel filter-bank channels (default 128).
    n_fft : int
        FFT window size (default 256).
    hop_length : int
        Frame shift (default 64).
    """

    # Locked label mapping — shared across all modules
    # NOTE: Dataset only contains 'normal' and 'murmur' from PhysioNet CirCor
    LABEL_MAP = {
        "normal": 0,
        "murmur": 1,
    }
    INT_TO_LABEL = {v: k for k, v in LABEL_MAP.items()}

    def __init__(
        self,
        metadata_csv_path: str,
        split: str,
        sr: int = 2000,
        duration_sec: float = 5.0,
        n_mels: int = 128,
        n_fft: int = 256,
        hop_length: int = 64,
    ):
        if split not in ("train", "val", "test"):
            raise ValueError(f"split must be one of 'train', 'val', 'test'; got '{split}'")

        self.sr = sr
        self.duration_sec = duration_sec
        self.n_mels = n_mels
        self.n_fft = n_fft
        self.hop_length = hop_length
        self.target_samples = int(sr * duration_sec)

        # Resolve the base directory as the project root (one level above src/)
        # so that relative filepath values in metadata.csv resolve correctly.
        self._base_dir = os.path.abspath(
            os.path.join(os.path.dirname(__file__), "..", "..")
        )

        df = pd.read_csv(metadata_csv_path)
        self._df = df[df["split"] == split].reset_index(drop=True)

        if len(self._df) == 0:
            raise ValueError(
                f"No rows found for split='{split}' in {metadata_csv_path}"
            )

        # Validate all labels are known
        unknown = set(self._df["label"].unique()) - set(self.LABEL_MAP.keys())
        if unknown:
            raise ValueError(f"Unknown labels in metadata: {unknown}")

    # ------------------------------------------------------------------
    # Dataset interface
    # ------------------------------------------------------------------

    def __len__(self) -> int:
        return len(self._df)

    def __getitem__(self, idx: int):
        row = self._df.iloc[idx]
        filepath = os.path.join(self._base_dir, row["filepath"])
        label_int = self.LABEL_MAP[row["label"]]

        # Load and resample to target sr
        try:
            audio, _ = librosa.load(filepath, sr=self.sr, mono=True)
        except Exception as exc:
            # Graceful degradation: return zero tensor on corrupt/missing file
            audio = np.zeros(self.target_samples, dtype=np.float32)
            print(f"[HeartSoundDataset] Warning — could not load '{filepath}': {exc}")

        # Pad with zeros or truncate to fixed length
        audio = self._pad_or_truncate(audio)

        # Mel-spectrogram → log scale
        mel = librosa.feature.melspectrogram(
            y=audio,
            sr=self.sr,
            n_mels=self.n_mels,
            n_fft=self.n_fft,
            hop_length=self.hop_length,
            fmax=self.sr // 2,
        )
        log_mel = librosa.power_to_db(mel, ref=np.max)  # shape: (n_mels, T)

        # Normalise to [0, 1] for stable CNN training
        log_mel = (log_mel - log_mel.min()) / (log_mel.max() - log_mel.min() + 1e-8)

        # Add channel dim → (1, n_mels, T)
        tensor = torch.tensor(log_mel, dtype=torch.float32).unsqueeze(0)
        return tensor, label_int

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _pad_or_truncate(self, audio: np.ndarray) -> np.ndarray:
        """Return audio array with exactly self.target_samples samples."""
        n = len(audio)
        if n >= self.target_samples:
            return audio[: self.target_samples]
        # Pad with zeros on the right
        pad_width = self.target_samples - n
        return np.pad(audio, (0, pad_width), mode="constant")
