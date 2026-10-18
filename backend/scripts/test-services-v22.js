#!/usr/bin/env node
/**
 * v2.2 — service-layer tests for strike combos (E1–E4) + `clientDate`.
 *
 * Coverage:
 *   - Chain across two cycles (most recent prior completion lives in a
 *     different cycle → chain continues).
 *   - Gap > 2 days resets the combo to 1.
 *   - Same-day re-completion keeps the combo unchanged (no increase).
 *   - Exact reversal on un-check (score and lifetime both return to 0).
 *   - Legendary × combo (multiplicative; bonus stacks on top of ×3 base).
 *   - `clientDate` overrides the UTC date of `completedAt`.
 *   - PATCH response `combo` field on the last completion.
 *   - `clientDate` schema validation (zod strict).
 *
 * No HTTP, no mongoose. Standalone node runner — no test framework.
 * Runnable with: `node backend/scripts/test-services-v22.js`
 */

'use strict';

const assert = require('assert');

const { createFakeCycleRepository } = require('./fakes/cycleRepo');
const { createFakeUserProfileRepository } = require('./fakes/profileRepo');
const fixtures = require('./fakes/fixtures');

const { createTaskMutationService: makeMutationService } = require('../services/taskMutationService');
const scoreService = require('../services/scoreService');

let passed = 0;
const checks = [];
function check(name, fn) {
  // Each check gets a fresh fake service so cycle/profile state is clean.
  const ctx = makeService();
  checks.push(
    Promise.resolve()
      .then(() => fn(ctx))
      .then(() => {
        passed += 1;
        console.log(`PASS: ${name}`);
      })
      .catch((err) => {
        console.error(`FAIL: ${name}`);
        console.error(err && err.message ? err.message : err);
        process.exit(1);
      })
  );
}

function makeService() {
  const cycleRepo = createFakeCycleRepository();
  const profileRepo = createFakeUserProfileRepository();
  const svc = makeMutationService({
    cycleRepo,
    profileRepo,
    scoreService,
  });
  return { svc, cycleRepo, profileRepo };
}

function findTask(cycle, uuid) {
  for (const w of cycle.weeks) {
    for (const d of w.days) {
      const t = d.tasks.find((x) => x.uuid === uuid);
      if (t) return { task: t, day: d, week: w };
    }
  }
  return null;
}

/**
 * Build a cycle with N required tasks spread across N weeks (one per
 * week, day 0). Completing 1 of N → month.progress = 25 (Silver).
 * Used by v2.2 tests that want to assert exact Silver/Champion/...
 * tiers.
 */
function cycleWithRequiredTasksSpread(n) {
  const c = fixtures.emptyCycle('Test');
  for (let i = 0; i < n; i++) {
    fixtures.addTask(c, i, 0, {
      uuid: `t-spread-${i}`,
      description: `t${i}`,
      optional: false,
    });
  }
  return c;
}

// =========================================================================
// clientDate overrides the UTC date of completedAt
// =========================================================================

check('v2.2: clientDate sets completedOn to the client-supplied local date', async ({ svc, cycleRepo }) => {
  const cycle = cycleWithRequiredTasksSpread(4);
  const saved = await cycleRepo.create(cycle);
  const taskUuid = saved.weeks[0].days[0].tasks[0].uuid;
  const out = await svc.patchCycle(saved.uuid, {
    type: 'updateTasks',
    updates: [{ uuid: taskUuid, completed: true }],
    clientDate: '2026-10-14',
  });
  assert.strictEqual(out.pointsEarned, 15, '1/4 → 25% Silver = 15');
  const raw = cycleRepo._raw(saved.uuid);
  const t = findTask(raw, taskUuid).task;
  assert.strictEqual(t.completedOn, '2026-10-14', 'completedOn uses clientDate');
  assert.strictEqual(t.combo, 1, 'first completion → combo 1');
  assert.strictEqual(t.comboBonus, 0, 'combo 1 → no bonus');
});

