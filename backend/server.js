require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 4000;

// UB-39: backend console.log gated behind DEBUG; console.error stays for real failures.
const DEBUG = process.env.DEBUG === '1' || process.env.DEBUG === 'true';

// UB-36: CORS only enabled when CORS_ORIGIN is set. Comma-separated origins are
// trimmed before passing to cors(). Empty / unset → no CORS middleware at all
// (same-origin only — fine for the bundled docker-compose proxy).
if (process.env.CORS_ORIGIN) {
  const origins = process.env.CORS_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean);
  app.use(cors({ origin: origins }));
}

app.use(express.json());

// Database Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pixelpaladin';
mongoose.connect(MONGODB_URI)
  .then(async () => {
    if (DEBUG) console.log('Connected to MongoDB');
    // UB-15: sync declared indexes (unique uuid, finished/createdAt). Log errors; do not crash boot.
    try {
      const Cycle = require('./models/Cycle');
      const UserProfile = require('./models/UserProfile');
      await Promise.all([Cycle.syncIndexes(), UserProfile.syncIndexes()]);
      if (DEBUG) console.log('Mongo indexes synced (Cycle, UserProfile)');
    } catch (err) {
      console.error('Index sync failed (UB-15). Deduplicate uuid values if E11000:', err && err.message ? err.message : err);
    }
  })
  .catch(err => console.error('MongoDB connection error:', err));

// UB-18 envelope helpers
const { fail, failNotFound, internal } = require('./utils/respond');

// Plain text welcome (kept un-enveloped — legacy, no contract)
app.get('/', (req, res) => {
  res.send('PixelPaladin Backend is running');
});

// UB-16: readiness — 200 only when mongoose is connected (un-enveloped per contract)
app.get('/readyz', (req, res) => {
  if (mongoose.connection.readyState === 1) {
    return res.status(200).json({ status: 'ready' });
  }
  return res.status(503).json({
    status: 'not_ready',
    readyState: mongoose.connection.readyState,
  });
});

// Import Routes
const cycleRoutes = require('./routes/cycleRoutes');
app.use('/api/cycles', cycleRoutes);
// B-BE-3: /api/tasks router retired; legacy `createMonth` lives on POST /api/cycles now.

// UB-18: JSON 404 handler (envelope)
app.use((req, res, next) => {
  if (req.path === '/readyz') return next();
  return failNotFound(res, `Route ${req.method} ${req.path} not found`);
});

// UB-18: JSON 500 handler (envelope) — generic message, log detail server-side
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  return internal(res, err);
});

// Start Server
app.listen(PORT, () => {
  if (DEBUG) console.log(`Server running on port ${PORT}`);
});