const mongoose = require('mongoose');

const HealthLogSchema = new mongoose.Schema({
  timestamp: {
    type: Date,
    default: Date.now
  },
  blinkRatePerMinute: {
    type: Number,
    default: 14
  },
  saccadeCount: {
    left: { type: Number, default: 0 },
    right: { type: Number, default: 0 }
  },
  batteryPercentage: {
    type: Number,
    default: 95
  },
  signalQuality: {
    type: String,
    enum: ['excellent', 'good', 'moderate', 'poor', 'disconnected'],
    default: 'good'
  },
  connectionType: {
    type: String,
    enum: ['ble', 'serial', 'simulator', 'disconnected'],
    default: 'simulator'
  },
  deviceState: {
    type: String,
    enum: ['active', 'idle', 'sleeping', 'alert'],
    default: 'active'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('HealthLog', HealthLogSchema);
