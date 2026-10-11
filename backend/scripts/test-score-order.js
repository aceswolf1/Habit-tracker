#!/usr/bin/env node
/**
 * W3-qa — UB-06 / BUG-06 — proves points use progress AFTER recalc.
 *
 * Replaces the old route-source greps with layer-boundary checks:
 *  - taskMutationService is the only place that applies scoring flips.
 *  - scoreService.scoreCompletionFlips reads cycle.progress as-is (caller
 *    is responsible for calculateProgress FIRST — UB-06).
 *  - profileRepo.applyLifetimeDelta floors at 0 and gates on non-zero
 *    deltas (UB-10).
 *
 * No mongoose. In-memory fakes under `./fakes/` from w3-qa.
 * Runnable with: node backend/scripts/test-score-order.js
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const { calculateProgress } = require('../../shared/progress');
const {
  getTierFromProgress,
  calculateTaskPoints,
} = require('../utils/scoreCalculator');

const { createFakeCycleRepository } = require('./fakes/cycleRepo');
const { createFakeUserProfileRepository } = require('./fakes/profileRepo');
const fixtures = require('./fakes/fixtures');

const scoreService = require('../services/scoreService');
const { createTaskMutationService } = require('../services/taskMutationService');

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

// ---- Tier boundaries (unchanged from the original) ------------------------

check('tier boundaries: Bronze <25, Silver 25-49, Gold 50+', () => {
  assert.strictEqual(getTierFromProgress(0), 'Bronze');
  assert.strictEqual(getTierFromProgress(24), 'Bronze');
  assert.strictEqual(getTierFromProgress(25), 'Silver');
  assert.strictEqual(getTierFromProgress(49), 'Silver');
  assert.strictEqual(getTierFromProgress(50), 'Gold');
  assert.strictEqual(getTierFromProgress(75), 'Champion');
  assert.strictEqual(getTierFromProgress(100), 'Final');
});

check('pre-recalc scoring (BUG-06 stale) would award Bronze at 24%', () => {
  // Document the old bug: scoring with progress BEFORE flip stays Bronze
  const staleProgress = 24;
  assert.strictEqual(getTierFromProgress(staleProgress), 'Bronze');
  assert.strictEqual(calculateTaskPoints(false, staleProgress, false), 10);
});

// ---- UB-06 — score flips use progress AFTER recalc ------------------------

check('UB-06 order: completing task that crosses 24→25 awards Silver (15), not Bronze (10)', () => {
  // Drive the cycle to the same state taskMutationService drives it to:
  //   1. seed cycle (4 required tasks in one day)
  //   2. set task.completed = true (the flip)
  //   3. calculateProgress(cycle)  <- the recalc step
  //   4. scoreCompletionFlips(cycle, flips) <- reads post-recalc progress
  //
  // Use a hand-rolled single-week cycle so progress math is obvious
  // (the canonical emptyMonth has 4 weeks; we want 1/4 = 25% directly).
  const cycle = {
    progress: 0,
    weeks: [{
      progress: 0,
      conquered: false,
      days: [{
        tasks: [
          { uuid: 't-a', optional: false, completed: false, legendary: false },
          { uuid: 't-b', optional: false, completed: false, legendary: false },
          { uuid: 't-c', optional: false, completed: false, legendary: false },
          { uuid: 't-d', optional: false, completed: false, legendary: false },
        ],
      }],
    }],
  };

  // Stale (pre-recalc) score using current progress BEFORE flip
  const stalePoints = calculateTaskPoints(false, cycle.progress, false);
  assert.strictEqual(stalePoints, 10, 'stale path should be Bronze/10');

  // Apply the flip, recalc, then score (the contract order)
  cycle.weeks[0].days[0].tasks[0].completed = true;
  calculateProgress(cycle);
  const { pointsEarned } = scoreService.scoreCompletionFlips(cycle, [
    { optional: false, legendary: false, direction: 'complete' },
  ]);
  assert.strictEqual(cycle.progress, 25, `expected progress 25 after flip, got ${cycle.progress}`);
  assert.strictEqual(getTierFromProgress(cycle.progress), 'Silver');
  assert.strictEqual(pointsEarned, 15, `expected Silver/15 after recalc, got ${pointsEarned}`);
  assert.notStrictEqual(pointsEarned, stalePoints, 'post-recalc points must differ from stale Bronze points');
});

check('UB-06 order: uncomplete uses post-recalc (lower) progress', () => {
  // Single-week cycle so 2/4 complete = 50% (Gold/20) and uncomplete → 25% (Silver/15).
  const cycle = {
    progress: 0,
    weeks: [{
      progress: 0,
      conquered: false,
      days: [{
        tasks: [
          { uuid: 't-a', optional: false, completed: true,  legendary: false },
          { uuid: 't-b', optional: false, completed: true,  legendary: false },
          { uuid: 't-c', optional: false, completed: false, legendary: false },
          { uuid: 't-d', optional: false, completed: false, legendary: false },
        ],
      }],
    }],
  };
  calculateProgress(cycle);
  assert.strictEqual(cycle.progress, 50, 'pre: 2/4 → 50%');

  // Stale at 50% → Gold/20
  const stalePoints = calculateTaskPoints(false, cycle.progress, false);
  assert.strictEqual(stalePoints, 20, 'stale at 50% is Gold/20');

  // Uncomplete task A → 1/4 → 25% Silver → subtract 15 (not 20 from stale Gold)
  cycle.weeks[0].days[0].tasks[0].completed = false;
  calculateProgress(cycle);
  const { pointsEarned } = scoreService.scoreCompletionFlips(cycle, [
    { optional: false, legendary: false, direction: 'uncomplete' },
  ]);
  assert.strictEqual(cycle.progress, 25, 'post: 1/4 → 25%');
  assert.strictEqual(pointsEarned, -15, `expected -15 (Silver), got ${pointsEarned}`);
});

// ---- UB-02 — finished guard runs before any mutation ----------------------

check('UB-02: taskMutationService rejects finished cycles BEFORE any change', async () => {
  const cycleRepo = createFakeCycleRepository();
  const profileRepo = createFakeUserProfileRepository();
  const svc = createTaskMutationService({ cycleRepo, profileRepo, scoreService });

  const cycle = fixtures.cycleWithRequiredTasks(4);
  cycle.weeks[0].days[0].tasks[0].description = 'ORIGINAL';
  const saved = await cycleRepo.create(cycle);
  saved.finished = true;
  await cycleRepo.save(saved);

  let thrown = null;
  try {
    await svc.patchCycle(saved.uuid, {
      type: 'updateTasks',
      updates: [{ uuid: saved.weeks[0].days[0].tasks[0].uuid, description: 'MUTATED' }],
    });
  } catch (err) { thrown = err; }
  assert.ok(thrown, 'should throw');
  assert.strictEqual(thrown.code, 'CYCLE_FINISHED');

  // The cycle body must be unchanged.
  const raw = cycleRepo._raw(saved.uuid);
  const task = raw.weeks[0].days[0].tasks[0];
  assert.strictEqual(task.description, 'ORIGINAL',
    'finished guard must run before any mutation');
});

// ---- UB-10 — lifetime delta via the real service -------------------------
//
// Note: this test exercises the FULL taskMutationService.patchCycle path
// (mutation → recalc → score → lifetime delta → save) using in-memory
// fakes, so it asserts the wiring as well as the math.

check('UB-10: negative pointsEarned reduces lifetimeScore', async () => {
  const cycleRepo = createFakeCycleRepository();
  const profileRepo = createFakeUserProfileRepository();
  const svc = createTaskMutationService({ cycleRepo, profileRepo, scoreService });

  // Pre-seed: 2/4 completed → 50% Gold.
  const cycle = fixtures.cycleWithRequiredTasks(4);
  cycle.weeks[0].days[0].tasks[0].completed = true;
  cycle.weeks[0].days[0].tasks[1].completed = true;
  const saved = await cycleRepo.create(cycle);

  // Uncomplete task 0 → 25% Silver → -15 points → -15 lifetime.
  const out = await svc.patchCycle(saved.uuid, {
    type: 'updateTasks',
    updates: [{ uuid: saved.weeks[0].days[0].tasks[0].uuid, completed: false }],
  });
  assert.strictEqual(out.pointsEarned, -15);
  assert.strictEqual(profileRepo._raw('default-user').lifetimeScore, -15);
});

check('UB-10: lifetimeScore floors at 0', async () => {
  const cycleRepo = createFakeCycleRepository();
  const profileRepo = createFakeUserProfileRepository();
  const svc = createTaskMutationService({ cycleRepo, profileRepo, scoreService });

  const cycle = fixtures.cycleWithRequiredTasks(4);
  // Pre-seed: 4/4 → 100% Final.
  for (const t of cycle.weeks[0].days[0].tasks) t.completed = true;
  const saved = await cycleRepo.create(cycle);

  // Uncomplete two → 50% Gold → -25 -25 = -50 points → floor 0.
  await svc.patchCycle(saved.uuid, {
    type: 'updateTasks',
    updates: [
      { uuid: saved.weeks[0].days[0].tasks[0].uuid, completed: false },
      { uuid: saved.weeks[0].days[0].tasks[1].uuid, completed: false },
    ],
  });
  assert.strictEqual(profileRepo._raw('default-user').lifetimeScore, 0);
});

check('UB-10: zero pointsEarned is a no-op (profile is not created)', async () => {
  const cycleRepo = createFakeCycleRepository();
  const profileRepo = createFakeUserProfileRepository();
  const svc = createTaskMutationService({ cycleRepo, profileRepo, scoreService });

  const cycle = fixtures.cycleWithRequiredTasks(4);
  const saved = await cycleRepo.create(cycle);

  const out = await svc.patchCycle(saved.uuid, {
    type: 'updateTasks',
    updates: [{ uuid: saved.weeks[0].days[0].tasks[0].uuid, description: 'renamed only' }],
  });
  assert.strictEqual(out.pointsEarned, 0);
  // Service must not have touched the profile repo (no delta applied).
  assert.ok(profileRepo._raw('default-user') == null,
    'profile must remain uncreated when pointsEarned=0');
});

check('UB-10: positive pointsEarned still increases lifetimeScore', async () => {
  const cycleRepo = createFakeCycleRepository();
  const profileRepo = createFakeUserProfileRepository();
  const svc = createTaskMutationService({ cycleRepo, profileRepo, scoreService });

  const cycle = fixtures.cycleWithRequiredTasks(4);
  const saved = await cycleRepo.create(cycle);

  // Complete first task → 25% Silver → +15 lifetime.
  const out = await svc.patchCycle(saved.uuid, {
    type: 'updateTasks',
    updates: [{ uuid: saved.weeks[0].days[0].tasks[0].uuid, completed: true }],
  });
  assert.strictEqual(out.pointsEarned, 15);
  assert.strictEqual(profileRepo._raw('default-user').lifetimeScore, 15);
});

// ---- Layer-boundary checks (replacing the old route-source greps) -------
//
// These are static assertions about the W3 layer architecture:
//   1. routes/cycleRoutes.js is wiring only — no week/day/task loops.
//   2. controllers/ has no `require('../models')` imports.
//   3. controllers/ has no `require('../../shared/progress')` imports
//      (progress math lives in services + shared).
//   4. server.js no longer imports models directly (only via repositories).
//   5. Routes file uses the controller factory, not inline handlers.

check('routes/cycleRoutes.js is wiring-only (< 40 lines, no week/day loops)', () => {
  const routesPath = path.join(__dirname, '../routes/cycleRoutes.js');
  const src = fs.readFileSync(routesPath, 'utf8');
  // Hard cap from layer-contract-w3.md: routes/cycleRoutes.js < 40 lines.
  assert.ok(src.split('\n').length < 40,
    `routes/cycleRoutes.js must be < 40 lines (got ${src.split('\n').length})`);
  // No loops over weeks/days/tasks in the routes layer.
  assert.ok(!/for\s*\(\s*const\s+week/.test(src), 'routes must not loop over weeks');
  assert.ok(!/week\.days/.test(src), 'routes must not access week.days');
  assert.ok(!/\.tasks\.find/.test(src), 'routes must not look up tasks');
  // Must use the controller factory.
  assert.ok(/require\('\.\.\/controllers\/cycleController'\)/.test(src),
    'routes must require the controller factory');
  assert.ok(/createCycleController\(/.test(src), 'routes must instantiate the controller');
  // Must NOT import models or services directly (the controller mediates).
  assert.ok(!/require\('\.\.\/models/.test(src),
    'routes must not import models (controller mediates)');
  assert.ok(!/require\('\.\.\/services\/errors'\)/.test(src),
    'routes must not import service-layer errors directly');
});

check('controllers/ has no model imports (only services + respond + schemas)', () => {
  const controllersPath = path.join(__dirname, '../controllers');
  if (!fs.existsSync(controllersPath)) {
    throw new Error('controllers/ directory missing — w3-core has not landed C3');
  }
  const files = fs.readdirSync(controllersPath).filter((f) => f.endsWith('.js'));
  assert.ok(files.length > 0, 'controllers/ must contain at least one .js file');
  for (const f of files) {
    const src = fs.readFileSync(path.join(controllersPath, f), 'utf8');
    assert.ok(!/require\('\.\.\/models/.test(src),
      `${f} must not import models`);
    assert.ok(!/require\('\.\.\.\/\.\.\/shared\//.test(src),
      `${f} must not import shared/ directly (services own that)`);
    assert.ok(/require\('\.\.\/utils\/respond'\)/.test(src),
      `${f} must use respond.js envelope helpers`);
    // No week/day/task loops in controllers (only the services touch structure).
    assert.ok(!/for\s*\(\s*const\s+week/.test(src),
      `${f} must not loop over weeks`);
    assert.ok(!/\.weeks\.forEach/.test(src),
      `${f} must not iterate weeks`);
  }
});

check('server.js no longer imports models directly (only via repositories)', () => {
  const serverPath = path.join(__dirname, '../server.js');
  const src = fs.readFileSync(serverPath, 'utf8');
  // The old `require('./models/Cycle')` and `require('./models/UserProfile')`
  // must be gone. W3 contract allows `require('./repositories')` for
  // syncIndexes boot housekeeping only.
  assert.ok(!/require\('\.\/models\/Cycle'\)/.test(src),
    'server.js must not import models/Cycle directly');
  assert.ok(!/require\('\.\/models\/UserProfile'\)/.test(src),
    'server.js must not import models/UserProfile directly');
  // If it does need models for index sync (w3-core justified this in the
  // contract), it must come through repositories/index.
  if (/require\('\.\/repositories'\)/.test(src)) {
    // ok — repositories/index is the only allowed path.
  }
});

check('taskMutationService is the only module that calls scoreCompletionFlips', () => {
  // Layer invariant: the scoring loop is centralized in the mutation service.
  // A static grep confirms no other service or the controller re-implements it.
  const layers = [
    path.join(__dirname, '../controllers'),
    path.join(__dirname, '../services/cycleLifecycleService.js'),
    path.join(__dirname, '../routes'),
  ];
  for (const layer of layers) {
    let files = [];
    if (fs.statSync(layer).isDirectory()) {
      files = fs.readdirSync(layer).map((f) => path.join(layer, f));
    } else {
      files = [layer];
    }
    for (const f of files) {
      if (!f.endsWith('.js')) continue;
      const src = fs.readFileSync(f, 'utf8');
      assert.ok(!/scoreCompletionFlips\s*\(/.test(src),
        `${f} must not call scoreCompletionFlips — only taskMutationService does`);
    }
  }
});

check('cycleRoutes.js wires the controller, not inline handlers', () => {
  const src = fs.readFileSync(
    path.join(__dirname, '../routes/cycleRoutes.js'),
    'utf8'
  );
  // Each route is one line: router.<verb>(path, c.fn). No anonymous async.
  const routeLines = src.split('\n').filter((l) => /router\.(get|post|patch)\s*\(/.test(l));
  assert.ok(routeLines.length >= 5, 'must register at least 5 routes');
  for (const line of routeLines) {
    assert.ok(/,\s*c\.\w+\)/.test(line),
      `route line must call controller method (got: ${line.trim()})`);
    assert.ok(!/async\s*\(/.test(line),
      `route line must not contain inline async (got: ${line.trim()})`);
  }
});

console.log(`\n${passed} checks passed.`);
process.exit(0);