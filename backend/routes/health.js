const express = require('express');
const router = express.Router();
const HealthLog = require('../models/HealthLog');

// GET latest health telemetry
router.get('/latest', async (req, res) => {
  try {
    let latest = await HealthLog.findOne().sort({ createdAt: -1 });
    if (!latest) {
      latest = {
        blinkRatePerMinute: 14,
        saccadeCount: { left: 0, right: 0 },
        batteryPercentage: 92,
        signalQuality: 'good',
        connectionType: 'simulator',
        deviceState: 'active'
      };
    }
    res.json({ success: true, data: latest });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET recent health telemetry history (for sparklines/charts)
router.get('/history', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const history = await HealthLog.find()
      .sort({ createdAt: -1 })
      .limit(limit);
    res.json({ success: true, count: history.length, data: history.reverse() });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST new health telemetry snapshot
router.post('/telemetry', async (req, res) => {
  try {
    const {
      blinkRatePerMinute,
      saccadeCount,
      batteryPercentage,
      signalQuality,
      connectionType,
      deviceState
    } = req.body;

    const log = new HealthLog({
      blinkRatePerMinute: blinkRatePerMinute ?? 14,
      saccadeCount: saccadeCount || { left: 0, right: 0 },
      batteryPercentage: batteryPercentage ?? 90,
      signalQuality: signalQuality || 'good',
      connectionType: connectionType || 'simulator',
      deviceState: deviceState || 'active'
    });

    await log.save();

    // Broadcast live telemetry to all connected caregiver dashboards
    const io = req.app.get('socketio');
    if (io) {
      io.emit('health_telemetry', log);
    }

    res.status(201).json({ success: true, data: log });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