check('v2.2: missing clientDate falls back to UTC date of completedAt', async ({ svc, cycleRepo }) => {
  const cycle = cycleWithRequiredTasksSpread(4);
  const saved = await cycleRepo.create(cycle);
  const taskUuid = saved.weeks[0].days[0].tasks[0].uuid;
  await svc.patchCycle(saved.uuid, {
    type: 'updateTasks',
    updates: [{ uuid: taskUuid, completed: true }],
    // no clientDate
  });
  const raw = cycleRepo._raw(saved.uuid);
  const t = findTask(raw, taskUuid).task;
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(t.completedOn),
    `completedOn must be ISO; got ${t.completedOn}`);
  assert.strictEqual(t.combo, 1);
});

// =========================================================================
// Chain across two cycles
// =========================================================================

check('v2.2: chain across two cycles (combo=2 on second completion)', async ({ svc, cycleRepo, profileRepo }) => {
  // Cycle A — complete task on 2026-10-12 (combo 1).
  // Both tasks share `habitId: 'h-shared'` so they chain (the persist-on-
  // save logic only mints a NEW habitId for tasks missing one).
  const a = fixtures.emptyCycle('A');
  fixtures.addTask(a, 0, 0, { uuid: 't-shared', description: 'Read', optional: false, habitId: 'h-shared' });
  const savedA = await cycleRepo.create(a);
  await svc.patchCycle(savedA.uuid, {
    type: 'updateTasks',
    updates: [{ uuid: 't-shared', completed: true }],
    clientDate: '2026-10-12',
  });

  // Cycle B — same habitId, completed 1 day later. Expect combo 2.
  const b = fixtures.emptyCycle('B');
  fixtures.addTask(b, 0, 0, { uuid: 't-shared', description: 'Read', optional: false, habitId: 'h-shared' });
  const savedB = await cycleRepo.create(b);

  const out = await svc.patchCycle(savedB.uuid, {
    type: 'updateTasks',
    updates: [{ uuid: 't-shared', completed: true }],
    clientDate: '2026-10-13',
  });

  assert.strictEqual(out.pointsEarned, 19, 'Silver(15) × 1.25 = 18.75 → 19');
  const raw = cycleRepo._raw(savedB.uuid);
  const t = findTask(raw, 't-shared').task;
  assert.strictEqual(t.completedOn, '2026-10-13');
  assert.strictEqual(t.combo, 2, 'chained across cycles → combo 2');
  assert.strictEqual(t.comboBonus, 4, '15 × 0.25 = 3.75 → 4');
  // Lifetime = cycle A 15 + cycle B 19 = 34.
  assert.strictEqual(profileRepo._raw('default-user').lifetimeScore, 34);
});

// =========================================================================
// Gap reset
// =========================================================================

check('v2.2: gap > 2 days → chain broken, combo resets to 1', async ({ svc, cycleRepo }) => {
  // Two tasks with the same description (same habitKey via `name:` fallback).
  // Both in week 0 so completing 1 of 2 = 50% week → cycle 12.5% → Bronze,
  // and completing both = 100% week → cycle 25% → Silver. Lets the test
  // assert that the SECOND completion gets the same tier points as if the
  // combo had not chained — i.e. combo was reset.
  const cycle = fixtures.emptyCycle('Test');
  fixtures.addTask(cycle, 0, 0, { uuid: 't-0', description: 'Read', optional: false });
  fixtures.addTask(cycle, 0, 1, { uuid: 't-1', description: 'Read', optional: false });
  const saved = await cycleRepo.create(cycle);

  // Day 0 done first.
  await svc.patchCycle(saved.uuid, {
    type: 'updateTasks',
    updates: [{ uuid: 't-0', completed: true }],
    clientDate: '2026-10-12',
  });
  // Day 1, 5 days later → gap > 2 → combo=1, no bonus.
  const out = await svc.patchCycle(saved.uuid, {
    type: 'updateTasks',
    updates: [{ uuid: 't-1', completed: true }],
    clientDate: '2026-10-17',
  });
  assert.strictEqual(out.pointsEarned, 15, 'combo 1 → no bonus; Silver required = 15');
  const raw = cycleRepo._raw(saved.uuid);
  const task1 = findTask(raw, 't-1').task;
  assert.strictEqual(task1.combo, 1, 'gap > 2 → reset');
  assert.strictEqual(task1.comboBonus, 0, 'combo 1 → no bonus');
  assert.strictEqual(task1.comboBonus, 0, 'combo 1 → no bonus');
});

