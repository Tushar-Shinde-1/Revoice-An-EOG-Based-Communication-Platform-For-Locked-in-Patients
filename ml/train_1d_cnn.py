"""
Revoice Assistive Communication Platform - Module 2: AI-Based EOG Command Recognition
Model: 1D Convolutional Neural Network (1D CNN) for Ocular Gesture Classification
Input: Dual-channel EOG Time-Series (CH0: Horizontal Saccades, CH1: Vertical Blinks)
Classes: [LOOK_LEFT, LOOK_RIGHT, DOUBLE_BLINK, TRIPLE_BLINK, REST]

Usage:
    python train_1d_cnn.py --dataset path/to/revoice_eog_dataset.json
    python train_1d_cnn.py --bootstrap  # Generates realistic synthetic samples if real data is still growing
"""

import os
import json
import argparse
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, confusion_matrix

CLASS_NAMES = ['LOOK_LEFT', 'LOOK_RIGHT', 'DOUBLE_BLINK', 'TRIPLE_BLINK', 'REST']
LABEL_MAP = {name: idx for idx, name in enumerate(CLASS_NAMES)}

# =====================================================================
# 1. 1D CNN MODEL ARCHITECTURE (MODULE 2 SPECIFICATION)
# =====================================================================
class EOG1DCNN(nn.Module):
    def __init__(self, in_channels=2, num_classes=5, window_size=200):
        super(EOG1DCNN, self).__init__()
        
        # Block 1: Temporal pattern detection (large receptive field)
        self.conv1 = nn.Sequential(
            nn.Conv1d(in_channels=in_channels, out_channels=16, kernel_size=15, stride=2, padding=7),
            nn.BatchNorm1d(16),
            nn.ReLU(),
            nn.MaxPool1d(kernel_size=2, stride=2)
        )
        
        # Block 2: Mid-level waveform feature extraction
        self.conv2 = nn.Sequential(
            nn.Conv1d(in_channels=16, out_channels=32, kernel_size=7, stride=1, padding=3),
            nn.BatchNorm1d(32),
            nn.ReLU(),
            nn.MaxPool1d(kernel_size=2, stride=2)
        )
        
        # Block 3: Deep ocular gesture pattern representation
        self.conv3 = nn.Sequential(
            nn.Conv1d(in_channels=32, out_channels=64, kernel_size=3, stride=1, padding=1),
            nn.BatchNorm1d(64),
            nn.ReLU(),
            nn.AdaptiveAvgPool1d(1)  # Global Average Pooling
        )
        
        # Classification Head (Softmax output via CrossEntropyLoss)
        self.classifier = nn.Sequential(
            nn.Flatten(),
            nn.Dropout(p=0.35),
            nn.Linear(64, 32),
            nn.ReLU(),
            nn.Dropout(p=0.2),
            nn.Linear(32, num_classes)
        )

    def forward(self, x):
        # Expected input shape: [batch_size, 2, window_size]
        x = self.conv1(x)
        x = self.conv2(x)
        x = self.conv3(x)
        logits = self.classifier(x)
        return logits


# =====================================================================
# 2. DATASET LOADER & PREPROCESSING
# =====================================================================
class EOGDataset(Dataset):
    def __init__(self, X, y, augment=False):
        self.X = torch.tensor(X, dtype=torch.float32)
        self.y = torch.tensor(y, dtype=torch.long)
        self.augment = augment

    def __len__(self):
        return len(self.y)

    def __getitem__(self, idx):
        x = self.X[idx].clone()
        y = self.y[idx]

        if self.augment:
            # Data Augmentation: Jitter + Scaling + Baseline Wander
            noise = torch.randn_like(x) * 0.04
            scale = np.random.uniform(0.9, 1.1)
            x = (x * scale) + noise

        return x, y


def normalize_signal(horizontal, vertical, target_len=200):
    """Interpolates and z-score normalizes dual-channel windows."""
    h = np.array(horizontal, dtype=np.float32)
    v = np.array(vertical, dtype=np.float32)

    # Resize/interpolate to uniform window length if needed
    if len(h) != target_len:
        h = np.interp(np.linspace(0, 1, target_len), np.linspace(0, 1, len(h)), h)
    if len(v) != target_len:
        v = np.interp(np.linspace(0, 1, target_len), np.linspace(0, 1, len(v)), v)

    # Robust scaling per window
    h_std = np.std(h) + 1e-6
    v_std = np.std(v) + 1e-6
    h = (h - np.mean(h)) / h_std
    v = (v - np.mean(v)) / v_std

    return np.stack([h, v], axis=0)  # Shape: (2, target_len)


