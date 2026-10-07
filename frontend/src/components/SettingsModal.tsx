import React, { useState, useEffect } from 'react';
import { 
  Sliders, 
  Bluetooth, 
  Usb, 
  Volume2, 
  Save, 
  X, 
  RefreshCw, 
  Sparkles,
  Database,
  Brain,
  Download,
  Trash2,
  CheckCircle2,
  Activity,
  Check,
  Layers,
  Play
} from 'lucide-react';
import { eyeInputManager, EyeGesture } from '../services/eyeInputManager';
import { speechService } from '../services/speechService';
import { apiService } from '../services/apiService';
import type { CaregiverSettingsData, DatasetStats, DatasetSampleRecord } from '../services/apiService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'calibration' | 'speech' | 'hardware' | 'caregiver' | 'dataset'>('calibration');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [isCalibrating, setIsCalibrating] = useState<boolean>(false);
  const [calibCountdown, setCalibCountdown] = useState<number>(2);

  // ML Dataset Collection state (Module 2)
  const [datasetStats, setDatasetStats] = useState<DatasetStats>({
    LOOK_LEFT: 0,
    LOOK_RIGHT: 0,
    DOUBLE_BLINK: 0,
    TRIPLE_BLINK: 0,
    REST: 0,
    total: 0
  });
  const [recentSamples, setRecentSamples] = useState<DatasetSampleRecord[]>([]);
  const [isCapturingActive, setIsCapturingActive] = useState<boolean>(true);
  const [stagedSample, setStagedSample] = useState<DatasetSampleRecord | null>(null);
  const [isSavingSample, setIsSavingSample] = useState<boolean>(false);
  const [guidedStep, setGuidedStep] = useState<number | null>(null);

  // Settings state
  const [settings, setSettings] = useState<CaregiverSettingsData>({
    calibration: {
      horizontalThreshold: 80,
      blinkThreshold: 100,
      eyeDebounceMs: 450,
      blinkDebounceMs: 220,
      doubleBlinkWindowMs: 750,
      tripleBlinkWindowMs: 650
    },
    speech: {
      voiceIndex: 0,
      rate: 0.95,
      pitch: 1.0,
      volume: 1.0,
      audioTonesEnabled: true
    },
    caregiver: {
      name: 'Primary Caregiver / Nurse',
      contactNumber: '+91 98765 43210',
      roomNumber: 'ICU Bed 04',
      audioAlertVolume: 90
    },
    theme: {
      mode: 'dark'
    }
  });

  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const deviceStatus = eyeInputManager.getStatus();

  useEffect(() => {
    if (isOpen) {
      loadSettings();
      setVoices(speechService.getAvailableVoices());
    }
  }, [isOpen]);

  const loadSettings = async () => {
    const data = await apiService.getSettings();
    if (data) {
      setSettings(data);
    }
  };

  const loadDatasetInfo = async () => {
    try {
      const stats = await apiService.getDatasetStats();
      setDatasetStats(stats);
      const samples = await apiService.getDatasetSamples();
      setRecentSamples(samples);
    } catch (e) {
      console.warn('Dataset load error:', e);
    }
  };

  useEffect(() => {
    if (isOpen && activeTab === 'dataset') {
      loadDatasetInfo();
    }
  }, [isOpen, activeTab]);

  // Subscribe to eye movements when Dataset tab is open & capturing is active
  useEffect(() => {
    if (!isOpen || activeTab !== 'dataset' || !isCapturingActive) return;

    const unsubscribe = eyeInputManager.subscribe((event) => {
      // Calibrated waveform window for detected gesture
      const windowData = eyeInputManager.generateWaveformWindow(event.gesture, 200);
      const code = event.gesture === 'LOOK_LEFT' ? 'L' : event.gesture === 'LOOK_RIGHT' ? 'R' : event.gesture === 'DOUBLE_BLINK' ? 'D' : 'T';
      const newSample: DatasetSampleRecord = {
        label: event.gesture,
        gestureCode: code,
        source: event.source,
        sampleRate: 200,
        windowSize: 200,
        signal: {
          horizontal: windowData.horizontal,
          vertical: windowData.vertical
        },
        metrics: windowData.metrics,
        subjectId: 'Patient_01',
        createdAt: new Date().toISOString()
      };
      setStagedSample(newSample);
    });

    return () => unsubscribe();
  }, [isOpen, activeTab, isCapturingActive]);

  // Keydown listener for Enter (save) and Escape (discard)
  useEffect(() => {
    if (!isOpen || activeTab !== 'dataset') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && stagedSample) {
        e.preventDefault();
        saveStagedSample();
      } else if (e.key === 'Escape' && stagedSample) {
        e.preventDefault();
        setStagedSample(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, activeTab, stagedSample]);

  const saveStagedSample = async () => {
    if (!stagedSample) return;
    setIsSavingSample(true);
    await apiService.saveDatasetSample(stagedSample);
    const savedLabel = stagedSample.label;
    setStagedSample(null);
    setIsSavingSample(false);
    setStatusMsg(`Sample "${savedLabel}" saved to dataset!`);
    setTimeout(() => setStatusMsg(null), 2500);
    await loadDatasetInfo();
  };

  const handleManualCapture = (gesture: EyeGesture | 'REST') => {
    const windowData = eyeInputManager.generateWaveformWindow(gesture, 200);
    const code = gesture === 'LOOK_LEFT' ? 'L' : gesture === 'LOOK_RIGHT' ? 'R' : gesture === 'DOUBLE_BLINK' ? 'D' : gesture === 'TRIPLE_BLINK' ? 'T' : 'N';
    const sample: DatasetSampleRecord = {
      label: gesture,
      gestureCode: code,
      source: 'guided',
      sampleRate: 200,
      windowSize: 200,
      signal: {
        horizontal: windowData.horizontal,
        vertical: windowData.vertical
      },
      metrics: windowData.metrics,
      subjectId: 'Patient_01',
      createdAt: new Date().toISOString()
    };
    setStagedSample(sample);
  };

  const handleDeleteSample = async (id?: string) => {
    if (!id) return;
    await apiService.deleteDatasetSample(id);
    await loadDatasetInfo();
  };

  const handleClearDataset = async () => {
    if (window.confirm('Are you sure you want to clear all collected samples?')) {
      await apiService.clearDataset();
      await loadDatasetInfo();
      setStatusMsg('Dataset reset successfully.');
      setTimeout(() => setStatusMsg(null), 2500);
    }
  };

  const handleExportDataset = async () => {
    const samples = await apiService.getDatasetSamples();
    const exportData = {
      datasetName: 'Revoice EOG 1D-CNN Training Dataset',
      exportedAt: new Date().toISOString(),
      numSamples: samples.length,
      classes: ['LOOK_LEFT', 'LOOK_RIGHT', 'DOUBLE_BLINK', 'TRIPLE_BLINK', 'REST'],
      samples
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `revoice_eog_dataset_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatusMsg('Dataset exported successfully!');
    setTimeout(() => setStatusMsg(null), 2500);
  };

  const saveSettings = async () => {
    const updated = await apiService.updateSettings(settings);
    if (updated) {
      // Apply to active services
      eyeInputManager.updateCalibration({
        horizontalThreshold: settings.calibration.horizontalThreshold,
        blinkThreshold: settings.calibration.blinkThreshold,
        debounceMs: settings.calibration.eyeDebounceMs
      });

      speechService.setConfig({
        rate: settings.speech.rate,
        pitch: settings.speech.pitch,
        volume: settings.speech.volume,
        tonesEnabled: settings.speech.audioTonesEnabled,
        voiceIndex: settings.speech.voiceIndex
      });

      setStatusMsg('Settings successfully saved to database!');
      setTimeout(() => setStatusMsg(null), 3000);
    }
  };

  const startRelaxationCalibration = () => {
    setIsCalibrating(true);
    setCalibCountdown(2);
    speechService.speak('Keep your eyes completely relaxed for 2 seconds.');

    const timer = setInterval(() => {
      setCalibCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setIsCalibrating(false);
          speechService.speak('Baseline calibration completed.');
          setStatusMsg('Eye baseline calibration completed!');
          setTimeout(() => setStatusMsg(null), 3000);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleConnectBLE = async () => {
    try {
      setStatusMsg('Scanning for NPG Lite Bluetooth device...');
      const success = await eyeInputManager.connectBLE();
      if (success) {
        setStatusMsg('Connected to NPG Lite via Bluetooth Low Energy!');
        setTimeout(() => setStatusMsg(null), 3000);
      }
    } catch (err: any) {
      setStatusMsg(`BLE Connection error: ${err.message}`);
    }
  };

  const handleConnectSerial = async () => {
    try {
      setStatusMsg('Opening USB Serial Port...');
      const success = await eyeInputManager.connectSerial();
      if (success) {
        setStatusMsg('Connected to NPG Lite via USB Serial!');
        setTimeout(() => setStatusMsg(null), 3000);
      }
    } catch (err: any) {
      setStatusMsg(`Serial Connection error: ${err.message}`);
    }
  };

  const handleDisconnect = async () => {
    await eyeInputManager.disconnect();
    setStatusMsg('Hardware disconnected. Returned to simulator mode.');
    setTimeout(() => setStatusMsg(null), 3000);
  };

  const testVoice = () => {
    speechService.setConfig({
      rate: settings.speech.rate,
      pitch: settings.speech.pitch,
      volume: settings.speech.volume,
      voiceIndex: settings.speech.voiceIndex
    });
    speechService.speak('Hello, this is your assistive voice. I will speak for you.');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="w-full max-w-3xl max-h-[90vh] rounded-3xl bg-slate-900 border-2 border-slate-700 shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center border border-purple-500/30">
              <Sliders size={22} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Caregiver Calibration & Settings</h3>
              <p className="text-xs text-slate-400">Tuning EOG thresholds, speech voice & hardware links</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs Bar */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-slate-800/80 bg-slate-950/40 overflow-x-auto">
          {[
            { id: 'calibration', label: 'EOG Calibration' },
            { id: 'dataset', label: '🧠 AI Dataset (Module 2)' },
            { id: 'speech', label: 'Voice & Speech' },
            { id: 'hardware', label: 'Hardware Connection' },
            { id: 'caregiver', label: 'Caregiver Info' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`
                px-4 py-2 text-sm font-semibold rounded-t-xl transition-all border-b-2 cursor-pointer whitespace-nowrap
                ${activeTab === tab.id ? 'border-cyan-400 text-cyan-300 bg-slate-900' : 'border-transparent text-slate-400 hover:text-white'}
              `}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Toast Status */}
        {statusMsg && (
          <div className="mx-6 mt-4 py-2 px-4 rounded-xl bg-cyan-500/20 border border-cyan-400 text-cyan-300 text-sm font-semibold flex items-center gap-2">
            <Sparkles size={16} /> {statusMsg}
          </div>
        )}

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          
          {/* TAB 1: CALIBRATION */}
          {activeTab === 'calibration' && (
            <div className="space-y-6">
              <div className="p-4 rounded-2xl bg-cyan-950/30 border border-cyan-500/30 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <h4 className="font-bold text-white text-base">Resting Baseline Calibration</h4>
                  <p className="text-xs text-slate-400">
                    Instruct patient to relax ocular muscles and look straight forward for 2 seconds.
                  </p>
                </div>
                <button
                  disabled={isCalibrating}
                  onClick={startRelaxationCalibration}
                  className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm flex items-center gap-2 shadow-lg cursor-pointer whitespace-nowrap"
                >
                  <RefreshCw size={16} className={isCalibrating ? 'animate-spin' : ''} />
                  {isCalibrating ? `Relax Eyes (${calibCountdown}s)...` : 'Calibrate Resting Baseline'}
                </button>
              </div>

              {/* Threshold Sliders */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-2 p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="flex justify-between text-sm font-medium">
                    <span className="text-slate-300">Horizontal Eye Sensitivity</span>
                    <span className="text-cyan-400 font-mono">{settings.calibration.horizontalThreshold} mV</span>
                  </div>
                  <input
                    type="range"
                    min="30"
                    max="150"
                    step="5"
                    value={settings.calibration.horizontalThreshold}
                    onChange={(e) => setSettings({
                      ...settings,
                      calibration: { ...settings.calibration, horizontalThreshold: Number(e.target.value) }
                    })}
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                  <p className="text-[11px] text-slate-500">Lower = more sensitive to slight left/right glances.</p>
                </div>

                <div className="space-y-2 p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="flex justify-between text-sm font-medium">
                    <span className="text-slate-300">Blink Signal Threshold</span>
                    <span className="text-cyan-400 font-mono">{settings.calibration.blinkThreshold} mV</span>
                  </div>
                  <input
                    type="range"
                    min="40"
                    max="200"
                    step="5"
                    value={settings.calibration.blinkThreshold}
                    onChange={(e) => setSettings({
                      ...settings,
                      calibration: { ...settings.calibration, blinkThreshold: Number(e.target.value) }
                    })}
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                  <p className="text-[11px] text-slate-500">Higher = suppresses subtle twitches, requires firm blink.</p>
                </div>

                <div className="space-y-2 p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="flex justify-between text-sm font-medium">
                    <span className="text-slate-300">Double-Blink Window</span>
                    <span className="text-amber-400 font-mono">{settings.calibration.doubleBlinkWindowMs} ms</span>
                  </div>
                  <input
                    type="range"
                    min="400"
                    max="1200"
                    step="50"
                    value={settings.calibration.doubleBlinkWindowMs}
                    onChange={(e) => setSettings({
                      ...settings,
                      calibration: { ...settings.calibration, doubleBlinkWindowMs: Number(e.target.value) }
                    })}
                    className="w-full accent-amber-400 cursor-pointer"
                  />
                  <p className="text-[11px] text-slate-500">Time allowed for 2nd blink to switch sections.</p>
                </div>

                <div className="space-y-2 p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="flex justify-between text-sm font-medium">
                    <span className="text-slate-300">Triple-Blink Window</span>
                    <span className="text-emerald-400 font-mono">{settings.calibration.tripleBlinkWindowMs} ms</span>
                  </div>
                  <input
                    type="range"
                    min="400"
                    max="1000"
                    step="50"
                    value={settings.calibration.tripleBlinkWindowMs}
                    onChange={(e) => setSettings({
                      ...settings,
                      calibration: { ...settings.calibration, tripleBlinkWindowMs: Number(e.target.value) }
                    })}
                    className="w-full accent-emerald-400 cursor-pointer"
                  />
                  <p className="text-[11px] text-slate-500">Time window to trigger item selection.</p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SPEECH & VOICE */}
          {activeTab === 'speech' && (
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Select Synthesizer Voice</label>
                <select
                  value={settings.speech.voiceIndex}
                  onChange={(e) => setSettings({
                    ...settings,
                    speech: { ...settings.speech, voiceIndex: Number(e.target.value) }
                  })}
                  className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:border-cyan-400 outline-none"
                >
                  {voices.map((v, i) => (
                    <option key={i} value={i}>
                      {v.name} ({v.lang})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2 p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-300">Speech Speed (Rate)</span>
                    <span className="text-cyan-400 font-mono">{settings.speech.rate}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.6"
                    max="1.4"
                    step="0.05"
                    value={settings.speech.rate}
                    onChange={(e) => setSettings({
                      ...settings,
                      speech: { ...settings.speech, rate: Number(e.target.value) }
                    })}
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                </div>

                <div className="space-y-2 p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-300">Speech Pitch</span>
                    <span className="text-cyan-400 font-mono">{settings.speech.pitch}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.7"
                    max="1.3"
                    step="0.05"
                    value={settings.speech.pitch}
                    onChange={(e) => setSettings({
                      ...settings,
                      speech: { ...settings.speech, pitch: Number(e.target.value) }
                    })}
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={testVoice}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 font-semibold text-sm flex items-center gap-2 cursor-pointer border border-slate-700"
                >
                  <Volume2 size={16} /> Test Pronunciation
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: HARDWARE CONNECTION */}
          {activeTab === 'hardware' && (
            <div className="space-y-5">
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-white text-base">Active Connection Status</h4>
                  <p className="text-xs text-slate-400 capitalize">
                    {deviceStatus.deviceName} ({deviceStatus.connectionType})
                  </p>
                </div>
                {deviceStatus.isConnected && (
                  <button
                    onClick={handleDisconnect}
                    className="px-4 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-xs font-bold border border-rose-500/30 cursor-pointer"
                  >
                    Disconnect
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  onClick={handleConnectBLE}
                  className="p-5 rounded-2xl bg-slate-900 border-2 border-slate-700 hover:border-blue-500 text-left cursor-pointer transition-all flex flex-col gap-2 group"
                >
                  <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Bluetooth size={22} />
                  </div>
                  <h5 className="font-bold text-white text-base">Web Bluetooth (BLE)</h5>
                  <p className="text-xs text-slate-400">
                    Connect wirelessly to Upside Down Labs NPG Lite / ESP32-C6.
                  </p>
                </button>

                <button
                  onClick={handleConnectSerial}
                  className="p-5 rounded-2xl bg-slate-900 border-2 border-slate-700 hover:border-emerald-500 text-left cursor-pointer transition-all flex flex-col gap-2 group"
                >
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Usb size={22} />
                  </div>
                  <h5 className="font-bold text-white text-base">Web Serial (USB-C)</h5>
                  <p className="text-xs text-slate-400">
                    Connect directly via USB-C cable for ultra-low latency serial feed.
                  </p>
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: CAREGIVER INFO */}
          {activeTab === 'caregiver' && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-300">Attending Caregiver Name</label>
                <input
                  type="text"
                  value={settings.caregiver.name}
                  onChange={(e) => setSettings({
                    ...settings,
                    caregiver: { ...settings.caregiver, name: e.target.value }
                  })}
                  className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:border-cyan-400 outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-300">Room / Bed Number</label>
                <input
                  type="text"
                  value={settings.caregiver.roomNumber}
                  onChange={(e) => setSettings({
                    ...settings,
                    caregiver: { ...settings.caregiver, roomNumber: e.target.value }
                  })}
                  className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:border-cyan-400 outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-300">Emergency Contact Number</label>
                <input
                  type="text"
                  value={settings.caregiver.contactNumber}
                  onChange={(e) => setSettings({
                    ...settings,
                    caregiver: { ...settings.caregiver, contactNumber: e.target.value }
                  })}
                  className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:border-cyan-400 outline-none"
                />
              </div>
            </div>
          )}

          {/* TAB 5: AI DATASET COLLECTION (MODULE 2) */}
          {activeTab === 'dataset' && (
            <div className="space-y-6">
              {/* Header Box */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-950/40 via-blue-950/30 to-cyan-950/40 border border-purple-500/30 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Brain className="text-purple-400" size={20} />
                    <h4 className="font-bold text-white text-base">Module 2: 1D CNN Dataset Collector</h4>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      Real-Time Staging
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Capture dual-channel EOG voltage windows (CH0: Horizontal, CH1: Vertical), store in MongoDB, and export for training.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsCapturingActive(!isCapturingActive)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                      isCapturingActive 
                        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' 
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                  >
                    <Activity size={14} className={isCapturingActive ? 'animate-pulse' : ''} />
                    {isCapturingActive ? 'Live Capture: ON' : 'Live Capture: PAUSED'}
                  </button>
                  <button
                    onClick={loadDatasetInfo}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
                    title="Refresh Stats"
                  >
                    <RefreshCw size={14} />
                  </button>
                </div>
              </div>

              {/* LIVE STAGED SAMPLE PREVIEW CARD */}
              <div className="p-5 rounded-2xl bg-slate-950/80 border-2 border-slate-800 relative overflow-hidden shadow-xl">
                {stagedSample ? (
                  <div className="space-y-4 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className={`px-3 py-1 rounded-xl text-xs font-black tracking-wide border ${
                          stagedSample.label === 'LOOK_LEFT' ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' :
                          stagedSample.label === 'LOOK_RIGHT' ? 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40' :
                          stagedSample.label === 'DOUBLE_BLINK' ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' :
                          stagedSample.label === 'TRIPLE_BLINK' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' :
                          'bg-slate-500/20 text-slate-300 border-slate-500/40'
                        }`}>
                          {stagedSample.label.replace('_', ' ')}
                        </span>
                        <span className="text-xs text-slate-400">
                          Source: <span className="font-mono text-cyan-400 uppercase">{stagedSample.source}</span>
                        </span>
                        <span className="text-xs text-slate-500">|</span>
                        <span className="text-xs text-slate-400">
                          Window: <span className="font-mono text-white">200 pts (1.0s @ 200Hz)</span>
                        </span>
                      </div>

                      {/* Legend */}
                      <div className="flex items-center gap-3 text-[11px] font-medium">
                        <span className="flex items-center gap-1 text-cyan-400">
                          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400"></span> CH0 (Horizontal)
                        </span>
                        <span className="flex items-center gap-1 text-rose-400">
                          <span className="w-2.5 h-2.5 rounded-full bg-rose-400"></span> CH1 (Vertical)
                        </span>
                      </div>
                    </div>

                    {/* SVG Waveform Visualizer */}
                    <div className="relative">
                      {(() => {
                        const width = 500;
                        const height = 90;
                        const midY = height / 2;
                        const len = stagedSample.signal.horizontal.length || 200;
                        const scale = 0.22;

                        let hPath = `M 0 ${midY}`;
                        let vPath = `M 0 ${midY}`;

                        for (let i = 0; i < len; i++) {
                          const x = (i / (len - 1)) * width;
                          const hy = midY - (stagedSample.signal.horizontal[i] || 0) * scale;
                          const vy = midY - (stagedSample.signal.vertical[i] || 0) * scale;
                          hPath += ` L ${x.toFixed(1)} ${hy.toFixed(1)}`;
                          vPath += ` L ${x.toFixed(1)} ${vy.toFixed(1)}`;
                        }

                        return (
                          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-24 bg-slate-950 rounded-xl border border-slate-800 p-1">
                            <line x1="0" y1={midY} x2={width} y2={midY} stroke="#1e293b" strokeDasharray="3 3" />
                            <path d={hPath} fill="none" stroke="#22d3ee" strokeWidth="2" strokeLinecap="round" />
                            <path d={vPath} fill="none" stroke="#f43f5e" strokeWidth="2" strokeLinecap="round" />
                          </svg>
                        );
                      })()}
                    </div>

                    {/* Metrics Banner */}
                    <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                      <div>
                        Peak H: <span className="font-mono text-cyan-300">±{stagedSample.metrics?.horizontalPeak} µV</span>
                        {'  '}|{'  '}
                        Peak V: <span className="font-mono text-rose-300">+{stagedSample.metrics?.verticalPeak} µV</span>
                        {'  '}|{'  '}
                        RMS: <span className="font-mono text-slate-300">{stagedSample.metrics?.rms} µV</span>
                      </div>
                      <div className="text-[11px] text-amber-300 font-semibold flex items-center gap-1">
                        <span>⌨ Press [Enter] to Save | [Esc] to Discard</span>
                      </div>
                    </div>

                    {/* Action Confirmation Buttons */}
                    <div className="flex items-center gap-3 pt-1">
                      <button
                        disabled={isSavingSample}
                        onClick={saveStagedSample}
                        className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg cursor-pointer transition-all"
                      >
                        <CheckCircle2 size={18} />
                        {isSavingSample ? 'Saving to Database...' : 'Confirm & Save to Dataset (Enter ↵)'}
                      </button>
                      <button
                        onClick={() => setStagedSample(null)}
                        className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-rose-950/60 border border-slate-700 hover:border-rose-500/40 text-slate-300 hover:text-rose-300 font-semibold text-sm flex items-center gap-1.5 cursor-pointer transition-all"
                      >
                        <X size={16} /> Discard (Esc)
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="py-6 flex flex-col items-center justify-center text-center space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                      <Activity size={24} className={isCapturingActive ? 'animate-pulse' : ''} />
                    </div>
                    <div>
                      <h5 className="font-bold text-white text-sm">
                        {isCapturingActive ? 'Waiting for Live Eye Gesture...' : 'Capture Currently Paused'}
                      </h5>
                      <p className="text-xs text-slate-400 max-w-md mt-0.5">
                        Make an eye movement with your connected NPG Lite board, use keyboard (<span className="text-cyan-300 font-mono">←, →, 2, 3</span>), or click below to trigger a sample.
                      </p>
                    </div>

                    {/* Quick Manual Simulator Buttons */}
                    <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                      <button
                        onClick={() => handleManualCapture('LOOK_LEFT')}
                        className="px-3 py-1.5 rounded-lg bg-cyan-950/50 hover:bg-cyan-900/60 border border-cyan-500/40 text-cyan-300 text-xs font-semibold cursor-pointer transition-all"
                      >
                        ← Look Left
                      </button>
                      <button
                        onClick={() => handleManualCapture('LOOK_RIGHT')}
                        className="px-3 py-1.5 rounded-lg bg-fuchsia-950/50 hover:bg-fuchsia-900/60 border border-fuchsia-500/40 text-fuchsia-300 text-xs font-semibold cursor-pointer transition-all"
                      >
                        → Look Right
                      </button>
                      <button
                        onClick={() => handleManualCapture('DOUBLE_BLINK')}
                        className="px-3 py-1.5 rounded-lg bg-amber-950/50 hover:bg-amber-900/60 border border-amber-500/40 text-amber-300 text-xs font-semibold cursor-pointer transition-all"
                      >
                        👀 Double Blink
                      </button>
                      <button
                        onClick={() => handleManualCapture('TRIPLE_BLINK')}
                        className="px-3 py-1.5 rounded-lg bg-emerald-950/50 hover:bg-emerald-900/60 border border-emerald-500/40 text-emerald-300 text-xs font-semibold cursor-pointer transition-all"
                      >
                        👁️ Triple Blink
                      </button>
                      <button
                        onClick={() => handleManualCapture('REST')}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 text-xs font-semibold cursor-pointer transition-all"
                      >
                        💤 Rest / Baseline
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* DATASET DISTRIBUTION COUNTERS */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Database size={14} className="text-cyan-400" />
                    Dataset Class Distribution
                  </h5>
                  <span className="text-xs text-slate-400">
                    Total: <strong className="text-white font-mono">{datasetStats.total}</strong> samples
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {[
                    { label: 'Look Left', count: datasetStats.LOOK_LEFT, color: 'border-cyan-500/40 text-cyan-300 bg-cyan-950/20' },
                    { label: 'Look Right', count: datasetStats.LOOK_RIGHT, color: 'border-fuchsia-500/40 text-fuchsia-300 bg-fuchsia-950/20' },
                    { label: 'Double Blink', count: datasetStats.DOUBLE_BLINK, color: 'border-amber-500/40 text-amber-300 bg-amber-950/20' },
                    { label: 'Triple Blink', count: datasetStats.TRIPLE_BLINK, color: 'border-emerald-500/40 text-emerald-300 bg-emerald-950/20' },
                    { label: 'Rest Baseline', count: datasetStats.REST, color: 'border-slate-600 text-slate-300 bg-slate-900/40' }
                  ].map((item, idx) => (
                    <div key={idx} className={`p-3 rounded-xl border ${item.color} flex flex-col justify-between`}>
                      <span className="text-[11px] font-semibold opacity-80">{item.label}</span>
                      <span className="text-xl font-black font-mono mt-1">{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* ACTION TOOLBAR: EXPORT & CLEAR */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-slate-400">
                  <span>Export format ready for 1D CNN PyTorch/TensorFlow training.</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExportDataset}
                    className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md cursor-pointer transition-all"
                  >
                    <Download size={14} /> Export Dataset (.JSON)
                  </button>
                  <button
                    onClick={handleClearDataset}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-rose-950/60 border border-slate-700 hover:border-rose-500/40 text-slate-400 hover:text-rose-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all"
                  >
                    <Trash2 size={14} /> Clear Dataset
                  </button>
                </div>
              </div>

              {/* RECENT SAMPLES TABLE */}
              {recentSamples.length > 0 && (
                <div className="space-y-2">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Recent Captured Samples ({recentSamples.length})
                  </h5>
                  <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-800 divide-y divide-slate-800/60 bg-slate-950/40">
                    {recentSamples.slice(0, 10).map((sample, idx) => (
                      <div key={sample._id || idx} className="p-2.5 flex items-center justify-between hover:bg-slate-900/60 transition-all text-xs">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            sample.label === 'LOOK_LEFT' ? 'bg-cyan-500/20 text-cyan-300' :
                            sample.label === 'LOOK_RIGHT' ? 'bg-fuchsia-500/20 text-fuchsia-300' :
                            sample.label === 'DOUBLE_BLINK' ? 'bg-amber-500/20 text-amber-300' :
                            sample.label === 'TRIPLE_BLINK' ? 'bg-emerald-500/20 text-emerald-300' :
                            'bg-slate-500/20 text-slate-300'
                          }`}>
                            {sample.label}
                          </span>
                          <span className="text-slate-400 font-mono text-[11px]">
                            {sample.createdAt ? new Date(sample.createdAt).toLocaleTimeString() : 'Recently'}
                          </span>
                          <span className="text-slate-500 text-[10px]">
                            ({sample.source})
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleDeleteSample(sample._id)}
                            className="p-1 rounded text-slate-500 hover:text-rose-400 transition-all cursor-pointer"
                            title="Delete this sample"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer with Save Button */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <span className="text-xs text-slate-500">MongoDB Synced Configuration</span>
          <button
            onClick={saveSettings}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-sm flex items-center gap-2 shadow-lg cursor-pointer transition-all"
          >
            <Save size={16} /> Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};
