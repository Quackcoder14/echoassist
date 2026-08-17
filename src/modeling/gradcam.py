"""
src/modeling/gradcam.py
Standard Grad-CAM implementation for HeartSoundCNN.

Functions
---------
generate_gradcam(model, input_tensor, target_class=None) -> np.ndarray
    Produce a (H, W) float32 heatmap in [0, 1].

overlay_heatmap_on_spectrogram(spectrogram, heatmap) -> np.ndarray
    Blend the heatmap onto the spectrogram and return an (H, W, 3) RGB image.

Both outputs are pure numpy arrays — no PyTorch required by the caller.
"""

import numpy as np
import cv2
import torch
import torch.nn.functional as F
from typing import Optional


def generate_gradcam(
    model,
    input_tensor: torch.Tensor,
    target_class: Optional[int] = None,
) -> np.ndarray:
    """
    Compute a Grad-CAM heatmap for the given input.

    Parameters
    ----------
    model : HeartSoundCNN
        A trained model in eval or train mode — mode is restored afterward.
    input_tensor : torch.Tensor
        Shape (1, 1, n_mels, T). Single sample, batch dim included.
    target_class : int or None
        Class index to explain. If None, uses the predicted class.

    Returns
    -------
    np.ndarray
        Float32 heatmap of shape (n_mels, T), values normalised to [0, 1].
        Upsampled to match the input spatial dimensions.
    """
    device = next(model.parameters()).device
    input_tensor = input_tensor.to(device)

    was_training = model.training
    model.eval()

    # ── Register hooks ──────────────────────────────────────────────────
    activations: list = []
    gradients: list = []

    def _forward_hook(module, inp, out):
        activations.append(out.detach())

    def _backward_hook(module, grad_in, grad_out):
        gradients.append(grad_out[0].detach())

    fwd_handle = model.last_conv.register_forward_hook(_forward_hook)
    bwd_handle = model.last_conv.register_full_backward_hook(_backward_hook)

    try:
        # ── Forward pass (grad enabled) ──────────────────────────────────
        model.zero_grad()
        logits = model(input_tensor)           # (1, num_classes)

        if target_class is None:
            target_class = int(logits.argmax(dim=1))

        # ── Backward pass for target class ────────────────────────────────
        score = logits[0, target_class]
        score.backward()

        # ── Grad-CAM computation ──────────────────────────────────────────
        acts = activations[0].squeeze(0)   # (C, H', W')
        grads = gradients[0].squeeze(0)    # (C, H', W')

        # Global average pool of gradients → channel weights
        weights = grads.mean(dim=(1, 2))   # (C,)

        # Weighted sum of activation maps
        cam = torch.einsum("c,chw->hw", weights, acts)  # (H', W')
        cam = F.relu(cam)                  # keep only positive contributions

        # Upsample to input spatial size (n_mels, T)
        h_in = input_tensor.shape[2]
        w_in = input_tensor.shape[3]
        cam = cam.unsqueeze(0).unsqueeze(0)  # (1, 1, H', W')
        cam = F.interpolate(
            cam, size=(h_in, w_in), mode="bilinear", align_corners=False
        )
        cam = cam.squeeze().cpu().numpy()    # (n_mels, T)

        # Normalise to [0, 1]
        cam_min, cam_max = cam.min(), cam.max()
        if cam_max - cam_min > 1e-8:
            cam = (cam - cam_min) / (cam_max - cam_min)
        else:
            cam = np.zeros_like(cam)

    finally:
        fwd_handle.remove()
        bwd_handle.remove()
        if was_training:
            model.train()

    return cam.astype(np.float32)


def overlay_heatmap_on_spectrogram(
    spectrogram: np.ndarray,
    heatmap: np.ndarray,
    alpha: float = 0.45,
) -> np.ndarray:
    """
    Overlay a Grad-CAM heatmap on a spectrogram image.

    Parameters
    ----------
    spectrogram : np.ndarray
        2-D float array (H, W) with values in any range.
        Typically the log-mel spectrogram (e.g., shape (128, T)).
    heatmap : np.ndarray
        2-D float array (H, W), values in [0, 1].
        Must match spectrogram spatial dimensions.
    alpha : float
        Heatmap blend weight (0 = no heatmap, 1 = only heatmap).

    Returns
    -------
    np.ndarray
        (H, W, 3) uint8 RGB image ready to save or display.
    """
    # Normalise spectrogram to [0, 255] uint8 greyscale
    spec_norm = spectrogram.copy().astype(np.float32)
    spec_min, spec_max = spec_norm.min(), spec_norm.max()
    if spec_max - spec_min > 1e-8:
        spec_norm = (spec_norm - spec_min) / (spec_max - spec_min)
    spec_uint8 = (spec_norm * 255).astype(np.uint8)

    # Convert greyscale → BGR for OpenCV
    spec_bgr = cv2.cvtColor(spec_uint8, cv2.COLOR_GRAY2BGR)

    # Resize heatmap to match spectrogram if needed
    if heatmap.shape != spectrogram.shape:
        heatmap = cv2.resize(
            heatmap, (spectrogram.shape[1], spectrogram.shape[0]),
            interpolation=cv2.INTER_LINEAR,
        )

    # Apply JET colormap to heatmap
    heatmap_uint8 = (heatmap * 255).astype(np.uint8)
    heatmap_bgr = cv2.applyColorMap(heatmap_uint8, cv2.COLORMAP_JET)

    # Blend
    overlay_bgr = cv2.addWeighted(spec_bgr, 1 - alpha, heatmap_bgr, alpha, 0)

    # Return as RGB (dashboard-friendly)
    overlay_rgb = cv2.cvtColor(overlay_bgr, cv2.COLOR_BGR2RGB)
    return overlay_rgb


# ---------------------------------------------------------------------------
# Quick smoke test
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import os
    import sys

    # Allow running from repo root: python -m src.modeling.gradcam
    sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

    from src.modeling.model import HeartSoundCNN

    print("Grad-CAM smoke test …")
    model = HeartSoundCNN(num_classes=4)
    dummy_input = torch.randn(1, 1, 128, 157)

    heatmap = generate_gradcam(model, dummy_input, target_class=0)
    print(f"Heatmap shape: {heatmap.shape}, min={heatmap.min():.3f}, max={heatmap.max():.3f}")

    dummy_spec = dummy_input.squeeze().numpy()  # (128, 157)
    overlay = overlay_heatmap_on_spectrogram(dummy_spec, heatmap)
    print(f"Overlay shape: {overlay.shape}, dtype={overlay.dtype}")

    # Save to disk for visual inspection
    import cv2 as _cv2
    _cv2.imwrite("outputs/figures/gradcam_test.png", _cv2.cvtColor(overlay, _cv2.COLOR_RGB2BGR))
    print("Saved -> outputs/figures/gradcam_test.png")
