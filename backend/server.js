require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const crypto = require('crypto');

const log = require('./utils/logger');

// UB-39: backend console.log gated behind DEBUG; console.error stays for real failures.
const DEBUG = process.env.DEBUG === '1' || process.env.DEBUG === 'true';
log.setDebug(DEBUG);

const app = express();
const PORT = process.env.PORT || 4000;

// UB-36: CORS only enabled when CORS_ORIGIN is set. Comma-separated origins are
// trimmed before passing to cors(). Empty / unset → no CORS middleware at all
// (same-origin only — fine for the bundled docker-compose proxy).
if (process.env.CORS_ORIGIN) {
  const origins = process.env.CORS_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean);
  app.use(cors({ origin: origins }));
}

// UB-59: request-id + access-log middleware. Reads `X-Request-Id` from the
// caller when it looks like a UUID-ish token (16+ hex chars); otherwise
// generates a fresh one via crypto.randomUUID(). Echoes the resolved id
// back on `X-Request-Id`. Logs one JSON line per request with {reqId,
// method, path, status, ms} so a downstream log shipper can correlate
// per-request latency / status codes.
app.use((req, res, next) => {
  const incoming = req.headers['x-request-id'];
  const looksLikeToken = typeof incoming === 'string' && /^[A-Za-z0-9_-]{8,128}$/.test(incoming);
  const reqId = looksLikeToken ? incoming : crypto.randomUUID();
  req.reqId = reqId;
  res.setHeader('X-Request-Id', reqId);
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const ns = process.hrtime.bigint() - start;
    const ms = Number(ns) / 1e6;
    log.info({
      msg: 'request',
      reqId,
      method: req.method,
      path: req.originalUrl.split('?')[0],
      status: res.statusCode,
      ms: Math.round(ms * 100) / 100,
    });
  });
  next();
});

app.use(express.json());

// Database Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pixelpaladin';
mongoose.connect(MONGODB_URI)
  .then(async () => {
    if (DEBUG) log.debug({ msg: 'Connected to MongoDB' });
    // UB-15: sync declared indexes (unique uuid, finished/createdAt). Log errors; do not crash boot.
    try {
      const { Cycle, UserProfile } = require('./repositories');
      await Promise.all([Cycle.syncIndexes(), UserProfile.syncIndexes()]);
      if (DEBUG) log.debug({ msg: 'Mongo indexes synced (Cycle, UserProfile)' });
    } catch (err) {
      log.error({ msg: 'Index sync failed (UB-15)', err: String(err && err.message || err) });
    }
  })
  .catch(err => {
    log.error({ msg: 'MongoDB connection error', err: String(err && err.message || err) });
  });

// UB-18 envelope helpers
const { failNotFound, internal } = require('./utils/respond');

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

// UB-18: JSON 404 handler (envelope)
app.use((req, res, next) => {
  if (req.path === '/readyz') return next();
  return failNotFound(res, `Route ${req.method} ${req.path} not found`);
});

// UB-18: JSON 500 handler (envelope) — generic message, log detail server-side.
// Delegates to `internal()` from utils/respond so the JSON log carries
// reqId from `res.req.reqId` via the lazy-loaded logger.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  return internal(res, err);
});

// Start Server
const server = app.listen(PORT, () => {
  if (DEBUG) log.debug({ msg: `Server running on port ${PORT}` });
  log.info({ msg: 'server.listening', port: PORT });
});

// UB-59: graceful shutdown — stop accepting new connections, drain in
// flight, close mongoose, exit 0. SIGTERM (Docker stop, k8s, Watchtower)
// and SIGINT (Ctrl-C) trigger the same path. A 10 s hard timer
// force-exits with code 1 if anything hangs.
let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  log.info({ msg: 'server.shutdown.begin', signal });

  // Race a hard timer against the close chain. Whatever wins, we exit
  // 0 from the close path and 1 from the timer path. The timer keeps
  // its handle unref'd so it never holds the event loop open by itself.
  const hardTimer = setTimeout(() => {
    log.error({ msg: 'server.shutdown.timeout', signal });
    process.exit(1);
  }, 10_000);
  hardTimer.unref();

  function finishOk(reason) {
    log.info({ msg: 'server.shutdown.done', reason });
    // Allow stdout to flush before exit.
    setImmediate(() => process.exit(0));
  }

  // 1. Stop accepting new connections; existing ones drain.
  server.close((err) => {
    if (err) log.error({ msg: 'server.close.error', err: String(err && err.message || err) });
    log.info({ msg: 'server.http.closed' });

    // 2. Close the mongoose connection. If mongoose never connected
    //    (bogus URI / network down), close() can hang forever; race it
    //    against a 2 s inner timeout so we still exit 0 in the contract.
    let mongoClosed = false;
    const mongoTimer = setTimeout(() => {
      if (!mongoClosed) {
        log.warn({ msg: 'server.mongo.close.skipped', reason: 'timeout' });
        finishOk('mongo-close-timeout');
      }
    }, 2_000);
    mongoTimer.unref();

    mongoose.connection.close()
        .then(() => {
          mongoClosed = true;
          clearTimeout(mongoTimer);
          log.info({ msg: 'server.mongo.closed' });
          finishOk('clean');
        })
        .catch((err) => {
          mongoClosed = true;
          clearTimeout(mongoTimer);
          log.warn({ msg: 'server.mongo.close.error', err: String(err && err.message || err) });
          finishOk('mongo-close-error');
        });
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('uncaughtException', (err) => {
  log.error({ msg: 'uncaughtException', err: String(err.stack || err.message || err) });
  shutdown('uncaughtException');
});
process.on('unhandledRejection', (reason) => {
  log.error({ msg: 'unhandledRejection', reason: String(reason && reason.stack || reason) });
});