"""
src/modeling/train.py
Training loop for HeartSoundCNN.

Features:
  - Class-weighted CrossEntropyLoss (handles imbalanced label distribution)
  - Saves best checkpoint by macro-averaged val F1 (not just val loss)
  - ReduceLROnPlateau scheduler
  - Per-epoch reporting: train loss, val loss, val accuracy, val F1
  - Saves confusion matrix PNG to outputs/figures/

Run end-to-end:
    python -m src.modeling.train
"""

import os
import json

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
import matplotlib
matplotlib.use("Agg")  # non-interactive backend — safe for server use
import matplotlib.pyplot as plt
from torch.utils.data import DataLoader
from sklearn.utils.class_weight import compute_class_weight
from sklearn.metrics import (
    f1_score,
    accuracy_score,
    classification_report,
    confusion_matrix,
    ConfusionMatrixDisplay,
)

from src.modeling.dataset import HeartSoundDataset
from src.modeling.model import HeartSoundCNN


# ---------------------------------------------------------------------------
# Core training function
# ---------------------------------------------------------------------------

def train_model(
    train_loader: DataLoader,
    val_loader: DataLoader,
    num_epochs: int = 20,
    lr: float = 1e-3,
    save_path: str = "outputs/checkpoints/model.pt",
    figures_dir: str = "outputs/figures",
    class_weights: torch.Tensor = None,
    device: torch.device = None,
) -> dict:
    """
    Train HeartSoundCNN and save the best checkpoint (by val macro-F1).

    Parameters
    ----------
    train_loader, val_loader : DataLoader
    num_epochs : int
    lr : float
    save_path : str   — path to save model.pt
    figures_dir : str — directory to save confusion_matrix.png
    class_weights : torch.Tensor or None
        Pre-computed class weights; if None, uniform weighting is used.
    device : torch.device or None
        Auto-detected if None.

    Returns
    -------
    dict  — training history with per-epoch metrics
    """
    if device is None:
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"[train] Device: {device}")

    os.makedirs(os.path.dirname(save_path), exist_ok=True)
    os.makedirs(figures_dir, exist_ok=True)

    model = HeartSoundCNN(num_classes=len(HeartSoundDataset.LABEL_MAP)).to(device)

    if class_weights is not None:
        class_weights = class_weights.to(device)
    criterion = nn.CrossEntropyLoss(weight=class_weights)

    optimizer = torch.optim.Adam(model.parameters(), lr=lr)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
        optimizer, mode="max", factor=0.5, patience=3
    )

    history = {
        "train_loss": [],
        "val_loss": [],
        "val_accuracy": [],
        "val_f1": [],
    }
    best_val_f1 = -1.0

    for epoch in range(1, num_epochs + 1):
        # ── Training phase ──────────────────────────────────────────────
        model.train()
        running_loss = 0.0
        for specs, labels in train_loader:
            specs, labels = specs.to(device), labels.to(device)
            optimizer.zero_grad()
            logits = model(specs)
            loss = criterion(logits, labels)
            loss.backward()
            optimizer.step()
            running_loss += loss.item() * specs.size(0)

        train_loss = running_loss / len(train_loader.dataset)

        # ── Validation phase ─────────────────────────────────────────────
        model.eval()
        val_loss_sum = 0.0
        all_preds, all_labels = [], []

        with torch.no_grad():
            for specs, labels in val_loader:
                specs, labels = specs.to(device), labels.to(device)
                logits = model(specs)
                loss = criterion(logits, labels)
                val_loss_sum += loss.item() * specs.size(0)
                preds = logits.argmax(dim=1)
                all_preds.extend(preds.cpu().numpy())
                all_labels.extend(labels.cpu().numpy())

        val_loss = val_loss_sum / len(val_loader.dataset)
        val_acc = accuracy_score(all_labels, all_preds)
        val_f1 = f1_score(all_labels, all_preds, average="macro", zero_division=0)

        scheduler.step(val_f1)

        history["train_loss"].append(train_loss)
        history["val_loss"].append(val_loss)
        history["val_accuracy"].append(val_acc)
        history["val_f1"].append(val_f1)

        print(
            f"Epoch {epoch:03d}/{num_epochs} | "
            f"train_loss={train_loss:.4f} | "
            f"val_loss={val_loss:.4f} | "
            f"val_acc={val_acc:.4f} | "
            f"val_F1={val_f1:.4f}"
        )

        # Save best checkpoint
        if val_f1 > best_val_f1:
            best_val_f1 = val_f1
            torch.save(
                {
                    "epoch": epoch,
                    "model_state_dict": model.state_dict(),
                    "optimizer_state_dict": optimizer.state_dict(),
                    "val_f1": val_f1,
                    "val_accuracy": val_acc,
                    "num_classes": len(HeartSoundDataset.LABEL_MAP),
                    "classes": list(HeartSoundDataset.LABEL_MAP.keys()),
                },
                save_path,
            )
            print(f"  [+] Saved best checkpoint (val_F1={val_f1:.4f}) -> {save_path}")

    # -- Final report on val set (using best model) -----------------------
    ckpt = torch.load(save_path, map_location=device)
    model.load_state_dict(ckpt["model_state_dict"])
    model.eval()

    all_preds, all_labels = [], []
    with torch.no_grad():
        for specs, labels in val_loader:
            specs = specs.to(device)
            logits = model(specs)
            preds = logits.argmax(dim=1)
            all_preds.extend(preds.cpu().numpy())
            all_labels.extend(labels.cpu().numpy())

    label_names = list(HeartSoundDataset.LABEL_MAP.keys())
    present_labels = sorted(set(all_labels))
    present_names = [label_names[i] for i in present_labels]

    print("\n-- Final Validation Report (best checkpoint) --")
    print(
        classification_report(
            all_labels,
            all_preds,
            labels=present_labels,
            target_names=present_names,
            zero_division=0,
        )
    )

    # Save confusion matrix PNG
    cm = confusion_matrix(all_labels, all_preds, labels=present_labels)
    fig, ax = plt.subplots(figsize=(6, 5))
    disp = ConfusionMatrixDisplay(confusion_matrix=cm, display_labels=present_names)
    disp.plot(ax=ax, colorbar=False, cmap="Blues")
    ax.set_title("EchoAssist - Confusion Matrix (val set)")
    plt.tight_layout()
    cm_path = os.path.join(figures_dir, "confusion_matrix.png")
    plt.savefig(cm_path, dpi=150)
    plt.close()
    print(f"Confusion matrix saved -> {cm_path}")

    # Persist metrics JSON for the /metrics API endpoint
    metrics_payload = {
        "val_accuracy": float(accuracy_score(all_labels, all_preds)),
        "val_f1_macro": float(
            f1_score(all_labels, all_preds, average="macro", zero_division=0)
        ),
        "best_epoch": int(ckpt["epoch"]),
        "history": history,
        "confusion_matrix_url": "/static/confusion_matrix.png",
    }
    metrics_path = os.path.join(figures_dir, "metrics.json")
    with open(metrics_path, "w") as f:
        json.dump(metrics_payload, f, indent=2)
    print(f"Metrics JSON saved -> {metrics_path}")

    return metrics_payload


