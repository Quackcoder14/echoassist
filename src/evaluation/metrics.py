import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.metrics import classification_report, confusion_matrix
import os

def compute_metrics(y_true: list, y_pred: list, label_names: list[str]) -> dict:
    """
    y_true, y_pred: lists/arrays of integer class labels
    label_names: list of string names in index order, e.g. ["normal", "murmur", "extrasystole", "artifact"]
    Returns a dict with accuracy, per_class metrics, macro_f1, and a confusion_matrix list of lists.
    """
    # handle cases where not all classes are present in y_true and y_pred
    # by ensuring we pass labels based on indices of label_names
    labels = list(range(len(label_names)))
    report = classification_report(y_true, y_pred, labels=labels, target_names=label_names, output_dict=True, zero_division=0)
    cm = confusion_matrix(y_true, y_pred, labels=labels)
    
    per_class = {}
    for name in label_names:
        if name in report:
            per_class[name] = {
                "precision": report[name]["precision"],
                "recall": report[name]["recall"],
                "f1": report[name]["f1-score"],
                "support": report[name]["support"]
            }
        else:
            per_class[name] = {"precision": 0.0, "recall": 0.0, "f1": 0.0, "support": 0}

    return {
        "accuracy": report.get("accuracy", 0.0),
        "per_class": per_class,
        "macro_f1": report.get("macro avg", {}).get("f1-score", 0.0),
        "confusion_matrix": cm.tolist()
    }

def save_confusion_matrix_plot(y_true, y_pred, label_names: list[str], output_path: str = "outputs/figures/confusion_matrix.png") -> str:
    """
    Generates and saves a confusion matrix heatmap image using matplotlib/seaborn.
    Returns: output_path
    """
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    labels = list(range(len(label_names)))
    cm = confusion_matrix(y_true, y_pred, labels=labels)
    
    plt.figure(figsize=(8, 6))
    sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', xticklabels=label_names, yticklabels=label_names)
    plt.title('Confusion Matrix')
    plt.xlabel('Predicted Label')
    plt.ylabel('True Label')
    
    plt.tight_layout()
    plt.savefig(output_path, dpi=300)
    plt.close()
    
    return output_path