# =====================================================================
# 3. SYNTHETIC REALISTIC BOOTSTRAP GENERATOR
# =====================================================================
def generate_synthetic_samples(samples_per_class=100, window_size=200):
    """Generates physiologically accurate synthetic EOG data for initial training."""
    print(f"Generating {samples_per_class * 5} synthetic physiological EOG windows...")
    X_list = []
    y_list = []

    for class_idx, label in enumerate(CLASS_NAMES):
        for _ in range(samples_per_class):
            h = np.random.normal(0, 3, window_size)
            v = np.random.normal(0, 3, window_size)

            if label == 'LOOK_LEFT':
                # Saccade left: negative step on CH0
                start = np.random.randint(30, 60)
                dur = np.random.randint(70, 110)
                t = np.linspace(0, np.pi, dur)
                amp = np.random.uniform(110, 160)
                h[start:start+dur] -= amp * np.sin(t)
                v += np.random.normal(0, 2, window_size)

            elif label == 'LOOK_RIGHT':
                # Saccade right: positive step on CH0
                start = np.random.randint(30, 60)
                dur = np.random.randint(70, 110)
                t = np.linspace(0, np.pi, dur)
                amp = np.random.uniform(110, 160)
                h[start:start+dur] += amp * np.sin(t)
                v += np.random.normal(0, 2, window_size)

            elif label == 'DOUBLE_BLINK':
                # Double sharp positive spikes on CH1
                b1 = np.random.randint(35, 60)
                b2 = b1 + np.random.randint(55, 80)
                for i in range(window_size):
                    s1 = np.exp(-((i - b1) / 7.0) ** 2)
                    s2 = np.exp(-((i - b2) / 7.0) ** 2)
                    v[i] += 180 * s1 + 175 * s2
                    h[i] += 15 * s1 + 15 * s2

            elif label == 'TRIPLE_BLINK':
                # Triple sharp positive spikes on CH1
                b1 = np.random.randint(25, 45)
                b2 = b1 + np.random.randint(45, 60)
                b3 = b2 + np.random.randint(45, 60)
                for i in range(window_size):
                    s1 = np.exp(-((i - b1) / 6.0) ** 2)
                    s2 = np.exp(-((i - b2) / 6.0) ** 2)
                    s3 = np.exp(-((i - b3) / 6.0) ** 2)
                    v[i] += 170 * s1 + 175 * s2 + 165 * s3
                    h[i] += 12 * s1 + 12 * s2 + 12 * s3

            elif label == 'REST':
                # Pure baseline drift
                drift = np.sin(np.linspace(0, np.pi * 2, window_size)) * 5
                h += drift
                v += drift

            sample_norm = normalize_signal(h, v, window_size)
            X_list.append(sample_norm)
            y_list.append(class_idx)

    return np.array(X_list), np.array(y_list)


