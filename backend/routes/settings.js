const express = require('express');
const router = express.Router();
const Settings = require('../models/Settings');

// GET current settings (creates default if none exists)
router.get('/', async (req, res) => {
  try {
    let settings = await Settings.findOne({ configId: 'default' });
    if (!settings) {
      settings = new Settings({ configId: 'default' });
      await settings.save();
    }
    res.json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT / update settings
router.put('/', async (req, res) => {
  try {
    const updateData = req.body;
    let settings = await Settings.findOneAndUpdate(
      { configId: 'default' },
      { $set: updateData },
      { new: true, upsert: true, runValidators: true }
    );

    // Broadcast updated settings to all clients
    const io = req.app.get('socketio');
    if (io) {
      io.emit('settings_updated', settings);
    }

    res.json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
