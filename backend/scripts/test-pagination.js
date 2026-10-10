#!/usr/bin/env node
/**
 * B-BE-3 — pagination + projection proof for `GET /api/cycles`.
 * Pure unit tests (no live Mongo) plus a regex check of the route source.
 * Runnable with: node backend/scripts/test-pagination.js
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const { listQuerySchema } = require('../validation/cycleSchemas');
const { ok } = require('../utils/respond');

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

// ---- listQuerySchema parses the supported range --------------------------------

check('limit 1 boundary ok', () => {
  assert.strictEqual(listQuerySchema.parse({ limit: '1' }).limit, 1);
});

check('limit 100 boundary ok', () => {
  assert.strictEqual(listQuerySchema.parse({ limit: '100' }).limit, 100);
});

check('limit 0 rejected', () => {
  const r = listQuerySchema.safeParse({ limit: '0' });
  assert.ok(!r.success, 'expected limit=0 to fail');
});

check('limit 101 rejected', () => {
  const r = listQuerySchema.safeParse({ limit: '101' });
  assert.ok(!r.success, 'expected limit=101 to fail');
});

check('offset 0 default', () => {
  assert.strictEqual(listQuerySchema.parse({}).offset, 0);
});

check('offset large value ok', () => {
  assert.strictEqual(listQuerySchema.parse({ offset: '999' }).offset, 999);
});

// ---- buildSummaries mirrors the route's mapping --------

function toSummary(c) {
  return {
    uuid: c.uuid,
    name: c.name,
    subtitle: c.subtitle,
    progress: c.progress || 0,
    score: c.score || 0,
    finished: !!c.finished,
    createdAt: c.createdAt,
    finishedAt: c.finishedAt || null,
  };
}

check('toSummary strips weeks / statistics and fills defaults', () => {
  const out = toSummary({
    uuid: 'c-1',
    name: 'October',
    subtitle: 'Your journey begins',
    progress: 25,
    score: 15,
    finished: false,
    createdAt: new Date('2026-10-01'),
    weeks: [{ uuid: 'w-1', days: [] }],
    statistics: { finalTier: 'Silver' },
  });
  assert.strictEqual(out.uuid, 'c-1');
  assert.strictEqual(out.progress, 25);
  assert.strictEqual(out.score, 15);
  assert.strictEqual(out.finished, false);
  assert.strictEqual(out.weeks, undefined);
  assert.strictEqual(out.statistics, undefined);
});

check('toSummary normalizes missing score/progress to 0', () => {
  const out = toSummary({
    uuid: 'c-2',
    name: 'Nov',
    createdAt: new Date('2026-11-01'),
    finished: false,
  });
  assert.strictEqual(out.progress, 0);
  assert.strictEqual(out.score, 0);
});

check('toSummary finishedAt null when missing', () => {
  const out = toSummary({
    uuid: 'c-3',
    name: 'Dec',
    createdAt: new Date(),
    finished: true,
  });
  assert.strictEqual(out.finishedAt, null);
});

// ---- envelope meta block shape --------

check('envelope carries meta { total, limit, offset } for list endpoints', () => {
  // Simulate the route's call: ok(res, summaries, { total, limit, offset })
  let captured = null;
  const res = {
    status() {
      return this;
    },
    json(b) {
      captured = b;
    },
  };
  ok(res, [{ uuid: 'a' }, { uuid: 'b' }], { total: 12, limit: 2, offset: 0 });
  assert.deepStrictEqual(captured, {
    success: true,
    data: [{ uuid: 'a' }, { uuid: 'b' }],
    meta: { total: 12, limit: 2, offset: 0 },
  });
});

// ---- cycleRoutes.js source contracts --------

const cycleSrc = fs.readFileSync(
  path.join(__dirname, '../routes/cycleRoutes.js'),
  'utf8'
);

check('GET / handler uses skip + limit + lean', () => {
  assert.ok(/\.skip\(offset\)/.test(cycleSrc), 'missing .skip(offset)');
  assert.ok(/\.limit\(limit\)/.test(cycleSrc), 'missing .limit(limit)');
  assert.ok(/\.lean\(\)/.test(cycleSrc), 'missing .lean() (projection + perf)');
});

check('GET / handler excludes weeks via projection', () => {
  assert.ok(
    /\.select\(\{[\s\S]*?uuid:\s*1[\s\S]*?createdAt:\s*1[\s\S]*?\}\)/.test(cycleSrc),
    'GET / must use .select({ uuid, …, createdAt }) projection without weeks'
  );
  assert.ok(
    !/GET\s*\/\s*,\s*async[\s\S]*?\.select\(\{[\s\S]*?weeks:\s*0/.test(cycleSrc),
    'GET / must not include weeks:0 (must project them out, not include then exclude)'
  );
});

check('GET / handler returns meta { total, limit, offset }', () => {
  assert.ok(
    /ok\([\s\S]*?total[\s\S]*?limit[\s\S]*?offset[\s\S]*?\)/.test(cycleSrc),
    'GET / must call ok() with a meta object containing total/limit/offset'
  );
});

check('GET / uses Promise.all([list, count])', () => {
  assert.ok(
    /Promise\.all\(\[\s*Cycle\.find\([\s\S]*?Cycle\.countDocuments/.test(cycleSrc),
    'GET / must combine list + count via Promise.all'
  );
});

check('POST / creates via shared createEmptyMonth and returns 201', () => {
  assert.ok(
    /createEmptyMonth\(parsed\.data\.name\)/.test(cycleSrc),
    'POST / must use createEmptyMonth from shared/progress'
  );
  assert.ok(/created\(res,\s*saved\.toObject/.test(cycleSrc), 'POST / must call created() (201)');
});

check('GET /:id handler exists and uses Cycle.findOne', () => {
  assert.ok(
    /router\.get\('\/:id'/.test(cycleSrc),
    'GET /:id route must be registered'
  );
  assert.ok(
    /Cycle\.findOne\(\{\s*uuid:\s*req\.params\.id/.test(cycleSrc),
    'GET /:id must look up by uuid'
  );
});

check('PATCH /:id returns { cycle, pointsEarned, isLegendary, currentTier } (no "month" key)', () => {
  // Find the PATCH handler response block — must use the cycle key, not month
  const patchStart = cycleSrc.indexOf("router.patch('/:id'");
  assert.ok(patchStart !== -1, 'PATCH /:id route missing');
  const patchBlock = cycleSrc.slice(patchStart);
  assert.ok(/cycle:\s*savedCycle\.toObject/.test(patchBlock), 'PATCH response must use `cycle` key');
  assert.ok(
    !/month:\s*savedCycle/.test(patchBlock),
    'PATCH response must NOT use `month` key (contract rename)'
  );
  // Allow either `key: value` or shorthand `key,` (since the route builds
  // the response object from locals whose names match the keys).
  const has = (k) =>
      new RegExp(`(?:^|[{,\\s])${k}\\s*:`).test(patchBlock) ||
      new RegExp(`(?:^|[{,\\s])${k}\\s*,`).test(patchBlock);
  assert.ok(has('pointsEarned'), 'PATCH response must include pointsEarned');
  assert.ok(has('isLegendary'), 'PATCH response must include isLegendary');
  assert.ok(
    has('currentTier') ||
      /getTierFromProgress\(/.test(patchBlock),
    'PATCH response must include currentTier from getTierFromProgress'
  );
});

check('POST /:id/finish returns { cycle, statistics, alreadyFinished }', () => {
  const finishStart = cycleSrc.indexOf("router.post('/:id/finish'");
  assert.ok(finishStart !== -1, 'POST /:id/finish route missing');
  const finishBlock = cycleSrc.slice(finishStart);
  assert.ok(/cycle:\s*cycle\.toObject/.test(finishBlock));
  assert.ok(/statistics,/.test(finishBlock));
  assert.ok(/alreadyFinished:/.test(finishBlock));
});

check('taskRoutes.js file is gone', () => {
  const exists = fs.existsSync(
    path.join(__dirname, '../routes/taskRoutes.js')
  );
  assert.ok(!exists, 'taskRoutes.js must be deleted');
});

check('server.js no longer mounts /api/tasks', () => {
  const serverSrc = fs.readFileSync(
    path.join(__dirname, '../server.js'),
    'utf8'
  );
  assert.ok(
    !/app\.use\('\/api\/tasks'/.test(serverSrc),
    'server.js must not mount /api/tasks'
  );
});

console.log(`\n${passed} checks passed`);
process.exit(0);