# ---------------------------------------------------------------------------
# Convenience __main__ — run with: python -m src.modeling.train
# ---------------------------------------------------------------------------

def _compute_class_weights(metadata_csv: str, device: torch.device) -> torch.Tensor:
    """Compute balanced class weights from training split of metadata.csv."""
    df = pd.read_csv(metadata_csv)
    train_df = df[df["split"] == "train"]
    label_ints = train_df["label"].map(HeartSoundDataset.LABEL_MAP).values
    unique_present = np.unique(label_ints)

    weights_all = np.ones(len(HeartSoundDataset.LABEL_MAP), dtype=np.float32)
    if len(unique_present) > 0:
        computed = compute_class_weight("balanced", classes=unique_present, y=label_ints)
        for cls_idx, w in zip(unique_present, computed):
            weights_all[cls_idx] = w

    print(f"[train] Class weights: {dict(zip(HeartSoundDataset.LABEL_MAP.keys(), weights_all))}")
    return torch.tensor(weights_all, dtype=torch.float32)


if __name__ == "__main__":
    METADATA_CSV = "data/processed/metadata.csv"
    SAVE_PATH = "outputs/checkpoints/model.pt"
    FIGURES_DIR = "outputs/figures"
    BATCH_SIZE = 32
    NUM_EPOCHS = 30
    LR = 5e-4

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    train_ds = HeartSoundDataset(METADATA_CSV, split="train", augment=True)
    val_ds = HeartSoundDataset(METADATA_CSV, split="val")

    train_loader = DataLoader(
        train_ds, batch_size=BATCH_SIZE, shuffle=True, num_workers=0
    )
    val_loader = DataLoader(
        val_ds, batch_size=BATCH_SIZE, shuffle=False, num_workers=0
    )

    class_weights = _compute_class_weights(METADATA_CSV, device)

    train_model(
        train_loader=train_loader,
        val_loader=val_loader,
        num_epochs=NUM_EPOCHS,
        lr=LR,
        save_path=SAVE_PATH,
        figures_dir=FIGURES_DIR,
        class_weights=class_weights,
        device=device,
    )
