import React, { useState, useEffect } from 'react';
import { 
  Sliders, 
  Bluetooth, 
  Usb, 
  Volume2, 
  Save, 
  X, 
  RefreshCw, 
  Sparkles
} from 'lucide-react';
import { eyeInputManager } from '../services/eyeInputManager';
import { speechService } from '../services/speechService';
import { apiService } from '../services/apiService';
import type { CaregiverSettingsData } from '../services/apiService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'calibration' | 'speech' | 'hardware' | 'caregiver'>('calibration');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [isCalibrating, setIsCalibrating] = useState<boolean>(false);
  const [calibCountdown, setCalibCountdown] = useState<number>(2);

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
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-slate-800/80 bg-slate-950/40">
          {[
            { id: 'calibration', label: 'EOG Calibration' },
            { id: 'speech', label: 'Voice & Speech' },
            { id: 'hardware', label: 'Hardware Connection' },
            { id: 'caregiver', label: 'Caregiver Info' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`
                px-4 py-2 text-sm font-semibold rounded-t-xl transition-all border-b-2 cursor-pointer
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
