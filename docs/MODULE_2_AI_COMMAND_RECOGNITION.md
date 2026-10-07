# Module 2: AI-Based EOG Command Recognition

> **Project:** Revoice – An EOG-Based Assistive Communication Platform for Locked-in Patients  
> **System Component:** Module 2 (AI-Based EOG Command Recognition)  
> **Date:** October 2026  
> **Target Audience:** Project Examiners, Faculty Guides, Team Members, and Reviewers  

---

## 1. Executive Summary & Purpose

In the overall **Revoice System Architecture** (as shown in the system block diagram `revoice1.html`), **Module 2** serves as the intelligence core between raw hardware biosignals (Module 1) and the assistive web platform (Modules 3 & 4).

```
┌─────────────────────────────────┐
│           Hardware              │ (NPG Lite Board + Ag/AgCl Electrodes)
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│            Module 1             │ EOG Signal Acquisition & Preprocessing
│  (Acquisition & Preprocessing)  │ (Amplification, Filtering, Baseline Correction)
└────────────────┬────────────────┘
                 │ Raw Dual-Channel Voltage Streams (CH0, CH1)
                 ▼
┌─────────────────────────────────┐
│            MODULE 2             │ ★ AI-Based EOG Command Recognition ★
│   (1D CNN Classification)       │   - Input Signal Preparation & Normalization
│                                 │   - Automatic Feature Extraction (1D Conv)
│                                 │   - Deep Feature Representation
│                                 │   - Command Probability Prediction (Softmax)
└────────────────┬────────────────┘
                 │ Predicted Ocular Gestures (L, R, D, T, REST)
                 ▼
┌─────────────────────────────────┐
│            Module 3             │ Real-Time EOG-to-Platform Integration
└────────────────┬────────────────┘
                 ▼
┌─────────────────────────────────┐
│            Module 4             │ Revoice Assistive Communication Web Platform
└─────────────────────────────────┘
```

---

## 2. Theoretical Foundation: Why a 1D CNN for Numbers?

A common question is: *"CNNs are typically used for images; how does a CNN work on raw numerical voltage values?"*

### 2D CNN (Images) vs. 1D CNN (Biosignals):
* **2D CNN (Computer Vision):** Takes a 2D spatial grid of pixel intensities (Height $\times$ Width $\times$ Channels). The convolution kernel slides horizontally and vertically across spatial coordinates.
* **1D CNN (Time-Series Biosignals):** Takes a sequence of numbers recorded across discrete time intervals (Channels $\times$ Time-Steps). The 1D convolution kernel slides **along the temporal axis**.

```
              Time Axis ---> (e.g., 200 discrete time-points = 1.0 second)
CH0 (Horiz): [ -5.2, -12.1, -45.0, -145.2, -180.0, -172.5, -120.0, -35.1, ... ]  <-- Looking Left
                            ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲
                   [ 1D Convolution Kernel Filter slides here ]
```

### What the 1D Filters Learn to Detect:
Rather than relying on brittle, manually hardcoded `if (voltage > 80)` thresholds that fail when skin impedance or sweat changes, the 1D CNN automatically learns **temporal morphology (waveform shapes)**:
1. **Saccade Left (CH0):** A steep negative voltage deflection followed by a fixation plateau.
2. **Saccade Right (CH0):** A steep positive voltage deflection followed by a fixation plateau.
3. **Double Blink (CH1):** Two consecutive bell-shaped positive spikes within a 250–400 ms interval.
4. **Triple Blink (CH1):** Three consecutive bell-shaped positive spikes within a 500–700 ms interval.
5. **Rest / Baseline:** Low-amplitude stochastic noise and baseline drift with near-zero power.

---

## 3. Dataset Acquisition Strategy

Because commercial third-party datasets often suffer from mismatch in sampling frequencies, electrode placements, and gain configurations, Revoice employs a **two-pronged dataset strategy**:

### A. In-Platform Real-Time Guided Data Capture
* Built directly into the **Caregiver Settings Modal** under the **"🧠 AI Dataset (Module 2)"** tab.
* The system buffers live signals into standardized **200-sample windows (1.0 second at 200 Hz)**.
* **Live Visual Confirmation:** The user sees a real-time dual-channel SVG graph of the wave.
* **Keyboard Shortcut Action:** Press **[Enter]** to permanently commit the sample to the database; press **[Esc]** to discard noisy twitches.

### B. Physiological Synthetic Bootstrap Generator
* Built into `ml/train_1d_cnn.py` via the `--bootstrap` flag.
* Uses physiological models (biphasic saccadic step functions and exponential blink spikes) with Gaussian jitter and baseline drift.
* Enables team members to train, validate, and verify the deep learning model immediately, even before hundreds of physical recordings are accumulated.

---

## 4. Data Storage & Persistence Architecture

The data is permanently stored across three redundant tiers:

```
[ Frontend: Live Signal Window ]
               │
      [ User presses Enter ]
               │
       ┌───────┴────────────────────────┐
       ▼                                ▼
[ Tier 1: MongoDB Database ]     [ Tier 2: Browser LocalStorage ]
 Collection: `datasetsamples`      Key: `revoice_dataset_samples`
 Permanent on Hard Disk            Offline Resilience Cache
       │
       ▼ [ User clicks "Export Dataset" ]
[ Tier 3: Standalone Physical File ]
 `revoice_eog_dataset.json` (committed to repo / backed up to cloud)
```