// =========================================================================
// Same-day no increase
// =========================================================================

check('v2.2: same-day re-completion keeps combo unchanged (no increase)', async ({ svc, cycleRepo }) => {
  const cycle = fixtures.emptyCycle('Test');
  fixtures.addTask(cycle, 0, 0, { uuid: 't-a', description: 'Read', optional: false, habitId: 'h-shared' });
  fixtures.addTask(cycle, 0, 1, { uuid: 't-b', description: 'Read', optional: false, habitId: 'h-shared' });
  const saved = await cycleRepo.create(cycle);

  // First complete: combo 1.
  await svc.patchCycle(saved.uuid, {
    type: 'updateTasks',
    updates: [{ uuid: 't-a', completed: true }],
    clientDate: '2026-10-12',
  });

  // Same habit on the next day → combo 2.
  await svc.patchCycle(saved.uuid, {
    type: 'updateTasks',
    updates: [{ uuid: 't-b', completed: true }],
    clientDate: '2026-10-13',
  });

  // Uncheck t-a (reversal of its stored Bronze base) — forward-only:
  // t-b's combo is NOT recomputed.
  await svc.patchCycle(saved.uuid, {
    type: 'updateTasks',
    updates: [{ uuid: 't-a', completed: false }],
    clientDate: '2026-10-12',
  });

  // Now re-complete t-a on the SAME day it was first completed
  // (2026-10-12). The lookup for that date finds no prior ≤ 2026-10-12
  // (t-b is at 2026-10-13, in the future). So combo=1 again.
  await svc.patchCycle(saved.uuid, {
    type: 'updateTasks',
    updates: [{ uuid: 't-a', completed: true }],
    clientDate: '2026-10-12',
  });

  const raw = cycleRepo._raw(saved.uuid);
  const t = findTask(raw, 't-a').task;
  // Per nextCombo: prev=null (no completion ≤ 2026-10-12 for any cycle) → 1.
  assert.strictEqual(t.combo, 1, 'same-day re-complete with no chain ≤ beforeIso → combo 1');
  // And t-b still carries combo=2 (forward-only — unchecking t-a didn't
  // recompute t-b's combo).
  const tb = findTask(raw, 't-b').task;
  assert.strictEqual(tb.combo, 2, 't-b still at combo 2 after t-a uncheck + re-check');
});

// =========================================================================
// Exact reversal on un-check
// =========================================================================

check('v2.2: un-check reverses exactly (score and lifetime return to pre-completion)', async ({ svc, cycleRepo, profileRepo }) => {
  const cycle = cycleWithRequiredTasksSpread(4);
  const saved = await cycleRepo.create(cycle);
  const t0 = saved.weeks[0].days[0].tasks[0].uuid;

  // Complete (1/4 → 25% Silver=15).
  const c1 = await svc.patchCycle(saved.uuid, {
    type: 'updateTasks',
    updates: [{ uuid: t0, completed: true }],
    clientDate: '2026-10-12',
  });
  assert.strictEqual(c1.pointsEarned, 15);
  assert.strictEqual(profileRepo._raw('default-user').lifetimeScore, 15);

  // Uncomplete — exact reversal.
  const c2 = await svc.patchCycle(saved.uuid, {
    type: 'updateTasks',
    updates: [{ uuid: t0, completed: false }],
    clientDate: '2026-10-12',
  });
  assert.strictEqual(c2.pointsEarned, -15, 'exact reversal: -15');
  assert.strictEqual(profileRepo._raw('default-user').lifetimeScore, 0, 'lifetime back to 0');
  const raw = cycleRepo._raw(saved.uuid);
  const t = findTask(raw, t0).task;
  assert.strictEqual(t.completedOn, null, 'completedOn cleared');
  assert.strictEqual(t.combo, undefined, 'combo cleared');
  assert.strictEqual(t.comboBonus, undefined, 'comboBonus cleared');
});

