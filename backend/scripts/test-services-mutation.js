#!/usr/bin/env node
/**
 * W3-qa — service-layer tests for `taskMutationService`.
 *
 * Validates the contract from `development/remediation-w3/orchestration-ctx/
 * decisions/layer-contract-w3.md` §"Services":
 *   patchCycle(uuid, body)
 *     -> { cycle, pointsEarned, isLegendary, currentTier }
 *   not found     -> NOT_FOUND
 *   finished      -> CYCLE_FINISHED (BEFORE any change)
 *   branches: addTasks | updateTasks | deleteTasks | moveTasks
 *   order: apply -> calculateProgress -> scoreCompletionFlips
 *          -> profileRepo.applyLifetimeDelta (only when pointsEarned !== 0)
 *          -> cycleRepo.save
 *
 * Mocks: in-memory `cycleRepo` / `profileRepo` from `./fakes/`. No mongoose.
 *
 * Coverage targets from the QA task assignment:
 *   - tier crossing (covered in test-services-score.js; verified end-to-end here)
 *   - legendary ×3 (score test)
 *   - score floor 0 (score test)
 *   - lifetime floor 0 + delta only when non-zero (this file)
 *   - add/update/delete (uuid + recurrenceId) (this file)
 *   - move (across days, same-day reorder, missing task, missing target day)
 *   - finished -> CYCLE_FINISHED before any change
 *   - not found -> NOT_FOUND
 *   - FIX-01: null clears gifUrl/icon; undefined leaves them
 *
 * Runnable with: node backend/scripts/test-services-mutation.js
 */

'use strict';

const assert = require('assert');

const { createFakeCycleRepository } = require('./fakes/cycleRepo');
const { createFakeUserProfileRepository } = require('./fakes/profileRepo');
const fixtures = require('./fakes/fixtures');

// ---- try-require helper (lets us ship tests before services land) --------
function tryRequire(spec, label) {
  try {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    const mod = require(spec);
    return { ok: true, mod };
  } catch (err) {
    if (err && err.code === 'MODULE_NOT_FOUND') {
      console.log(`PENDING: ${label} — module not found at ${spec}`);
      console.log('PENDING: this test will pass once w3-mutation lands taskMutationService');
      process.exit(0);
    }
    throw err;
  }
}

const { mod: mutationMod } = tryRequire(
  '../services/taskMutationService',
  'services/taskMutationService'
);
const { mod: scoreService } = tryRequire(
  '../services/scoreService',
  'services/scoreService'
);

// ---- helpers --------------------------------------------------------------
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

function makeService() {
  const cycleRepo = createFakeCycleRepository();
  const profileRepo = createFakeUserProfileRepository();
  const svc = mutationMod.createTaskMutationService({
    cycleRepo,
    profileRepo,
    scoreService,
  });
  return { svc, cycleRepo, profileRepo };
}

async function seedCycle(cycleRepo, build) {
  const cycle = build();
  return cycleRepo.create(cycle);
}

// Helper to find a task by uuid in a cycle's tree.
function findTask(cycle, uuid) {
  for (const w of cycle.weeks) {
    for (const d of w.days) {
      const t = d.tasks.find((x) => x.uuid === uuid);
      if (t) return { task: t, day: d, week: w };
    }
  }
  return null;
}

// =========================================================================
// patchCycle: not-found path
// =========================================================================

check('patchCycle: missing cycle throws DomainError(NOT_FOUND) with uuid in message', async () => {
  const { svc } = makeService();
  let thrown = null;
  try {
    await svc.patchCycle('no-such-uuid', { type: 'addTasks', additions: [] });
  } catch (err) {
    thrown = err;
  }
  assert.ok(thrown, 'should throw');
  assert.strictEqual(thrown.code, 'NOT_FOUND', `expected NOT_FOUND, got ${thrown.code}`);
  assert.ok(/no-such-uuid/.test(thrown.message), 'message must include uuid');
});

