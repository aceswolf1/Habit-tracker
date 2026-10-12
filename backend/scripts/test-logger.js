#!/usr/bin/env node
/**
 * UB-59 — unit-level proof of the JSON-lines logger + request-id echo.
 *
 *   1. Logger format: every emitted line is a valid JSON object with
 *      `ts` + `level`; the access-log payload carries the documented
 *      fields (reqId, method, path, status, ms).
 *   2. Request-id echo: a tiny in-process express app accepts an
 *      `X-Request-Id`, passes it through unchanged; when missing, a
 *      UUID-shaped one is generated and echoed in the response header.
 *   3. Errors logged with reqId: the JSON 500 handler attaches the
 *      request's reqId to the error log line.
 *
 * No new deps. Standalone Node, no mongoose / network.
 *
 * Runnable with: node backend/scripts/test-logger.js
 */

'use strict';

const assert = require('assert');
const http = require('http');
const express = require('express');

const log = require('../utils/logger');

// Capture the logger output (which writes to process.stdout / stderr)
// into a buffer we can inspect line by line.
function captureStdout(fn) {
  const origWrite = process.stdout.write.bind(process.stdout);
  const origErr = process.stderr.write.bind(process.stderr);
  const lines = [];
  process.stdout.write = (chunk, ...rest) => {
    const s = String(chunk);
    s.split('\n').forEach((l) => { if (l) lines.push(l); });
    return true;
  };
  process.stderr.write = (chunk, ...rest) => {
    const s = String(chunk);
    s.split('\n').forEach((l) => { if (l) lines.push(l); });
    return true;
  };
  // If `fn` returns a promise, wait for it before restoring stdout. This
  // is the only way the access-log line (emitted on res 'finish', after
  // the response body is drained) ends up in our captured buffer.
  let p;
  try {
    p = fn();
  } finally {
    if (!p || typeof p.then !== 'function') {
      process.stdout.write = origWrite;
      process.stderr.write = origErr;
    }
  }
  if (p && typeof p.then === 'function') {
    return p.then(
      (v) => { process.stdout.write = origWrite; process.stderr.write = origErr; return lines; },
      (e) => { process.stdout.write = origWrite; process.stderr.write = origErr; throw e; }
    );
  }
  return lines;
}

let passed = 0;
function check(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`PASS: ${name}`);
  } catch (err) {
    console.error(`FAIL: ${name}`);
    console.error(err && err.message ? err.message : err);
    process.exit(1);
  }
}
async function checkAsync(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`PASS: ${name}`);
  } catch (err) {
    console.error(`FAIL: ${name}`);
    console.error(err && err.message ? err.message : err);
    if (err && err.actual !== undefined && err.expected !== undefined) {
      console.error('  actual:  ' + JSON.stringify(err.actual));
      console.error('  expected:' + JSON.stringify(err.expected));
    }
    process.exit(1);
  }
}

// ---- 1. logger format -----------------------------------------------------

check('logger.info emits a valid JSON line with ts + level', () => {
  const lines = captureStdout(() => {
    log.info({ msg: 'unit-test', foo: 1 });
  });
  assert.strictEqual(lines.length, 1);
  const j = JSON.parse(lines[0]);
  assert.strictEqual(j.level, 'info');
  assert.match(j.ts, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/, 'ts is ISO-8601 ms');
  assert.strictEqual(j.msg, 'unit-test');
  assert.strictEqual(j.foo, 1);
});

check('logger.debug is silent when DEBUG=0', () => {
  log.setDebug(false);
  const lines = captureStdout(() => log.debug({ msg: 'should-be-silent' }));
  assert.strictEqual(lines.length, 0, 'debug should not emit when DEBUG=0');
});

check('logger.debug emits when DEBUG=true', () => {
  log.setDebug(true);
  const lines = captureStdout(() => log.debug({ msg: 'shown' }));
  assert.strictEqual(lines.length, 1);
  const j = JSON.parse(lines[0]);
  assert.strictEqual(j.level, 'debug');
  assert.strictEqual(j.msg, 'shown');
  log.setDebug(false); // restore
});

check('logger.error writes to stderr (preserves level)', () => {
  const origStdout = process.stdout.write.bind(process.stdout);
  const origErr = process.stderr.write.bind(process.stderr);
  let stdoutCaptured = '';
  let stderrCaptured = '';
  process.stdout.write = (c) => { stdoutCaptured += String(c); return true; };
  process.stderr.write = (c) => { stderrCaptured += String(c); return true; };
  try {
    log.error({ msg: 'ohno', err: 'kaboom' });
  } finally {
    process.stdout.write = origStdout;
    process.stderr.write = origErr;
  }
  assert.strictEqual(stdoutCaptured, '', 'error must not write to stdout');
  assert.ok(stderrCaptured.includes('ohno'), 'stderr contains error payload');
  const j = JSON.parse(stderrCaptured.trim());
  assert.strictEqual(j.level, 'error');
  assert.strictEqual(j.err, 'kaboom');
});

