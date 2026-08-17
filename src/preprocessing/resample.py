"""
EchoAssist — Audio Resampling Module

Resamples audio files to a fixed target sample rate (2000 Hz by default)
so every downstream consumer receives a consistent input shape.
"""

import librosa
import soundfile as sf


def resample_audio(input_path: str, output_path: str, target_sr: int = 2000) -> str:
    """
    Resamples audio to a fixed target sample rate.

    Parameters
    ----------
    input_path : str
        Path to the audio file to resample.
    output_path : str
        Where to save the resampled audio.
    target_sr : int, optional
        Target sample rate in Hz (default 2000 — the team-wide standard,
        matching PhysioNet 2016's native rate).

    Returns
    -------
    str
        output_path — the path the resampled file was written to.
    """
    # librosa resamples automatically when sr is explicitly given
    y, _ = librosa.load(input_path, sr=target_sr)

    # Write at the target sample rate
    sf.write(output_path, y, target_sr)

    return output_path