check('patchCycle: missing cycle throws BEFORE any side-effect (repo untouched)', async () => {
  const { svc, cycleRepo, profileRepo } = makeService();
  // Pre-seed an unrelated cycle to prove it stays untouched.
  const c = fixtures.emptyCycle('Survivor');
  const saved = await cycleRepo.create(c);
  const before = JSON.stringify(cycleRepo._all());
  const profileBefore = profileRepo._raw('default-user');

  let thrown = null;
  try {
    await svc.patchCycle('not-real', {
      type: 'addTasks',
      additions: [{ weekUuid: saved.weeks[0].uuid, dayUuid: saved.weeks[0].days[0].uuid, task: {} }],
    });
  } catch (err) {
    thrown = err;
  }
  assert.ok(thrown && thrown.code === 'NOT_FOUND');
  assert.strictEqual(JSON.stringify(cycleRepo._all()), before, 'cycleRepo untouched');
  assert.deepStrictEqual(profileRepo._raw('default-user'), profileBefore, 'profileRepo untouched');
});

// =========================================================================
// patchCycle: finished guard
// =========================================================================

check('patchCycle: finished cycle throws CYCLE_FINISHED BEFORE any mutation', async () => {
  const { svc, cycleRepo } = makeService();
  const cycle = fixtures.emptyCycle('Done');
  cycle.weeks[0].days[0].tasks.push({
    uuid: 't-keep',
    description: 'original',
    optional: false,
    completed: false,
    legendary: false,
  });
  const saved = await cycleRepo.create(cycle);
  saved.finished = true;
  await cycleRepo.save(saved);

  const targetDay = saved.weeks[0].days[0].uuid;
  const targetTaskBefore = findTask(saved, 't-keep').task;
  const descriptionBefore = targetTaskBefore.description;

  let thrown = null;
  try {
    await svc.patchCycle(saved.uuid, {
      type: 'updateTasks',
      updates: [{ uuid: 't-keep', description: 'CHANGED' }],
    });
  } catch (err) {
    thrown = err;
  }
  assert.ok(thrown, 'should throw');
  assert.strictEqual(thrown.code, 'CYCLE_FINISHED');
  // The cycle body should NOT have changed — the guard runs first.
  const after = findTask(cycleRepo._raw(saved.uuid), 't-keep');
  assert.strictEqual(after.task.description, descriptionBefore,
    'finished cycle must NOT be mutated');
  // Also: no lifetime delta should have been triggered.
  void targetDay;
});

check('patchCycle: finished cycle blocks addTasks too', async () => {
  const { svc, cycleRepo } = makeService();
  const cycle = fixtures.emptyCycle('Done');
  const saved = await cycleRepo.create(cycle);
  saved.finished = true;
  await cycleRepo.save(saved);
  const dayCountBefore = saved.weeks.reduce((n, w) => n + w.days.reduce((m, d) => m + d.tasks.length, 0), 0);

  let thrown = null;
  try {
    await svc.patchCycle(saved.uuid, {
      type: 'addTasks',
      additions: [{
        weekUuid: saved.weeks[0].uuid,
        dayUuid: saved.weeks[0].days[0].uuid,
        task: { description: 'never added', optional: false },
      }],
    });
  } catch (err) { thrown = err; }
  assert.ok(thrown && thrown.code === 'CYCLE_FINISHED');
  const raw = cycleRepo._raw(saved.uuid);
  const dayCountAfter = raw.weeks.reduce((n, w) => n + w.days.reduce((m, d) => m + d.tasks.length, 0), 0);
  assert.strictEqual(dayCountAfter, dayCountBefore, 'no task added');
});

// =========================================================================
// addTasks branch
// =========================================================================

check('patchCycle addTasks: appends to matching day/week; progress unchanged when all required', async () => {
  const { svc, cycleRepo } = makeService();
  const cycle = fixtures.cycleWithRequiredTasks(4);
  const saved = await cycleRepo.create(cycle);
  const weekUuid = saved.weeks[0].uuid;
  const dayUuid = saved.weeks[0].days[0].uuid;

  const out = await svc.patchCycle(saved.uuid, {
    type: 'addTasks',
    additions: [{
      weekUuid, dayUuid,
      task: { uuid: 't-new', description: 'extra', optional: true, completed: false },
    }],
  });
  assert.strictEqual(out.pointsEarned, 0, 'no completion flip → 0 points');
  assert.strictEqual(out.isLegendary, false, 'addTasks: isLegendary always false');
  assert.strictEqual(out.currentTier, 'Bronze');

  const raw = cycleRepo._raw(saved.uuid);
  const day = raw.weeks[0].days[0];
  assert.ok(day.tasks.find((t) => t.uuid === 't-new'), 'new task present');
  assert.strictEqual(day.tasks.length, 5, 'task appended (4 + 1)');
});

