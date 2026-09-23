const express = require('express');
const router = express.Router();
const PatientRequest = require('../models/PatientRequest');

// GET all patient requests
router.get('/', async (req, res) => {
  try {
    const { status, limit = 50 } = req.query;
    const filter = status ? { status } : {};
    const requests = await PatientRequest.find(filter)
      .sort({ createdAt: -1 })
      .limit(Number(limit));
    res.json({ success: true, count: requests.length, data: requests });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST a new patient request
router.post('/', async (req, res) => {
  try {
    const { category, subCategory, label, speechText, urgency, triggerMethod } = req.body;
    
    if (!category || !label || !speechText) {
      return res.status(400).json({ success: false, error: 'Category, label, and speechText are required' });
    }

    const newRequest = new PatientRequest({
      category,
      subCategory: subCategory || '',
      label,
      speechText,
      urgency: urgency || 'normal',
      triggerMethod: triggerMethod || 'triple_blink'
    });

    await newRequest.save();

    // Broadcast via Socket.IO if available
    const io = req.app.get('socketio');
    if (io) {
      io.emit('new_patient_request', newRequest);
      if (newRequest.urgency === 'emergency') {
        io.emit('emergency_alarm', newRequest);
      }
    }

    res.status(201).json({ success: true, data: newRequest });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PATCH mark request as attended
router.patch('/:id/attend', async (req, res) => {
  try {
    const { attendedBy = 'Caregiver' } = req.body;
    const request = await PatientRequest.findById(req.params.id);
    
    if (!request) {
      return res.status(404).json({ success: false, error: 'Request not found' });
    }

    request.status = 'attended';
    request.attendedBy = attendedBy;
    request.attendedAt = new Date();
    await request.save();

    // Broadcast update
    const io = req.app.get('socketio');
    if (io) {
      io.emit('request_attended', request);
    }

    res.json({ success: true, data: request });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE a specific request
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await PatientRequest.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Request not found' });
    }
    res.json({ success: true, message: 'Request removed' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
