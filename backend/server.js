const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// Setup Socket.IO with CORS
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE']
  }
});

app.set('socketio', io);

// Middlewares
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// MongoDB Connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/revoice_lis';

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB successfully at:', MONGO_URI);
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err.message);
  });

// Routes
app.use('/api/requests', require('./routes/requests'));
app.use('/api/health', require('./routes/health'));
app.use('/api/settings', require('./routes/settings'));

// Root Status Route
app.get('/api/status', (req, res) => {
  res.json({
    name: 'Revoice Locked-In Syndrome Assistant API',
    status: 'online',
    version: '1.0.0',
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date()
  });
});

// Socket.IO Events
io.on('connection', (socket) => {
  console.log(`🔌 Client connected to WebSocket: ${socket.id}`);

  // Relay live eye movement gestures if emitted by browser or bridge
  socket.on('eye_gesture', (gestureData) => {
    // Broadcast gesture to other listeners (e.g. Caregiver HUD)
    socket.broadcast.emit('live_eye_gesture', gestureData);
  });

  socket.on('disconnect', () => {
    console.log(`❌ Client disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Revoice Backend running on http://localhost:${PORT}`);
});