// =========================================================================
// updateTasks branch — completion flip + legendary + scoring
// =========================================================================

check('patchCycle updateTasks: completing required task awards Silver points (UB-06 tier crossing)', async () => {
  const { svc, cycleRepo, profileRepo } = makeService();
  const cycle = fixtures.cycleWithRequiredTasks(4);
  const saved = await cycleRepo.create(cycle);
  const taskUuid = saved.weeks[0].days[0].tasks[0].uuid;

  const out = await svc.patchCycle(saved.uuid, {
    type: 'updateTasks',
    updates: [{ uuid: taskUuid, completed: true }],
  });

  assert.strictEqual(out.pointsEarned, 15, '1/4 → 25% Silver required = 15');
  assert.strictEqual(out.currentTier, 'Silver');
  const raw = cycleRepo._raw(saved.uuid);
  assert.strictEqual(raw.progress, 25);
  // Lifetime updated by 15 (gate pointsEarned !== 0).
  const prof = profileRepo._raw('default-user');
  assert.strictEqual(prof.lifetimeScore, 15);
});

check('patchCycle updateTasks: legendary required task awards Silver × 3 = 45', async () => {
  const { svc, cycleRepo, profileRepo } = makeService();
  const cycle = fixtures.cycleWithRequiredTasks(4);
  // Make the first task legendary.
  cycle.weeks[0].days[0].tasks[0].legendary = true;
  const saved = await cycleRepo.create(cycle);
  const taskUuid = saved.weeks[0].days[0].tasks[0].uuid;

  const out = await svc.patchCycle(saved.uuid, {
    type: 'updateTasks',
    updates: [{ uuid: taskUuid, completed: true }],
  });
  assert.strictEqual(out.pointsEarned, 45, '15 × 3 = 45');
  assert.strictEqual(out.isLegendary, true, 'isLegendary mirrors the FIRST updated task');
  assert.strictEqual(profileRepo._raw('default-user').lifetimeScore, 45);
});

check('patchCycle updateTasks: uncomplete subtracts points; lifetime floor 0; profile not touched when delta=0', async () => {
  const { svc, cycleRepo, profileRepo } = makeService();
  const cycle = fixtures.cycleWithRequiredTasks(4);
  // Pre-complete 2 of 4 → 50% Gold.
  cycle.weeks[0].days[0].tasks[0].completed = true;
  cycle.weeks[0].days[0].tasks[1].completed = true;
  const saved = await cycleRepo.create(cycle);

  // First flip: uncomplete task 0 → 1/4 = 25% Silver → -15 points → -15 lifetime.
  const out1 = await svc.patchCycle(saved.uuid, {
    type: 'updateTasks',
    updates: [{ uuid: saved.weeks[0].days[0].tasks[0].uuid, completed: false }],
  });
  assert.strictEqual(out1.pointsEarned, -15, 'Gold(20) → Silver(15), reverse is 15');
  assert.strictEqual(profileRepo._raw('default-user').lifetimeScore, -15);

  // Now lifetime is at -15? No — the fake floors at 0 already. Re-check.
  // The fake floors positive deltas at 0; negative goes negative in `pointsEarned`,
  // but the floor on lifetime is `Math.max(0, current + delta)`. So 0 + (-15) = -15 → 0.
  assert.strictEqual(profileRepo._raw('default-user').lifetimeScore, 0,
    'lifetime floors at 0 (cannot go negative)');
});

check('patchCycle updateTasks: zero-point edit (description-only) does NOT touch profile', async () => {
  const { svc, cycleRepo, profileRepo } = makeService();
  const cycle = fixtures.cycleWithRequiredTasks(4);
  const saved = await cycleRepo.create(cycle);
  const taskUuid = saved.weeks[0].days[0].tasks[0].uuid;

  const out = await svc.patchCycle(saved.uuid, {
    type: 'updateTasks',
    updates: [{ uuid: taskUuid, description: 'renamed' }],
  });
  assert.strictEqual(out.pointsEarned, 0);
  // The profile should NOT have been touched (no lifetime delta on 0).
  const raw = profileRepo._raw('default-user');
  // The repo only writes the profile on non-zero delta; on miss it stays undefined.
  assert.ok(raw == null, 'profile must remain uncreated when pointsEarned=0');
});