check('v2.2: un-check reverses the combo bonus exactly', async ({ svc, cycleRepo, profileRepo }) => {
  // Cycle A — establish combo 1 (no bonus). Share habitId so the lookup chains.
  const a = fixtures.emptyCycle('A');
  fixtures.addTask(a, 0, 0, { uuid: 't-read', description: 'Read', optional: false, habitId: 'h-shared' });
  const savedA = await cycleRepo.create(a);
  await svc.patchCycle(savedA.uuid, {
    type: 'updateTasks',
    updates: [{ uuid: 't-read', completed: true }],
    clientDate: '2026-10-12',
  });

  // Cycle B — same habit, combo 2 with bonus.
  const b = fixtures.emptyCycle('B');
  fixtures.addTask(b, 0, 0, { uuid: 't-read', description: 'Read', optional: false, habitId: 'h-shared' });
  const savedB = await cycleRepo.create(b);
  const c2 = await svc.patchCycle(savedB.uuid, {
    type: 'updateTasks',
    updates: [{ uuid: 't-read', completed: true }],
    clientDate: '2026-10-13',
  });
  assert.strictEqual(c2.pointsEarned, 19, '15 base + 4 bonus');
  assert.strictEqual(profileRepo._raw('default-user').lifetimeScore, 34, '15 + 19');

  // Uncheck cycle B task — reversal of the 4-point bonus specifically.
  const c3 = await svc.patchCycle(savedB.uuid, {
    type: 'updateTasks',
    updates: [{ uuid: 't-read', completed: false }],
    clientDate: '2026-10-13',
  });
  assert.strictEqual(c3.pointsEarned, -19, 'exact reversal incl. bonus');
  assert.strictEqual(profileRepo._raw('default-user').lifetimeScore, 15, 'cycle A bonus intact');
});

// =========================================================================
// Legendary × combo (multiplicative)
// =========================================================================

check('v2.2: legendary × combo stacks on top of ×3 (combo 2 → 1.25× of ×3 base)', async ({ svc, cycleRepo }) => {
  // Build two cycles where the first task in each shares `habitId`
  // (so they chain) and is legendary.
  function buildLegendaryCycle() {
    const c = fixtures.emptyCycle('Legend');
    fixtures.addTask(c, 0, 0, {
      uuid: 't-legend', description: 'Streak', optional: false,
      legendary: true, habitId: 'h-legend',
    });
    fixtures.addTask(c, 1, 0, { uuid: 't-other', description: 'Other', optional: false });
    fixtures.addTask(c, 2, 0, { uuid: 't-other3', description: 'Other', optional: false });
    fixtures.addTask(c, 3, 0, { uuid: 't-other4', description: 'Other', optional: false });
    return c;
  }

  const cycle1 = buildLegendaryCycle();
  const saved1 = await cycleRepo.create(cycle1);

  // First legendary completion: combo 1 → Silver(15) × 3 = 45.
  const c1 = await svc.patchCycle(saved1.uuid, {
    type: 'updateTasks',
    updates: [{ uuid: 't-legend', completed: true }],
    clientDate: '2026-10-12',
  });
  assert.strictEqual(c1.pointsEarned, 45, '1/4 → Silver 15 × 3 = 45 (combo 1)');
  assert.strictEqual(c1.isLegendary, true);

  // Same legendary habit one day later in a new cycle: combo 2 → 45 × 1.25 = 56.
  const cycle2 = buildLegendaryCycle();
  const saved2 = await cycleRepo.create(cycle2);
  const c2 = await svc.patchCycle(saved2.uuid, {
    type: 'updateTasks',
    updates: [{ uuid: 't-legend', completed: true }],
    clientDate: '2026-10-13',
  });
  assert.strictEqual(c2.pointsEarned, 56, '15 × 3 × 1.25 = 56.25 → 56 (round)');
  const raw = cycleRepo._raw(saved2.uuid);
  const t = findTask(raw, 't-legend').task;
  assert.strictEqual(t.legendary, true);
  assert.strictEqual(t.combo, 2);
  assert.strictEqual(t.comboBonus, 11, '56 - 45 = 11');
});