# =====================================================================
# 4. TRAINING & EVALUATION LOOP
# =====================================================================
def train_model(X, y, epochs=35, batch_size=16, lr=0.001, output_dir="weights"):
    os.makedirs(output_dir, exist_ok=True)
    
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    train_dataset = EOGDataset(X_train, y_train, augment=True)
    test_dataset = EOGDataset(X_test, y_test, augment=False)

    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True)
    test_loader = DataLoader(test_dataset, batch_size=batch_size, shuffle=False)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")

    model = EOG1DCNN(in_channels=2, num_classes=5, window_size=200).to(device)
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=lr, weight_decay=1e-4)
    scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode='max', factor=0.5, patience=4)

    best_acc = 0.0
    best_weights_path = os.path.join(output_dir, "eog_1d_cnn_best.pt")

    print("\n--- Starting 1D CNN Training (Module 2) ---")
    for epoch in range(1, epochs + 1):
        model.train()
        total_loss = 0.0
        correct = 0
        total = 0

        for batch_x, batch_y in train_loader:
            batch_x, batch_y = batch_x.to(device), batch_y.to(device)
            optimizer.zero_grad()
            outputs = model(batch_x)
            loss = criterion(outputs, batch_y)
            loss.backward()
            optimizer.step()

            total_loss += loss.item() * batch_x.size(0)
            preds = torch.argmax(outputs, dim=1)
            correct += (preds == batch_y).sum().item()
            total += batch_y.size(0)

        train_loss = total_loss / total
        train_acc = correct / total

        # Validation
        model.eval()
        val_correct = 0
        val_total = 0
        with torch.no_grad():
            for batch_x, batch_y in test_loader:
                batch_x, batch_y = batch_x.to(device), batch_y.to(device)
                outputs = model(batch_x)
                preds = torch.argmax(outputs, dim=1)
                val_correct += (preds == batch_y).sum().item()
                val_total += batch_y.size(0)

        val_acc = val_correct / val_total
        scheduler.step(val_acc)

        if val_acc > best_acc:
            best_acc = val_acc
            torch.save(model.state_dict(), best_weights_path)

        if epoch % 5 == 0 or epoch == epochs:
            print(f"Epoch [{epoch:02d}/{epochs:02d}] - Train Loss: {train_loss:.4f} | Train Acc: {train_acc*100:.1f}% | Val Acc: {val_acc*100:.1f}% {'(Saved Best)' if val_acc == best_acc else ''}")

    print(f"\nBest Validation Accuracy: {best_acc*100:.2f}%")
    print(f"Model saved to: {best_weights_path}")

    # Final Classification Report & Confusion Matrix
    model.load_state_dict(torch.load(best_weights_path))
    model.eval()
    all_preds = []
    all_targets = []
    with torch.no_grad():
        for batch_x, batch_y in test_loader:
            batch_x = batch_x.to(device)
            outputs = model(batch_x)
            preds = torch.argmax(outputs, dim=1).cpu().numpy()
            all_preds.extend(preds)
            all_targets.extend(batch_y.numpy())

    print("\n--- Classification Report ---")
    print(classification_report(all_targets, all_preds, target_names=CLASS_NAMES, digits=4))

    print("--- Confusion Matrix ---")
    cm = confusion_matrix(all_targets, all_preds)
    print(cm)

    # Export to ONNX for Web / Edge Deployment
    onnx_path = os.path.join(output_dir, "eog_1d_cnn.onnx")
    dummy_input = torch.randn(1, 2, 200, device=device)
    torch.onnx.export(
        model,
        dummy_input,
        onnx_path,
        export_params=True,
        opset_version=14,
        input_names=['eog_signal'],
        output_names=['command_probabilities'],
        dynamic_axes={'eog_signal': {0: 'batch_size'}, 'command_probabilities': {0: 'batch_size'}}
    )
    print(f"Exported ONNX Model to: {onnx_path}")


# =====================================================================
# 5. MAIN ENTRYPOINT
# =====================================================================
def main():
    parser = argparse.ArgumentParser(description="Train 1D CNN for EOG Command Recognition (Module 2)")
    parser.add_argument("--dataset", type=str, default=None, help="Path to exported revoice_eog_dataset.json")
    parser.add_argument("--bootstrap", action="store_true", help="Bootstrap with synthetic physiological data")
    parser.add_argument("--epochs", type=int, default=30, help="Number of training epochs")
    parser.add_argument("--output_dir", type=str, default="weights", help="Directory to save model weights")
    args = parser.parse_args()

    X, y = None, None

    if args.dataset and os.path.exists(args.dataset):
        print(f"Loading recorded dataset from: {args.dataset}")
        with open(args.dataset, "r") as f:
            data = json.load(f)

        samples = data.get("samples", [])
        if len(samples) < 15:
            print(f"Warning: Only {len(samples)} samples found in file. Supplementing with synthetic data.")
            args.bootstrap = True
        else:
            X_list, y_list = [], []
            for s in samples:
                label = s.get("label")
                if label in LABEL_MAP:
                    h = s.get("horizontal") or s.get("signal", {}).get("horizontal", [])
                    v = s.get("vertical") or s.get("signal", {}).get("vertical", [])
                    if len(h) > 0 and len(v) > 0:
                        norm = normalize_signal(h, v, target_len=200)
                        X_list.append(norm)
                        y_list.append(LABEL_MAP[label])
            X, y = np.array(X_list), np.array(y_list)
            print(f"Loaded {len(X)} recorded samples.")

    if args.bootstrap or X is None:
        X_synth, y_synth = generate_synthetic_samples(samples_per_class=120, window_size=200)
        if X is not None and len(X) > 0:
            X = np.concatenate([X, X_synth], axis=0)
            y = np.concatenate([y, y_synth], axis=0)
        else:
            X, y = X_synth, y_synth

    train_model(X, y, epochs=args.epochs, output_dir=args.output_dir)


if __name__ == "__main__":
    main()