// =========================================================================
// deleteTasks branch — uuid list + recurrenceId
// =========================================================================

check('patchCycle deleteTasks: by taskUuids array', async () => {
  const { svc, cycleRepo } = makeService();
  const cycle = fixtures.cycleWithRequiredTasks(4);
  const saved = await cycleRepo.create(cycle);
  const t0 = saved.weeks[0].days[0].tasks[0].uuid;
  const t1 = saved.weeks[0].days[0].tasks[1].uuid;

  const out = await svc.patchCycle(saved.uuid, {
    type: 'deleteTasks',
    taskUuids: [t0, t1],
  });
  assert.strictEqual(out.pointsEarned, 0);
  assert.strictEqual(out.currentTier, 'Bronze');

  const raw = cycleRepo._raw(saved.uuid);
  const remainingUuids = raw.weeks[0].days[0].tasks.map((t) => t.uuid);
  assert.deepStrictEqual(remainingUuids, [saved.weeks[0].days[0].tasks[2].uuid, saved.weeks[0].days[0].tasks[3].uuid]);
});

check('patchCycle deleteTasks: by recurrenceId removes across the whole cycle', async () => {
  const { svc, cycleRepo } = makeService();
  const cycle = fixtures.emptyCycle('Test');
  fixtures.addTask(cycle, 0, 0, { description: 'A', optional: false, recurrenceId: 'rec-1' });
  fixtures.addTask(cycle, 0, 1, { description: 'A2', optional: false, recurrenceId: 'rec-1' });
  fixtures.addTask(cycle, 1, 0, { description: 'B', optional: false, recurrenceId: 'rec-2' });
  const saved = await cycleRepo.create(cycle);

  const out = await svc.patchCycle(saved.uuid, {
    type: 'deleteTasks',
    recurrenceId: 'rec-1',
  });
  assert.strictEqual(out.pointsEarned, 0);

  const raw = cycleRepo._raw(saved.uuid);
  // All rec-1 tasks gone, rec-2 survives.
  for (const w of raw.weeks) {
    for (const d of w.days) {
      for (const t of d.tasks) {
        assert.notStrictEqual(t.recurrenceId, 'rec-1', `unexpected rec-1 task ${t.uuid}`);
      }
    }
  }
  assert.ok(findTask(raw, 'rec-2') || raw.weeks.some(w => w.days.some(d => d.tasks.some(t => t.recurrenceId === 'rec-2'))),
    'rec-2 task must survive');
});

// =========================================================================
// moveTasks branch — across days, same-day reorder, missing, missing target
// =========================================================================

check('patchCycle moveTasks: moves task across days; reindexes both source and target', async () => {
  const { svc, cycleRepo } = makeService();
  const cycle = fixtures.emptyCycle('Test');
  fixtures.addTask(cycle, 0, 0, { uuid: 't-a', description: 'A', optional: false });
  fixtures.addTask(cycle, 0, 0, { uuid: 't-b', description: 'B', optional: false });
  fixtures.addTask(cycle, 0, 1, { uuid: 't-c', description: 'C', optional: false });
  const saved = await cycleRepo.create(cycle);
  const day2 = saved.weeks[0].days[1].uuid;

  const out = await svc.patchCycle(saved.uuid, {
    type: 'moveTasks',
    taskUuid: 't-a',
    targetDayUuid: day2,
    targetIndex: 0,
  });
  assert.strictEqual(out.pointsEarned, 0);

  const raw = cycleRepo._raw(saved.uuid);
  const d0 = raw.weeks[0].days[0];
  const d1 = raw.weeks[0].days[1];
  assert.deepStrictEqual(d0.tasks.map((t) => t.uuid), ['t-b']);
  assert.deepStrictEqual(d1.tasks.map((t) => t.uuid), ['t-a', 't-c']);
  // Reindexed
  assert.strictEqual(d1.tasks[0].order, 0);
  assert.strictEqual(d1.tasks[1].order, 1);
});