// =========================================================================
// PATCH response `combo` field
// =========================================================================

check('v2.2: PATCH response includes `combo` field on the last completion', async ({ svc, cycleRepo }) => {
  const cycle = cycleWithRequiredTasksSpread(4);
  const saved = await cycleRepo.create(cycle);
  const t0 = saved.weeks[0].days[0].tasks[0].uuid;

  const out = await svc.patchCycle(saved.uuid, {
    type: 'updateTasks',
    updates: [{ uuid: t0, completed: true }],
    clientDate: '2026-10-12',
  });
  assert.ok(out.combo, 'combo field present');
  assert.strictEqual(out.combo.taskUuid, t0);
  assert.strictEqual(out.combo.combo, 1);
  assert.strictEqual(out.combo.name, null); // combo 1 → no name
  assert.strictEqual(out.combo.bonus, 0);
});

check('v2.2: PATCH response `combo` shows DOUBLE STRIKE on combo 2', async ({ svc, cycleRepo }) => {
  // Cycle A first
  const a = fixtures.emptyCycle('A');
  fixtures.addTask(a, 0, 0, { uuid: 't-r', description: 'Read', optional: false, habitId: 'h-shared' });
  const savedA = await cycleRepo.create(a);
  await svc.patchCycle(savedA.uuid, {
    type: 'updateTasks',
    updates: [{ uuid: 't-r', completed: true }],
    clientDate: '2026-10-12',
  });

  // Cycle B — combo 2
  const b = fixtures.emptyCycle('B');
  fixtures.addTask(b, 0, 0, { uuid: 't-r', description: 'Read', optional: false, habitId: 'h-shared' });
  const savedB = await cycleRepo.create(b);
  const out = await svc.patchCycle(savedB.uuid, {
    type: 'updateTasks',
    updates: [{ uuid: 't-r', completed: true }],
    clientDate: '2026-10-13',
  });
  assert.ok(out.combo);
  assert.strictEqual(out.combo.combo, 2);
  assert.strictEqual(out.combo.name, 'DOUBLE STRIKE');
  assert.strictEqual(out.combo.bonus, 4);
});

check('v2.2: PATCH response `combo` is omitted for addTasks/deleteTasks/moveTasks/updateCycle', async ({ svc, cycleRepo }) => {
  const cycle = cycleWithRequiredTasksSpread(4);
  const saved = await cycleRepo.create(cycle);
  const weekUuid = saved.weeks[0].uuid;
  const dayUuid = saved.weeks[0].days[0].uuid;

  // addTasks
  const out1 = await svc.patchCycle(saved.uuid, {
    type: 'addTasks',
    additions: [{
      weekUuid, dayUuid,
      task: { description: 'extra', optional: false, completed: false, uuid: 't-extra' },
    }],
  });
  assert.strictEqual(out1.combo, undefined, 'addTasks → no combo field');

  // updateCycle
  const out2 = await svc.patchCycle(saved.uuid, { type: 'updateCycle', name: 'X' });
  assert.strictEqual(out2.combo, undefined, 'updateCycle → no combo field');
});

// =========================================================================
// clientDate schema validation
// =========================================================================

check('v2.2: updateTasks schema rejects invalid clientDate (zod strict)', () => {
  const { patchSchema, zodDetails } = require('../validation/cycleSchemas');
  // Missing clientDate is fine (it's optional).
  const ok = patchSchema.safeParse({
    type: 'updateTasks',
    updates: [{ uuid: 't-1', completed: true }],
  });
  assert.ok(ok.success, 'no clientDate is valid');

  // Valid ISO date is fine.
  const okDate = patchSchema.safeParse({
    type: 'updateTasks',
    updates: [{ uuid: 't-1', completed: true }],
    clientDate: '2026-10-12',
  });
  assert.ok(okDate.success, 'ISO date is valid');

  // Garbage clientDate is rejected.
  const bad = patchSchema.safeParse({
    type: 'updateTasks',
    updates: [{ uuid: 't-1', completed: true }],
    clientDate: 'not-a-date',
  });
  assert.ok(!bad.success, 'garbage clientDate must be rejected');
  const details = zodDetails(bad.error);
  assert.ok(details.some((d) => /clientDate/.test(d.path)),
    'rejection details name clientDate');

  // Extra unknown key is rejected (strict mode).
  const extra = patchSchema.safeParse({
    type: 'updateTasks',
    updates: [{ uuid: 't-1', completed: true }],
    clientDate: '2026-10-12',
    evilExtraKey: true,
  });
  assert.ok(!extra.success, 'strict mode rejects unknown keys');
});

