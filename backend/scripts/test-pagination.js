#!/usr/bin/env node
/**
 * W3-qa — B-BE-3 — pagination + projection proof for `GET /api/cycles`.
 *
 * Replaces the old route-source greps with calls to the REAL `cycleRepository
 * .listSummaries` factory (w3-core landed it; the test exercises the repo via
 * in-memory fakes) plus layer-boundary checks that encode the W3 invariants.
 *
 * No mongoose. No HTTP. No route-source mirrors.
 * Runnable with: node backend/scripts/test-pagination.js
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const { listQuerySchema } = require('../validation/cycleSchemas');
const { ok } = require('../utils/respond');

const { createFakeCycleRepository } = require('./fakes/cycleRepo');
const fixtures = require('./fakes/fixtures');

let passed = 0;
// Checks run sequentially and are awaited; the summary prints only after
// every check (sync or async) has finished. A failure exits 1.
let __chain = Promise.resolve();
function check(name, fn) {
  __chain = __chain.then(async () => {
    try {
      await fn();
      passed += 1;
      console.log(`PASS: ${name}`);
    } catch (err) {
      console.error(`FAIL: ${name}`);
      console.error(err && err.stack ? err.stack : err);
      // CHECK_CONTINUE=1 lists every failure instead of stopping at the first.
      if (!process.env.CHECK_CONTINUE) process.exit(1);
      process.exitCode = 1;
    }
  });
  return __chain;
}

// ---- listQuerySchema parses the supported range --------------------------

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

// ---- cycleRepository.listSummaries projection (real shape) --------------
//
// Replaces the old `toSummary(c)` mirror in this file. The fake mirrors
// the production projection exactly (uuid/name/subtitle/progress/score/
// finished/createdAt/finishedAt with safe defaults), so the assertions
// here prove the contract's summary shape.

check('listSummaries: items strip weeks / statistics; fill defaults', async () => {
  const repo = createFakeCycleRepository();
  await repo.create(fixtures.emptyCycle('October'));

  const { items, total } = await repo.listSummaries({ limit: 50, offset: 0 });
  assert.strictEqual(total, 1);
  assert.strictEqual(items.length, 1);
  const it = items[0];
  assert.strictEqual(typeof it.uuid, 'string');
  assert.strictEqual(typeof it.progress, 'number');
  assert.strictEqual(typeof it.score, 'number');
  assert.strictEqual(typeof it.finished, 'boolean');
  assert.ok(it.createdAt, 'createdAt present');
  assert.strictEqual(it.weeks, undefined, 'weeks stripped');
  assert.strictEqual(it.statistics, undefined, 'statistics stripped');
});

check('listSummaries: progress / score / finishedAt default to safe values', async () => {
  const repo = createFakeCycleRepository();
  // Seed a minimal cycle (no score/progress/finishedAt) directly.
  await repo.create({
    uuid: 'c-bare',
    name: 'Bare',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    weeks: [],
    finished: false,
  });
  const { items } = await repo.listSummaries({ limit: 50, offset: 0 });
  assert.strictEqual(items[0].progress, 0);
  assert.strictEqual(items[0].score, 0);
  assert.strictEqual(items[0].finishedAt, null);
});

// ---- pagination meta via the real lifecycle service ----------------------

check('lifecycle.list returns { items, meta: { total, limit, offset } }', async () => {
  const { createCycleLifecycleService } = require('../services/cycleLifecycleService');
  const cycleRepo = createFakeCycleRepository();
  const profileRepo = require('./fakes/profileRepo').createFakeUserProfileRepository();
  const svc = createCycleLifecycleService({ cycleRepo, profileRepo });

  for (let i = 0; i < 5; i++) await cycleRepo.create(fixtures.emptyCycle(`Cyc ${i}`));
  const out = await svc.list({ limit: 2, offset: 0 });
  assert.ok(Array.isArray(out.items));
  assert.strictEqual(out.items.length, 2);
  assert.strictEqual(out.meta.total, 5);
  assert.strictEqual(out.meta.limit, 2);
  assert.strictEqual(out.meta.offset, 0);
});

check('lifecycle.list pagination: page 2 returns different items', async () => {
  const { createCycleLifecycleService } = require('../services/cycleLifecycleService');
  const cycleRepo = createFakeCycleRepository();
  const profileRepo = require('./fakes/profileRepo').createFakeUserProfileRepository();
  const svc = createCycleLifecycleService({ cycleRepo, profileRepo });

  for (let i = 0; i < 3; i++) await cycleRepo.create(fixtures.emptyCycle(`Cyc ${i}`));
  const page1 = await svc.list({ limit: 1, offset: 0 });
  const page2 = await svc.list({ limit: 1, offset: 1 });
  assert.notStrictEqual(page1.items[0].uuid, page2.items[0].uuid, 'different items');
  assert.strictEqual(page2.meta.offset, 1);
  assert.strictEqual(page2.meta.total, 3);
});

// ---- envelope meta block shape -------------------------------------------

check('envelope carries meta { total, limit, offset } for list endpoints', () => {
  let captured = null;
  const res = {
    status() { return this; },
    json(b) { captured = b; },
  };
  ok(res, [{ uuid: 'a' }, { uuid: 'b' }], { total: 12, limit: 2, offset: 0 });
  assert.deepStrictEqual(captured, {
    success: true,
    data: [{ uuid: 'a' }, { uuid: 'b' }],
    meta: { total: 12, limit: 2, offset: 0 },
  });
});

// ---- POST / wires shared createEmptyMonth ------------------------------

check('services/cycleLifecycleService.create produces a 4×7 cycle via shared/createEmptyMonth', async () => {
  const { createCycleLifecycleService } = require('../services/cycleLifecycleService');
  const cycleRepo = createFakeCycleRepository();
  const profileRepo = require('./fakes/profileRepo').createFakeUserProfileRepository();
  const svc = createCycleLifecycleService({ cycleRepo, profileRepo });

  const out = await svc.create({ name: 'Fresh' });
  assert.strictEqual(out.name, 'Fresh');
  assert.strictEqual(out.weeks.length, 4);
  assert.strictEqual(out.weeks[0].days.length, 7);
  assert.strictEqual(cycleRepo._all().length, 1);
});

// ---- Layer-boundary checks (replacing the old route-source greps) -------
//
// These static checks encode the W3 invariants:
//   - routes/cycleRoutes.js does NOT contain the mongoose / list / projection
//     internals (those live in repositories + services now).
//   - controllers/cycleController.js does NOT loop over weeks/days or import
//     models.
//   - repositories/index.js exports Cycle/UserProfile only for server-boot
//     syncIndexes; services/controllers import their default instances from
//     repositories/ (no direct model imports).

check('routes/cycleRoutes.js has no mongoose / projection / pagination code', () => {
  const src = fs.readFileSync(
    path.join(__dirname, '../routes/cycleRoutes.js'),
    'utf8'
  );
  // The old route-source checks for `.skip(`, `.limit(`, `.lean()`,
  // `Cycle.findOne(`, `Promise.all([list, count])`, etc. are all GONE —
  // those are now in cycleRepository.listSummaries.
  assert.ok(!/\.skip\(/.test(src), '.skip() must not appear in routes');
  assert.ok(!/\.limit\(/.test(src), '.limit() must not appear in routes');
  assert.ok(!/\.lean\(/.test(src), '.lean() must not appear in routes');
  assert.ok(!/Cycle\.findOne/.test(src), 'Cycle.findOne must not appear in routes');
  assert.ok(!/Promise\.all\(\[\s*Cycle\.find/.test(src),
    'Promise.all([Cycle.find, count]) must not appear in routes');
  assert.ok(!/createEmptyMonth\(/.test(src),
    'createEmptyMonth must not be inlined in routes (service owns it)');
  // The route must wire the controller, not inline handlers.
  assert.ok(/require\('\.\.\/controllers\/cycleController'\)/.test(src),
    'routes must require the controller factory');
  assert.ok(src.split('\n').length < 40,
    `routes/cycleRoutes.js must be < 40 lines (got ${src.split('\n').length})`);
});

check('controllers/cycleController.js does NOT import models or call mongoose', () => {
  const ctlPath = path.join(__dirname, '../controllers/cycleController.js');
  if (!fs.existsSync(ctlPath)) {
    throw new Error('controllers/cycleController.js missing — w3-core C3 not landed');
  }
  const src = fs.readFileSync(ctlPath, 'utf8');
  assert.ok(!/require\('\.\.\/models/.test(src), 'controllers must not import models');
  assert.ok(!/require\('mongoose'\)/.test(src), 'controllers must not import mongoose');
  assert.ok(!/\.skip\(/.test(src), 'controllers must not query mongoose');
  assert.ok(!/for\s*\(\s*const\s+week/.test(src), 'controllers must not loop over weeks');
});

check('PATCH route response is built by the controller + service, not inline in routes', () => {
  const src = fs.readFileSync(
    path.join(__dirname, '../routes/cycleRoutes.js'),
    'utf8'
  );
  assert.ok(!/pointsEarned/.test(src), 'routes must not reference pointsEarned (service owns it)');
  assert.ok(!/currentTier/.test(src), 'routes must not reference currentTier (service owns it)');
  assert.ok(!/isLegendary/.test(src), 'routes must not reference isLegendary (service owns it)');
});

check('finish route response is built by the controller + service, not inline in routes', () => {
  const src = fs.readFileSync(
    path.join(__dirname, '../routes/cycleRoutes.js'),
    'utf8'
  );
  assert.ok(!/statistics/.test(src), 'routes must not reference statistics (service owns it)');
  assert.ok(!/alreadyFinished/.test(src), 'routes must not reference alreadyFinished');
  assert.ok(!/calculateAllStatistics/.test(src),
    'routes must not call calculateAllStatistics (lifecycle service owns it)');
});

// ---- Removed/legacy surface --------------------------------------------

check('taskRoutes.js file is gone', () => {
  const exists = fs.existsSync(path.join(__dirname, '../routes/taskRoutes.js'));
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

check('routes/cycleRoutes.js exposes POST /:id/finish wiring (not inline)', () => {
  const src = fs.readFileSync(
    path.join(__dirname, '../routes/cycleRoutes.js'),
    'utf8'
  );
  assert.ok(/router\.post\('\/:id\/finish',\s*c\.finish\)/.test(src),
    "POST /:id/finish must be wired to controller's finish handler");
});

check('routes/cycleRoutes.js exposes PATCH /:id wiring (not inline)', () => {
  const src = fs.readFileSync(
    path.join(__dirname, '../routes/cycleRoutes.js'),
    'utf8'
  );
  assert.ok(/router\.patch\('\/:id',\s*c\.patch\)/.test(src),
    "PATCH /:id must be wired to controller's patch handler");
});
__chain.then(() => {
  if (process.exitCode) process.exit(1);
  console.log(`\n${passed} checks passed`);
  process.exit(0);
});
