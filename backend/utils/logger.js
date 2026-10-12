'use strict';
/**
 * UB-59 — tiny JSON-lines logger for the backend.
 *
 * No new deps. Each `log()` call emits one `{"ts":..., "level":..., ...}\n`
 * line on stdout (or stderr when `toStderr` is true). Levels:
 *   debug  — verbose boot/cycle-finish logs (UB-39, gated by DEBUG env)
 *   info   — request access logs (UB-59), lifecycle events
 *   warn   — recoverable anomalies (e.g. CORS with no origins)
 *   error  — caught exceptions, shutdown errors
 *
 * The shape is intentionally flat so a downstream log shipper (Loki,
 * Vector, journald) can ingest without a schema mapping.
 */

let DEBUG = false;

/** Allow server.js to mirror UB-39's DEBUG env. Called once at boot. */
function setDebug(value) {
  DEBUG = Boolean(value);
}

function isDebug() {
  return DEBUG;
}

function emit(level, fields, toStderr) {
  const payload = Object.assign(
    {
      ts: new Date().toISOString(),
      level,
    },
    fields || {}
  );
  try {
    const line = JSON.stringify(payload) + '\n';
    if (toStderr) process.stderr.write(line);
    else process.stdout.write(line);
  } catch (err) {
    // Last-ditch: never let logging throw back at the caller.
    process.stderr.write(`{"ts":"${new Date().toISOString()}","level":"error","msg":"logger serialization failed","err":"${String(err && err.message || err).replace(/"/g, '\\"')}"}\n`);
  }
}

function debug(fields) { if (DEBUG) emit('debug', fields, false); }
function info(fields)  { emit('info',  fields, false); }
function warn(fields)  { emit('warn',  fields, false); }
function error(fields) { emit('error', fields, true);  }

/**
 * Wrap an existing console.log / console.error in JSON shape. Used by
 * places that already call console.log directly (UB-39 compat) so we can
 * keep the existing DEBUG-gated console.log path AND also emit JSON in
 * non-DEBUG mode for the access log. Returns a function the caller
 * should use instead of console.log/console.error.
 */
function wrapConsole() {
  const origLog = console.log.bind(console);
  const origErr = console.error.bind(console);
  console.log = (...args) => origLog(...args); // untouched
  console.error = (...args) => {
    // Convert to a JSON error record but still write to stderr.
    const message = args.map((a) => (typeof a === 'string' ? a : safeStringify(a))).join(' ');
    emit('error', { msg: message }, true);
  };
}

function safeStringify(v) {
  try { return JSON.stringify(v); } catch { return String(v); }
}

module.exports = {
  setDebug,
  isDebug,
  debug,
  info,
  warn,
  error,
  // Internal — exposed so test-logger.js can capture output.
  _emit: emit,
  _wrapConsole: wrapConsole,
};