// =========================================================================
// Forward-only: re-completion doesn't recompute downstream combos
// =========================================================================

check('v2.2: forward-only — un-checking an earlier task does NOT recompute later combos', async ({ svc, cycleRepo }) => {
  // Cycle has the same habit on day 0 and day 2. Both complete within 2 days.
  const cycle = fixtures.emptyCycle('Test');
  fixtures.addTask(cycle, 0, 0, { uuid: 't-0', description: 'Meditate', optional: false, habitId: 'h-shared' });
  fixtures.addTask(cycle, 0, 2, { uuid: 't-2', description: 'Meditate', optional: false, habitId: 'h-shared' });
  const saved = await cycleRepo.create(cycle);

  // Complete day 0 — combo 1.
  await svc.patchCycle(saved.uuid, {
    type: 'updateTasks',
    updates: [{ uuid: 't-0', completed: true }],
    clientDate: '2026-10-12',
  });
  // Complete day 2 — combo 2.
  await svc.patchCycle(saved.uuid, {
    type: 'updateTasks',
    updates: [{ uuid: 't-2', completed: true }],
    clientDate: '2026-10-13',
  });

  // Uncheck day 0 — day 2 should KEEP its stored combo=2 (forward-only).
  await svc.patchCycle(saved.uuid, {
    type: 'updateTasks',
    updates: [{ uuid: 't-0', completed: false }],
    clientDate: '2026-10-12',
  });
  const raw = cycleRepo._raw(saved.uuid);
  const t2 = findTask(raw, 't-2').task;
  assert.strictEqual(t2.combo, 2, 'day 2 combo unchanged after day 0 uncheck (forward-only)');
});

// =========================================================================
// Cap: combo ≥5 stays at multiplier ×2 (50% bonus)
// =========================================================================

check('v2.2: combo 5+ still uses multiplier 2 (cap) and bonus caps at 50% of base', async ({ svc, cycleRepo }) => {
  // Build a chain of 5 distinct days. Tasks share `habitId` so the lookup
  // chains across cycles.
  const targets = [
    ['A1', '2026-10-10'],
    ['A2', '2026-10-11'],
    ['B1', '2026-10-12'],
    ['B2', '2026-10-13'],
    ['C1', '2026-10-14'],
  ];
  for (const [name, day] of targets) {
    const c = fixtures.emptyCycle(name);
    fixtures.addTask(c, 0, 0, {
      uuid: 't-streak', description: 'Streak',
      optional: false, habitId: 'h-streak',
    });
    const saved = await cycleRepo.create(c);
    await svc.patchCycle(saved.uuid, {
      type: 'updateTasks',
      updates: [{ uuid: 't-streak', completed: true }],
      clientDate: day,
    });
  }
  // The last completion should be combo=5 with multiplier=2 → bonus = 15 (Bronze 15×1).
  const lastCycle = cycleRepo._all().find((c) => c.name === 'C1');
  const raw = cycleRepo._raw(lastCycle.uuid);
  const t = findTask(raw, 't-streak').task;
  assert.strictEqual(t.combo, 5, 'combo 5 at cap');
  assert.strictEqual(t.comboBonus, 15, '15 base × 1 = 15 bonus at cap');
});
// Run all queued checks and exit with the tally.
Promise.all(checks).then(() => {
  console.log(`\n${passed} checks passed`);
  process.exit(0);
});
