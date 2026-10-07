const mongoose = require('mongoose');

const DatasetSampleSchema = new mongoose.Schema({
  label: {
    type: String,
    required: true,
    enum: ['LOOK_LEFT', 'LOOK_RIGHT', 'DOUBLE_BLINK', 'TRIPLE_BLINK', 'REST']
  },
  gestureCode: {
    type: String,
    enum: ['L', 'R', 'D', 'T', 'N'],
    default: 'N'
  },
  source: {
    type: String,
    enum: ['ble', 'serial', 'simulator', 'keyboard', 'guided'],
    default: 'ble'
  },
  sampleRate: {
    type: Number,
    default: 200
  },
  windowSize: {
    type: Number,
    default: 200
  },
  signal: {
    horizontal: {
      type: [Number],
      required: true
    },
    vertical: {
      type: [Number],
      required: true
    }
  },
  metrics: {
    horizontalPeak: { type: Number, default: 0 },
    verticalPeak: { type: Number, default: 0 },
    rms: { type: Number, default: 0 }
  },
  subjectId: {
    type: String,
    default: 'Patient_01'
  },
  notes: {
    type: String,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('DatasetSample', DatasetSampleSchema);