// ---- 2. request-id echo via in-process express ---------------------------

async function startTestApp() {
  // Mirror the production middleware as a small app on an ephemeral port.
  const crypto = require('crypto');
  const app = express();
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
  app.get('/ok', (req, res) => res.json({ reqId: req.reqId }));
  app.get('/boom', (req, res, next) => next(new Error('synthetic failure')));
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    log.error({
      msg: 'api/exception',
      reqId: req.reqId,
      method: req.method,
      path: req.originalUrl.split('?')[0],
      err: String(err.stack || err.message || err),
    });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL', message: 'Internal server error' },
    });
  });
  return new Promise((resolve) => {
    const server = app.listen(0, () => resolve({ server, port: server.address().port }));
  });
}

async function get(port, path, headers) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path, method: 'GET', headers }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

// Give the `res.on('finish')` handler a tick to flush before the caller
// inspects captured lines (access-log line is emitted on finish, which
// fires after end on the response object).
const nextTick = () => new Promise((r) => setImmediate(r));

(async () => {
  const { server, port } = await startTestApp();
  try {
    await checkAsync('echoes caller-supplied X-Request-Id verbatim', async () => {
      const captured = await captureStdout(async () => {
        const r = await get(port, '/ok', { 'X-Request-Id': 'my-trace-1234' });
        assert.strictEqual(r.status, 200);
        assert.strictEqual(r.headers['x-request-id'], 'my-trace-1234');
        const body = JSON.parse(r.body);
        assert.strictEqual(body.reqId, 'my-trace-1234');
      });
      const requestLine = captured.find((l) => l.includes('"msg":"request"'));
      assert.ok(requestLine, 'access-log line present');
      const j = JSON.parse(requestLine);
      assert.strictEqual(j.reqId, 'my-trace-1234', 'access-log reqId matches');
      assert.strictEqual(j.method, 'GET', 'access-log method matches');
      assert.strictEqual(j.path, '/ok', 'access-log path matches');
      assert.strictEqual(j.status, 200, 'access-log status matches');
      assert.strictEqual(typeof j.ms, 'number', 'access-log ms is number');
    });

    await checkAsync('generates UUID-shaped id when caller omits X-Request-Id', async () => {
      const captured = await captureStdout(async () => {
        const r = await get(port, '/ok');
        assert.strictEqual(r.status, 200);
        const echo = r.headers['x-request-id'];
        assert.match(echo, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
          'auto-generated X-Request-Id must look like a UUID');
      });
      const requestLine = captured.find((l) => l.includes('"msg":"request"'));
      assert.ok(requestLine, 'access-log line present for generated id');
      const j = JSON.parse(requestLine);
      assert.match(j.reqId, /^[0-9a-f-]{36}$/i, 'log reqId is UUID-shaped');
    });

    await checkAsync('rejects malformed X-Request-Id and generates fresh one', async () => {
      const captured = await captureStdout(async () => {
        const r = await get(port, '/ok', { 'X-Request-Id': 'a' }); // too short
        assert.strictEqual(r.status, 200);
        const echo = r.headers['x-request-id'];
        assert.notStrictEqual(echo, 'a', 'short id must not be passed through');
        assert.match(echo, /^[0-9a-f-]{36}$/i, 'fresh id is UUID-shaped');
      });
      const requestLine = captured.find((l) => l.includes('"msg":"request"'));
      assert.ok(requestLine, 'access-log line present');
      const j = JSON.parse(requestLine);
      assert.notStrictEqual(j.reqId, 'a', 'log reqId must be a fresh UUID, not "a"');
    });

    await checkAsync('errors are logged with the request reqId', async () => {
      const captured = await captureStdout(async () => {
        const r = await get(port, '/boom', { 'X-Request-Id': 'trace-fail-9999' });
        assert.strictEqual(r.status, 500);
        assert.strictEqual(r.headers['x-request-id'], 'trace-fail-9999');
      });
      const errLine = captured.find((l) => l.includes('"msg":"api/exception"'));
      assert.ok(errLine, 'api/exception line present');
      const j = JSON.parse(errLine);
      assert.strictEqual(j.reqId, 'trace-fail-9999');
      assert.ok(j.err && j.err.includes('synthetic failure'),
        'error stack contains synthetic message');
    });
  } finally {
    server.close();
  }

  console.log(`\n${passed} checks passed`);
  process.exit(0);
})().catch((err) => {
  console.error('FAIL: unexpected', err && err.stack || err);
  process.exit(1);
});