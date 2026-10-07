# Module 2: AI-Based EOG Command Recognition (1D CNN)

This module implements the deep learning recognition model described in the project architecture diagram (`Revoice1.html`).

## Pipeline Architecture
1. **Input Signal Preparation**: Dual-channel EOG windows (CH0: Horizontal Saccades, CH1: Vertical Blinks) normalized and centered.
2. **Automatic Feature Extraction (1D Convolution)**:
   - Conv1D Block 1 (Filters=16, Kernel=15, Stride=2) + BatchNorm + ReLU + MaxPool
   - Conv1D Block 2 (Filters=32, Kernel=7, Stride=1) + BatchNorm + ReLU + MaxPool
   - Conv1D Block 3 (Filters=64, Kernel=3, Stride=1) + BatchNorm + ReLU + GlobalAveragePooling
3. **Deep Feature Learning & Dropout**: Fully connected layers with dropout (0.35) for regularized classification.
4. **Softmax Output**: 5-class command prediction:
   - `0: LOOK_LEFT`
   - `1: LOOK_RIGHT`
   - `2: DOUBLE_BLINK`
   - `3: TRIPLE_BLINK`
   - `4: REST`

---

## How to Collect Real Data & Train

### Step 1: Collect Data in Revoice Web App
1. Open the Revoice Dashboard.
2. Click **Settings** (⚙️) $\rightarrow$ Navigate to **🧠 AI Dataset (Module 2)**.
3. Perform eye movements (or use keyboard `←`, `→`, `2`, `3`).
4. The live waveform is displayed: press **[Enter]** to save the window to MongoDB / Local storage.
5. Once you have collected samples, click **Export Dataset (.JSON)**.

### Step 2: Install Python ML Dependencies
```bash
pip install -r ml/requirements.txt
```

### Step 3: Run 1D CNN Training
To train directly on your exported dataset:
```bash
python ml/train_1d_cnn.py --dataset path/to/revoice_eog_dataset.json --epochs 35
```

To test and verify the model immediately using the physiological synthetic bootstrap generator:
```bash
python ml/train_1d_cnn.py --bootstrap --epochs 30
```

### Step 4: Output Artifacts
The training script outputs:
- `weights/eog_1d_cnn_best.pt`: PyTorch weights file.
- `weights/eog_1d_cnn.onnx`: Exported ONNX model ready for real-time web deployment (via ONNX Runtime Web).
- Terminal logs containing the **Confusion Matrix** and **Classification Report** (Precision, Recall, F1-Score).
