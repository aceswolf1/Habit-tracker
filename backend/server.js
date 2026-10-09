require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());

// Database Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pixelpaladin';
mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log('Connected to MongoDB');
    // UB-15: sync declared indexes (unique uuid, finished/createdAt). Log errors; do not crash boot.
    try {
      const Cycle = require('./models/Cycle');
      const UserProfile = require('./models/UserProfile');
      await Promise.all([Cycle.syncIndexes(), UserProfile.syncIndexes()]);
      console.log('Mongo indexes synced (Cycle, UserProfile)');
    } catch (err) {
      console.error('Index sync failed (UB-15). Deduplicate uuid values if E11000:', err && err.message ? err.message : err);
    }
  })
  .catch(err => console.error('MongoDB connection error:', err));

// Routes
app.get('/', (req, res) => {
  res.send('PixelPaladin Backend is running');
});

// UB-16: readiness — 200 only when mongoose is connected
app.get('/readyz', (req, res) => {
  if (mongoose.connection.readyState === 1) {
    return res.status(200).json({ status: 'ready' });
  }
  return res.status(503).json({
    status: 'not_ready',
    readyState: mongoose.connection.readyState
  });
});

// Import Routes
const cycleRoutes = require('./routes/cycleRoutes');
const taskRoutes = require('./routes/taskRoutes');
app.use('/api/cycles', cycleRoutes);
app.use('/api/tasks', taskRoutes);

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
