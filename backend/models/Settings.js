const mongoose = require('mongoose');

const SettingsSchema = new mongoose.Schema({
  configId: {
    type: String,
    default: 'default',
    unique: true
  },
  // EOG & EEG Hardware parameters
  calibration: {
    horizontalThreshold: {
      type: Number,
      default: 80.0
    },
    blinkThreshold: {
      type: Number,
      default: 100.0
    },
    eyeDebounceMs: {
      type: Number,
      default: 450
    },
    blinkDebounceMs: {
      type: Number,
      default: 250
    },
    doubleBlinkWindowMs: {
      type: Number,
      default: 750
    },
    tripleBlinkWindowMs: {
      type: Number,
      default: 650
    }
  },
  // Audio & Voice Preferences
  speech: {
    voiceIndex: {
      type: Number,
      default: 0
    },
    rate: {
      type: Number,
      default: 0.95
    },
    pitch: {
      type: Number,
      default: 1.0
    },
    volume: {
      type: Number,
      default: 1.0
    },
    audioTonesEnabled: {
      type: Boolean,
      default: true
    }
  },
  // Caregiver Information
  caregiver: {
    name: {
      type: String,
      default: 'Primary Caregiver'
    },
    contactNumber: {
      type: String,
      default: '+91 98765 43210'
    },
    roomNumber: {
      type: String,
      default: 'ICU Bed 04'
    },
    audioAlertVolume: {
      type: Number,
      default: 90
    }
  },
  theme: {
    mode: {
      type: String,
      enum: ['dark', 'light', 'high-contrast'],
      default: 'dark'
    }
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Settings', SettingsSchema);
