import librosa
import numpy as np

def check_audio_validity(filepath: str) -> dict:
    """
    Runs basic sanity checks on an audio file before it enters the pipeline.
    Returns:
    {
        "valid": bool,
        "reason": str or None,   # e.g. "silence", "corrupted_file", "too_short", "ok"
        "duration_sec": float or None
    }
    """
    result = {
        "valid": False,
        "reason": None,
        "duration_sec": None
    }
    
    # 1. File loads without error
    try:
        y, sr = librosa.load(filepath, sr=None)
    except Exception:
        result["reason"] = "corrupted_file"
        return result
        
    if len(y) == 0:
        result["reason"] = "corrupted_file"
        return result
        
    # 2. Duration check
    duration = librosa.get_duration(y=y, sr=sr)
    result["duration_sec"] = float(duration)
    
    if duration < 1.0:
        result["reason"] = "too_short"
        return result
        
    # 3. Silence check
    rms = librosa.feature.rms(y=y)
    mean_rms = float(np.mean(rms))
    
    if mean_rms < 0.001:
        result["reason"] = "silence"
        return result
        
    # 4. If all checks pass
    result["valid"] = True
    result["reason"] = "ok"
    
    return result
