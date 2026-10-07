const express = require('express');
const router = express.Router();
const DatasetSample = require('../models/DatasetSample');

// GET dataset stats (counts per class)
router.get('/stats', async (req, res) => {
  try {
    const counts = await DatasetSample.aggregate([
      { $group: { _id: '$label', count: { $sum: 1 } } }
    ]);

    const stats = {
      LOOK_LEFT: 0,
      LOOK_RIGHT: 0,
      DOUBLE_BLINK: 0,
      TRIPLE_BLINK: 0,
      REST: 0,
      total: 0
    };

    counts.forEach((item) => {
      if (stats.hasOwnProperty(item._id)) {
        stats[item._id] = item.count;
      }
      stats.total += item.count;
    });

    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET list of samples (latest 50)
router.get('/samples', async (req, res) => {
  try {
    const { label, limit = 50 } = req.query;
    const filter = label ? { label } : {};
    const samples = await DatasetSample.find(filter)
      .select('-signal') // Exclude heavy signal arrays in summary view
      .sort({ createdAt: -1 })
      .limit(Number(limit));

    res.json({ success: true, count: samples.length, data: samples });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST save a new dataset sample
router.post('/samples', async (req, res) => {
  try {
    const { label, gestureCode, source, sampleRate, windowSize, signal, metrics, subjectId, notes } = req.body;

    if (!label || !signal || !signal.horizontal || !signal.vertical) {
      return res.status(400).json({
        success: false,
        error: 'Label and dual-channel signal arrays (horizontal, vertical) are required'
      });
    }

    const sample = new DatasetSample({
      label,
      gestureCode: gestureCode || 'N',
      source: source || 'ble',
      sampleRate: sampleRate || 200,
      windowSize: windowSize || signal.horizontal.length,
      signal,
      metrics: metrics || {},
      subjectId: subjectId || 'Patient_01',
      notes: notes || ''
    });

    await sample.save();

    // Broadcast update via WebSocket if available
    const io = req.app.get('socketio');
    if (io) {
      io.emit('dataset_sample_added', {
        id: sample._id,
        label: sample.label,
        createdAt: sample.createdAt
      });
    }

    res.status(201).json({ success: true, data: sample });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE a specific sample
router.delete('/samples/:id', async (req, res) => {
  try {
    const deleted = await DatasetSample.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Sample not found' });
    }
    res.json({ success: true, message: 'Sample deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE clear all samples
router.delete('/clear', async (req, res) => {
  try {
    const result = await DatasetSample.deleteMany({});
    res.json({ success: true, deletedCount: result.deletedCount });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET export full dataset for 1D CNN training (JSON download)
router.get('/export', async (req, res) => {
  try {
    const samples = await DatasetSample.find().sort({ createdAt: 1 });
    const payload = {
      datasetName: 'Revoice EOG Saccade & Blink Dataset',
      exportedAt: new Date().toISOString(),
      numSamples: samples.length,
      classes: ['LOOK_LEFT', 'LOOK_RIGHT', 'DOUBLE_BLINK', 'TRIPLE_BLINK', 'REST'],
      samples: samples.map((s) => ({
        id: s._id,
        label: s.label,
        gestureCode: s.gestureCode,
        source: s.source,
        sampleRate: s.sampleRate,
        windowSize: s.windowSize,
        horizontal: s.signal.horizontal,
        vertical: s.signal.vertical,
        createdAt: s.createdAt
      }))
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="revoice_eog_dataset.json"');
    res.json(payload);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