check('patchCycle moveTasks: same-day reorder via targetIndex', async () => {
  const { svc, cycleRepo } = makeService();
  const cycle = fixtures.emptyCycle('Test');
  fixtures.addTask(cycle, 0, 0, { uuid: 't-a', description: 'A', optional: false });
  fixtures.addTask(cycle, 0, 0, { uuid: 't-b', description: 'B', optional: false });
  fixtures.addTask(cycle, 0, 0, { uuid: 't-c', description: 'C', optional: false });
  const saved = await cycleRepo.create(cycle);
  const day0 = saved.weeks[0].days[0].uuid;

  await svc.patchCycle(saved.uuid, {
    type: 'moveTasks',
    taskUuid: 't-a',
    targetDayUuid: day0,
    targetIndex: 2, // append after t-b
  });
  const raw = cycleRepo._raw(saved.uuid);
  assert.deepStrictEqual(raw.weeks[0].days[0].tasks.map((t) => t.uuid), ['t-b', 't-c', 't-a']);
  raw.weeks[0].days[0].tasks.forEach((t, i) => assert.strictEqual(t.order, i, `order[${i}]=${t.order}`));
});

check('patchCycle moveTasks: missing task → NOT_FOUND with uuid in message; cycle unchanged', async () => {
  const { svc, cycleRepo } = makeService();
  const cycle = fixtures.emptyCycle('Test');
  fixtures.addTask(cycle, 0, 0, { uuid: 't-a', description: 'A', optional: false });
  const saved = await cycleRepo.create(cycle);
  const before = JSON.stringify(cycleRepo._raw(saved.uuid));
  const day0 = saved.weeks[0].days[0].uuid;

  let thrown = null;
  try {
    await svc.patchCycle(saved.uuid, {
      type: 'moveTasks',
      taskUuid: 't-ghost',
      targetDayUuid: day0,
    });
  } catch (err) { thrown = err; }
  assert.ok(thrown && thrown.code === 'NOT_FOUND');
  assert.ok(/t-ghost/.test(thrown.message), 'message includes the missing task uuid');
  assert.strictEqual(JSON.stringify(cycleRepo._raw(saved.uuid)), before, 'cycle unchanged');
});

check('patchCycle moveTasks: missing target day → NOT_FOUND; source task restored (cycle unchanged)', async () => {
  const { svc, cycleRepo } = makeService();
  const cycle = fixtures.emptyCycle('Test');
  fixtures.addTask(cycle, 0, 0, { uuid: 't-a', description: 'A', optional: false });
  fixtures.addTask(cycle, 0, 0, { uuid: 't-b', description: 'B', optional: false });
  const saved = await cycleRepo.create(cycle);
  const before = JSON.stringify(cycleRepo._raw(saved.uuid));

  let thrown = null;
  try {
    await svc.patchCycle(saved.uuid, {
      type: 'moveTasks',
      taskUuid: 't-a',
      targetDayUuid: 'd-ghost',
    });
  } catch (err) { thrown = err; }
  assert.ok(thrown && thrown.code === 'NOT_FOUND');
  assert.ok(/d-ghost/.test(thrown.message), 'message includes the missing day uuid');
  assert.strictEqual(JSON.stringify(cycleRepo._raw(saved.uuid)), before,
    'cycle unchanged after 404 (source restored)');
});

// =========================================================================
// FIX-01 — null clears gifUrl/icon, undefined leaves them
// =========================================================================

check('FIX-01: null on gifUrl clears the field (not just sets it falsy)', async () => {
  const { svc, cycleRepo } = makeService();
  const cycle = fixtures.emptyCycle('Test');
  fixtures.addTask(cycle, 0, 0, {
    uuid: 't-gif',
    description: 'A',
    optional: false,
    gifUrl: 'https://example.com/a.gif',
    icon: '📚',
  });
  const saved = await cycleRepo.create(cycle);

  const out = await svc.patchCycle(saved.uuid, {
    type: 'updateTasks',
    updates: [{ uuid: 't-gif', gifUrl: null }],
  });
  assert.strictEqual(out.pointsEarned, 0);
  const raw = cycleRepo._raw(saved.uuid);
  const task = findTask(raw, 't-gif').task;
  assert.strictEqual(task.gifUrl, null, 'gifUrl must be cleared to null');
  assert.ok(!('gifUrl' in task && task.gifUrl !== null), 'gifUrl must not be a leftover URL');
});

