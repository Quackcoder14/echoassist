"""
src/modeling/model.py
HeartSoundCNN — lightweight 3-block CNN for mel-spectrogram classification.

Design notes:
  - Last conv layer activations are stored as self.last_conv_activations
    during the forward pass so gradcam.py can hook them without modifying
    the model after the fact.
  - predict() is a module-level function with the exact signature expected
    by the FastAPI backend and the dashboard.
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
import numpy as np
from typing import Optional

from src.modeling.dataset import HeartSoundDataset


# ---------------------------------------------------------------------------
# Building blocks
# ---------------------------------------------------------------------------

class ConvBlock(nn.Module):
    """Conv2d → BatchNorm2d → ReLU → MaxPool2d."""

    def __init__(self, in_ch: int, out_ch: int, pool: bool = True):
        super().__init__()
        layers = [
            nn.Conv2d(in_ch, out_ch, kernel_size=3, padding=1, bias=False),
            nn.BatchNorm2d(out_ch),
            nn.ReLU(inplace=True),
        ]
        if pool:
            layers.append(nn.MaxPool2d(kernel_size=2, stride=2))
        self.block = nn.Sequential(*layers)

    def forward(self, x):
        return self.block(x)


# ---------------------------------------------------------------------------
# Main model
# ---------------------------------------------------------------------------

class HeartSoundCNN(nn.Module):
    """
    3-block CNN for heart sound classification from log-mel spectrograms.

    Input shape : (B, 1, n_mels, T)   — single-channel spectrogram
    Output shape: (B, num_classes)     — raw logits

    Attributes
    ----------
    last_conv_activations : torch.Tensor or None
        Set during every forward pass to the output of the final conv block
        (before AdaptiveAvgPool). Grad-CAM hooks this tensor.
    """

    def __init__(self, num_classes: int = 2):
        super().__init__()
        self.num_classes = num_classes

        # Block 1: 1 → 32 channels, with pooling
        self.conv1 = ConvBlock(1, 32, pool=True)
        # Block 2: 32 → 64 channels, with pooling
        self.conv2 = ConvBlock(32, 64, pool=True)
        # Block 3: 64 → 128 channels, NO pooling here so Grad-CAM has
        # a spatially meaningful feature map to visualise
        self.conv3 = ConvBlock(64, 128, pool=False)

        # Reference to the last conv layer for Grad-CAM hook registration
        self.last_conv = self.conv3.block[0]  # the nn.Conv2d itself

        self.pool = nn.AdaptiveAvgPool2d((1, 1))
        self.dropout = nn.Dropout(p=0.3)
        self.classifier = nn.Linear(128, num_classes)

        # Populated during every forward pass — used by gradcam.py
        self.last_conv_activations: Optional[torch.Tensor] = None

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = self.conv1(x)
        x = self.conv2(x)
        x = self.conv3(x)

        # Store pre-pool activations for Grad-CAM
        self.last_conv_activations = x  # (B, 128, H', W')

        x = self.pool(x)           # (B, 128, 1, 1)
        x = x.flatten(1)           # (B, 128)
        x = self.dropout(x)
        logits = self.classifier(x)  # (B, num_classes)
        return logits


class RespiratoryCNN(nn.Module):
    @property
    def last_conv(self):
        return self.features[8]

    def __init__(self, num_classes=4):
        super().__init__()
        self.num_classes = num_classes
        self.features = nn.Sequential(
            nn.Conv2d(1, 16, kernel_size=3, padding=1),
            nn.BatchNorm2d(16),
            nn.ReLU(),
            nn.MaxPool2d(2),
            
            nn.Conv2d(16, 32, kernel_size=3, padding=1),
            nn.BatchNorm2d(32),
            nn.ReLU(),
            nn.MaxPool2d(2),
            
            nn.Conv2d(32, 64, kernel_size=3, padding=1),
            nn.BatchNorm2d(64),
            nn.ReLU(),
            # No final pool here so Grad-CAM works on spatial dims
        )
        
        self.pool = nn.AdaptiveAvgPool2d((1, 1))
        self.classifier = nn.Sequential(
            nn.Linear(64, 32),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(32, num_classes)
        )
        self.last_conv_activations = None
        
    def forward(self, x):
        x = self.features(x)
        self.last_conv_activations = x
        x = self.pool(x)
        x = torch.flatten(x, 1)
        x = self.classifier(x)
        return x


# ---------------------------------------------------------------------------
# Inference helper — locked name/signature (used by FastAPI + dashboard)
# ---------------------------------------------------------------------------

def predict(model: nn.Module, input_tensor: torch.Tensor, organ: str = 'heart') -> dict:
    """
    Run inference on a single pre-processed spectrogram tensor.

    Parameters
    ----------
    model : nn.Module
        A trained model (HeartSoundCNN or RespiratoryCNN).
    input_tensor : torch.Tensor
        Shape (1, 1, n_mels, T) — batch dim included.
    organ : str
        'heart' or 'lung'. Determines the label mapping.

    Returns
    -------
    dict
        {"label": str, "confidence": float, "logits": list[float]}
    """
    model.eval()
    device = next(model.parameters()).device
    input_tensor = input_tensor.to(device)

    with torch.no_grad():
        logits = model(input_tensor)          # (1, num_classes)
        probs = F.softmax(logits, dim=1)      # (1, num_classes)
        pred_idx = int(probs.argmax(dim=1))
        confidence = float(probs[0, pred_idx])

    if organ == 'heart':
        label = HeartSoundDataset.INT_TO_LABEL[pred_idx]
    else:
        # Respiratory labels: 0: normal, 1: crackles, 2: wheezes, 3: both
        respiratory_labels = {0: 'normal', 1: 'crackles', 2: 'wheezes', 3: 'both'}
        label = respiratory_labels.get(pred_idx, 'normal')

    return {
        "label": label,
        "confidence": round(confidence, 6),
        "logits": logits[0].tolist(),
    }


# ---------------------------------------------------------------------------
# Quick sanity check
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    model = HeartSoundCNN(num_classes=4)
    total_params = sum(p.numel() for p in model.parameters())
    print(f"HeartSoundCNN — total params: {total_params:,}")

    dummy = torch.randn(2, 1, 128, 157)  # batch of 2, 5 s at sr=2000
    out = model(dummy)
    print(f"Output shape: {out.shape}")  # should be (2, 4)

    result = predict(model, dummy[:1])
    print(f"predict() output: {result}")
