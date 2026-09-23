const mongoose = require('mongoose');

const PatientRequestSchema = new mongoose.Schema({
  category: {
    type: String,
    required: true,
    enum: ['food', 'water', 'toilet', 'clothing', 'comfort', 'pain', 'family', 'sos', 'keyboard', 'custom']
  },
  subCategory: {
    type: String,
    default: ''
  },
  label: {
    type: String,
    required: true
  },
  speechText: {
    type: String,
    required: true
  },
  urgency: {
    type: String,
    enum: ['normal', 'urgent', 'emergency'],
    default: 'normal'
  },
  status: {
    type: String,
    enum: ['pending', 'in-progress', 'attended'],
    default: 'pending'
  },
  triggerMethod: {
    type: String,
    enum: ['eye_movement', 'triple_blink', 'manual_sim', 'keyboard'],
    default: 'triple_blink'
  },
  attendedBy: {
    type: String,
    default: null
  },
  attendedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('PatientRequest', PatientRequestSchema);
