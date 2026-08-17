import os
import json
import torch
from torch.utils.data import DataLoader
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score, f1_score

from src.modeling.dataset import HeartSoundDataset
from src.modeling.model import HeartSoundCNN

def evaluate_model():
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    
    METADATA_CSV = "data/processed/metadata.csv"
    SAVE_PATH = "outputs/checkpoints/model.pt"
    
    val_ds = HeartSoundDataset(METADATA_CSV, split="val")
    val_loader = DataLoader(val_ds, batch_size=32, shuffle=False, num_workers=0)
    
    ckpt = torch.load(SAVE_PATH, map_location=device)
    num_classes = ckpt.get("num_classes", len(HeartSoundDataset.LABEL_MAP))
    model = HeartSoundCNN(num_classes=num_classes).to(device)
    model.load_state_dict(ckpt["model_state_dict"])
    model.eval()

    all_preds = []
    all_labels = []

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

    report = classification_report(
        all_labels,
        all_preds,
        labels=present_labels,
        target_names=present_names,
        output_dict=True,
        zero_division=0
    )
    
    cm = confusion_matrix(all_labels, all_preds, labels=present_labels)
    acc = accuracy_score(all_labels, all_preds)
    f1 = f1_score(all_labels, all_preds, average="macro", zero_division=0)
    
    out_dict = {
        "accuracy": acc,
        "macro_f1": f1,
        "report": report,
        "confusion_matrix": cm.tolist(),
        "classes": present_names
    }
    
    with open("scratch_metrics.json", "w") as f:
        json.dump(out_dict, f, indent=2)

if __name__ == "__main__":
    evaluate_model()