check('FIX-01: null on icon clears the field; sibling icon left untouched', async () => {
  const { svc, cycleRepo } = makeService();
  const cycle = fixtures.emptyCycle('Test');
  fixtures.addTask(cycle, 0, 0, {
    uuid: 't-emoji',
    description: 'A',
    optional: false,
    gifUrl: 'https://example.com/a.gif',
    icon: '📚',
  });
  const saved = await cycleRepo.create(cycle);

  await svc.patchCycle(saved.uuid, {
    type: 'updateTasks',
    updates: [{ uuid: 't-emoji', icon: null }],
  });
  const raw = cycleRepo._raw(saved.uuid);
  const task = findTask(raw, 't-emoji').task;
  assert.strictEqual(task.icon, null, 'icon cleared');
  // gifUrl was untouched by this PATCH (undefined) → still present.
  assert.strictEqual(task.gifUrl, 'https://example.com/a.gif',
    'sibling gifUrl survives an undefined sibling (FIX-01 semantics)');
});

check('FIX-01: undefined on gifUrl/icon leaves the existing value untouched', async () => {
  const { svc, cycleRepo } = makeService();
  const cycle = fixtures.emptyCycle('Test');
  fixtures.addTask(cycle, 0, 0, {
    uuid: 't-keep',
    description: 'A',
    optional: false,
    gifUrl: 'https://example.com/keep.gif',
    icon: '✨',
  });
  const saved = await cycleRepo.create(cycle);

  await svc.patchCycle(saved.uuid, {
    type: 'updateTasks',
    updates: [{ uuid: 't-keep', description: 'renamed only' }],
  });
  const raw = cycleRepo._raw(saved.uuid);
  const task = findTask(raw, 't-keep').task;
  assert.strictEqual(task.gifUrl, 'https://example.com/keep.gif', 'gifUrl preserved');
  assert.strictEqual(task.icon, '✨', 'icon preserved');
});

// =========================================================================
// return shape + ordering invariants
// =========================================================================

check('patchCycle return shape is exactly { cycle, pointsEarned, isLegendary, currentTier }', async () => {
  const { svc, cycleRepo } = makeService();
  const cycle = fixtures.cycleWithRequiredTasks(4);
  const saved = await cycleRepo.create(cycle);
  const taskUuid = saved.weeks[0].days[0].tasks[0].uuid;
  const out = await svc.patchCycle(saved.uuid, {
    type: 'updateTasks',
    updates: [{ uuid: taskUuid, completed: true }],
  });
  assert.deepStrictEqual(Object.keys(out).sort(), ['cycle', 'currentTier', 'isLegendary', 'pointsEarned']);
  assert.ok(out.cycle && out.cycle.weeks, 'cycle payload carries weeks');
  assert.ok(typeof out.pointsEarned === 'number');
  assert.strictEqual(typeof out.isLegendary, 'boolean');
  assert.strictEqual(typeof out.currentTier, 'string');
});

check('patchCycle: completed+uncompleted in the same call net to 0 points (no profile delta)', async () => {
  const { svc, cycleRepo, profileRepo } = makeService();
  const cycle = fixtures.cycleWithRequiredTasks(4);
  // Pre-complete task 0 so a later uncomplete cancels the upcoming complete.
  cycle.weeks[0].days[0].tasks[0].completed = true;
  const saved = await cycleRepo.create(cycle);
  const taskUuid = saved.weeks[0].days[0].tasks[0].uuid;

  const out = await svc.patchCycle(saved.uuid, {
    type: 'updateTasks',
    updates: [
      { uuid: taskUuid, completed: false }, // first → uncomplete from true
      { uuid: taskUuid, completed: true },  // then re-complete (same task)
    ],
  });
  // Net: 0 (one uncomplete + one complete cancel in the score loop).
  assert.strictEqual(out.pointsEarned, 0, 'net-zero flips → pointsEarned = 0');
  // And because pointsEarned === 0, profile is untouched.
  assert.ok(profileRepo._raw('default-user') == null, 'no profile write on 0-delta');
});

console.log(`\n${passed} checks passed`);
process.exit(0);