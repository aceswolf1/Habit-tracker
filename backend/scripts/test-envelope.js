#!/usr/bin/env node
/**
 * UB-18 — unit-level proof of the response envelope helpers.
 * No extra npm deps. Mirrors the contract §1 envelope shape.
 * Runnable with: node backend/scripts/test-envelope.js
 */

'use strict';

const assert = require('assert');
const {
  ok,
  created,
  fail,
  internal,
  failValidation,
  failNotFound,
  failFinished,
} = require('../utils/respond');

// Build a fake res object that records the body & status code that would be sent.
function fakeRes() {
  return {
    statusCode: null,
    body: null,
    status(c) {
      this.statusCode = c;
      return this;
    },
    json(b) {
      this.body = b;
      return this;
    },
  };
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

check('ok(res, data) → 200 + { success:true, data }', () => {
  const res = fakeRes();
  ok(res, { uuid: 'c-1' });
  assert.strictEqual(res.statusCode, 200);
  assert.deepStrictEqual(res.body, { success: true, data: { uuid: 'c-1' } });
});

check('ok(res, data, meta) → 200 + { success:true, data, meta }', () => {
  const res = fakeRes();
  ok(res, [1, 2], { total: 5, limit: 10, offset: 0 });
  assert.strictEqual(res.statusCode, 200);
  assert.deepStrictEqual(res.body, {
    success: true,
    data: [1, 2],
    meta: { total: 5, limit: 10, offset: 0 },
  });
});

check('ok(res, data, undefined, 201) → 201 + no meta key', () => {
  const res = fakeRes();
  ok(res, { uuid: 'c-1' }, undefined, 201);
  assert.strictEqual(res.statusCode, 201);
  assert.strictEqual(res.body.meta, undefined);
  assert.deepStrictEqual(res.body, { success: true, data: { uuid: 'c-1' } });
});

check('created(res, data) → 201 + success envelope', () => {
  const res = fakeRes();
  created(res, { uuid: 'c-2' });
  assert.strictEqual(res.statusCode, 201);
  assert.deepStrictEqual(res.body, { success: true, data: { uuid: 'c-2' } });
});

check('fail(res, 400, "VALIDATION_ERROR", msg, details) → envelope', () => {
  const res = fakeRes();
  fail(res, 400, 'VALIDATION_ERROR', 'bad', [{ path: 'name', message: 'required' }]);
  assert.strictEqual(res.statusCode, 400);
  assert.deepStrictEqual(res.body, {
    success: false,
    error: {
      code: 'VALIDATION_ERROR',
      message: 'bad',
      details: [{ path: 'name', message: 'required' }],
    },
  });
});

check('fail(res, 404) without details omits the details key', () => {
  const res = fakeRes();
  fail(res, 404, 'NOT_FOUND', 'missing');
  assert.strictEqual(res.body.error.details, undefined);
});

check('failValidation shortcut → 400 VALIDATION_ERROR', () => {
  const res = fakeRes();
  failValidation(res, [{ path: 'a', message: 'b' }]);
  assert.strictEqual(res.statusCode, 400);
  assert.strictEqual(res.body.error.code, 'VALIDATION_ERROR');
});

check('failNotFound shortcut → 404 NOT_FOUND', () => {
  const res = fakeRes();
  failNotFound(res);
  assert.strictEqual(res.statusCode, 404);
  assert.strictEqual(res.body.error.code, 'NOT_FOUND');
});

check('failFinished shortcut → 409 CYCLE_FINISHED', () => {
  const res = fakeRes();
  failFinished(res);
  assert.strictEqual(res.statusCode, 409);
  assert.strictEqual(res.body.error.code, 'CYCLE_FINISHED');
});

check('internal(res, err) → 500 INTERNAL with generic message; logs to stderr', () => {
  // Silence the console.error from internal() so the test output is clean.
  const origErr = console.error;
  const captured = [];
  console.error = (...args) => captured.push(args);
  try {
    const res = fakeRes();
    internal(res, new Error('secret stack trace'), 'oops');
    assert.strictEqual(res.statusCode, 500);
    assert.strictEqual(res.body.error.code, 'INTERNAL');
    assert.strictEqual(res.body.error.message, 'oops');
    assert.ok(
      captured.length >= 1,
      'internal() should console.error the underlying error'
    );
    assert.ok(
      captured[0].some((a) => String(a).includes('secret stack trace')),
      'console.error should include the underlying error'
    );
    // The client body must NOT include the secret
    assert.ok(
      !JSON.stringify(res.body).includes('secret stack trace'),
      'envelope response must NOT leak underlying error'
    );
  } finally {
    console.error = origErr;
  }
});

check('cycleRoutes.js: wiring-only file (< 40 lines) that does not call envelope helpers directly', () => {
  // W3 contract: routes are wiring only — controller mediates envelope helpers.
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(
    path.join(__dirname, '../routes/cycleRoutes.js'),
    'utf8'
  );
  // Hard cap from layer-contract-w3.md.
  assert.ok(src.split('\n').length < 40,
    `routes/cycleRoutes.js must be < 40 lines (got ${src.split('\n').length})`);
  // The routes file MUST NOT call envelope helpers directly — that's the
  // controller's job (and respond.js exposes them).
  assert.ok(!/require\('\.\.\/utils\/respond'\)/.test(src),
    'cycleRoutes.js must NOT require respond.js (controller mediates)');
  // Routes file must wire the controller, not inline handlers.
  assert.ok(/require\('\.\.\/controllers\/cycleController'\)/.test(src),
    'cycleRoutes.js must require the controller factory');
  assert.ok(/createCycleController\(/.test(src),
    'cycleRoutes.js must instantiate the controller');
  // The old `month:` response key was renamed to `cycle` in W2. The new
  // contract keeps this invariant; assert no regression.
  assert.ok(!/res\.json\(\{[^}]*month:/.test(src),
    'cycleRoutes.js must not contain a `{ month:` literal response');
});

check('server.js mounts /api/cycles and keeps the envelope 404/500 + /readyz contract', () => {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(
    path.join(__dirname, '../server.js'),
    'utf8'
  );
  assert.ok(
    /app\.use\('\/api\/cycles',\s*cycleRoutes\)/.test(src),
    'server.js must mount cycleRoutes at /api/cycles'
  );
  assert.ok(
    !/app\.use\('\/api\/tasks'/.test(src),
    'server.js must NOT mount /api/tasks anymore'
  );
  assert.ok(
    /failNotFound\(/.test(src),
    'server.js must use envelope failNotFound for 404'
  );
  assert.ok(
    /internal\(/.test(src),
    'server.js must use envelope internal() for 500'
  );
  // /readyz is excluded from envelope per contract.
  assert.ok(/\/readyz/.test(src), 'server.js must keep /readyz handler');
  // W3 layer invariant: server.js no longer imports models directly.
  // The only allowed path is via repositories/index for syncIndexes boot.
  assert.ok(
    !/require\('\.\/models\/Cycle'\)/.test(src) &&
      !/require\('\.\/models\/UserProfile'\)/.test(src),
    'server.js must NOT import models directly (use repositories/index)'
  );
});

console.log(`\n${passed} checks passed`);
process.exit(0);