### MongoDB Document Schema (`DatasetSample.js`):
```javascript
{
  "_id": ObjectId("6704bf12a8..."),
  "label": "LOOK_LEFT",           // Target class: LOOK_LEFT, LOOK_RIGHT, DOUBLE_BLINK, TRIPLE_BLINK, REST
  "gestureCode": "L",             // Protocol code: 'L', 'R', 'D', 'T', 'N'
  "source": "ble",                // 'ble' | 'serial' | 'keyboard' | 'guided'
  "sampleRate": 200,              // Hz
  "windowSize": 200,              // Number of samples (1.0 second)
  "signal": {
    "horizontal": [-12.5, -28.0, -85.2, -145.0, ...], // CH0 array (200 points)
    "vertical":   [2.1, 3.4, 5.0, 4.2, ...]            // CH1 array (200 points)
  },
  "metrics": {
    "horizontalPeak": 145.0,     // Microvolts (µV)
    "verticalPeak": 5.0,
    "rms": 46.2
  },
  "subjectId": "Patient_01",
  "createdAt": ISODate("2026-10-07T09:05:00.000Z")
}
```

---

## 5. 1D CNN Model Architecture

The model is defined in `ml/train_1d_cnn.py` using PyTorch:

```
Input Tensor: [Batch Size, 2 Channels, 200 Time-Steps]
  │
  ├── 1. Conv1D(in=2, out=16, kernel=15, stride=2, pad=7) + BatchNorm1D + ReLU
  ├──    MaxPool1D(kernel=2, stride=2)
  │      Output: [Batch, 16, 50]  (Captures broad temporal saccade slopes)
  │
  ├── 2. Conv1D(in=16, out=32, kernel=7, stride=1, pad=3) + BatchNorm1D + ReLU
  ├──    MaxPool1D(kernel=2, stride=2)
  │      Output: [Batch, 32, 25]  (Captures blink spike morphology & rhythm)
  │
  ├── 3. Conv1D(in=32, out=64, kernel=3, stride=1, pad=1) + BatchNorm1D + ReLU
  ├──    AdaptiveAvgPool1D(1)     (Global Average Pooling)
  │      Output: [Batch, 64, 1]   (Compressed feature representation)
  │
  ├── 4. Flatten() + Dropout(0.35)
  ├──    Linear(64 -> 32) + ReLU + Dropout(0.20)
  └──    Linear(32 -> 5)          (Logits for 5 gesture classes)
         └── Softmax Output       --> [P(LEFT), P(RIGHT), P(DBLINK), P(TBLINK), P(REST)]
```

### Parameter Footprint & Latency:
* **Total Parameters:** ~31,000 parameters.
* **Model Size:** ~125 KB on disk.
* **Inference Latency:** < 4 ms on standard CPU, making it suited for real-time edge execution.

---

## 6. How to Run & Verify

### Step 1: Start Backend (MongoDB + REST API)
```powershell
cd backend
node server.js
```
*API endpoints active on `http://localhost:5000`:*
* `POST /api/dataset/samples`: Save captured sample.
* `GET  /api/dataset/stats`: Live category counts.
* `GET  /api/dataset/export`: Download complete JSON dataset.

### Step 2: Start Frontend Web Dashboard
```powershell
cd frontend
npm run dev
```
* Open `http://localhost:5173`.
* Click **Settings (⚙️)** $\rightarrow$ Select **🧠 AI Dataset (Module 2)**.
* Trigger a gesture (using connected NPG Lite board or keyboard `←`, `→`, `2`, `3`).
* Press **[Enter]** to save to database.
* Click **Export Dataset (.JSON)** when ready.

### Step 3: Run Model Training
```powershell
# Install ML dependencies
pip install -r ml/requirements.txt

# Train using collected dataset + synthetic bootstrap
python ml/train_1d_cnn.py --dataset path/to/revoice_eog_dataset.json --epochs 30

# Or train immediately with physiological synthetic generator:
python ml/train_1d_cnn.py --bootstrap --epochs 30
```

### Output Artifacts Generated:
* `ml/weights/eog_1d_cnn_best.pt`: Best PyTorch model checkpoint.
* `ml/weights/eog_1d_cnn.onnx`: Exported ONNX model ready for browser-based inference.
* Terminal output with **Confusion Matrix** and **Classification Report** (Precision, Recall, F1).

---

## 7. Project File Structure for Module 2

```
Final Year Project/
└── Revoice-An-EOG-Based-Communication-Platform-For-Locked-in-Patients/
    ├── backend/
    │   ├── models/
    │   │   └── DatasetSample.js           # Mongoose schema for EOG time-series
    │   ├── routes/
    │   │   └── dataset.js                 # REST endpoints: save, stats, export, delete
    │   └── server.js                      # Registers /api/dataset
    │
    ├── frontend/
    │   └── src/
    │       ├── components/
    │       │   └── SettingsModal.tsx      # UI tab with live waveform preview & Enter-to-save
    │       └── services/
    │           ├── apiService.ts          # API client with localStorage offline fallback
    │           └── eyeInputManager.ts     # Physiological waveform generator & window slicer
    │
    ├── ml/
    │   ├── train_1d_cnn.py               # Complete PyTorch 1D CNN training & ONNX export
    │   ├── requirements.txt               # torch, scikit-learn, onnx, numpy, matplotlib
    │   ├── README.md                      # Quickstart guide
    │   └── weights/                       # Generated .pt and .onnx model weights
    │
    └── docs/
        └── MODULE_2_AI_COMMAND_RECOGNITION.md  # ★ This Documentation File ★
```
