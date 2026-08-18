"""
src/evaluation/metrics.py
Evaluation Metrics & Confusion Matrix Generator for EchoAssist.

Computes classification metrics across all heart-sound classes:
  - Accuracy, Macro F1, Weighted F1
  - Per-class Precision, Recall, F1, Support
  - Confusion Matrix dictionary & plot helper
"""

import os
import json
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from sklearn.metrics import (
    accuracy_score,
    f1_score,
    precision_recall_fscore_support,
    confusion_matrix,
    ConfusionMatrixDisplay,
)


CANONICAL_CLASSES = ["normal", "murmur", "extrasystole", "artifact"]


def compute_metrics(
    y_true: list,
    y_pred: list,
    classes: list = None,
) -> dict:
    """
    Compute comprehensive evaluation metrics.

    Parameters
    ----------
    y_true : list
        Ground-truth class labels (strings or ints).
    y_pred : list
        Predicted class labels (strings or ints).
    classes : list or None
        List of class names/indices. Defaults to CANONICAL_CLASSES.

    Returns
    -------
    dict
        Evaluation metrics payload compatible with the /metrics endpoint.
    """
    if classes is None:
        classes = CANONICAL_CLASSES

    acc = float(accuracy_score(y_true, y_pred))
    f1_macro = float(f1_score(y_true, y_pred, average="macro", zero_division=0))
    f1_weighted = float(f1_score(y_true, y_pred, average="weighted", zero_division=0))

    prec, rec, f1_cls, supp = precision_recall_fscore_support(
        y_true, y_pred, labels=classes, zero_division=0
    )

    per_class = {}
    for idx, cls_name in enumerate(classes):
        per_class[str(cls_name)] = {
            "precision": round(float(prec[idx]), 4),
            "recall": round(float(rec[idx]), 4),
            "f1": round(float(f1_cls[idx]), 4),
            "support": int(supp[idx]),
        }

    cm = confusion_matrix(y_true, y_pred, labels=classes)

    return {
        "val_accuracy": round(acc, 4),
        "val_f1_macro": round(f1_macro, 4),
        "val_f1_weighted": round(f1_weighted, 4),
        "per_class": per_class,
        "confusion_matrix": cm.tolist(),
        "confusion_matrix_url": "/static/confusion_matrix.png",
    }


def save_metrics_report(
    metrics_dict: dict,
    output_json_path: str = "outputs/figures/metrics.json",
    confusion_matrix_path: str = "outputs/figures/confusion_matrix.png",
    classes: list = None,
):
    """
    Save metrics dictionary to JSON and generate the confusion matrix plot.
    """
    if classes is None:
        classes = CANONICAL_CLASSES

    os.makedirs(os.path.dirname(output_json_path), exist_ok=True)
    os.makedirs(os.path.dirname(confusion_matrix_path), exist_ok=True)

    with open(output_json_path, "w") as f:
        json.dump(metrics_dict, f, indent=2)

    if "confusion_matrix" in metrics_dict:
        cm_array = np.array(metrics_dict["confusion_matrix"])
        fig, ax = plt.subplots(figsize=(6, 5))
        disp = ConfusionMatrixDisplay(confusion_matrix=cm_array, display_labels=classes)
        disp.plot(ax=ax, colorbar=False, cmap="Blues")
        ax.set_title("EchoAssist — Confusion Matrix")
        plt.tight_layout()
        plt.savefig(confusion_matrix_path, dpi=150)
        plt.close()
