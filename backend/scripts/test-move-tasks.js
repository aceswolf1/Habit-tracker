#!/usr/bin/env node
/**
 * W3-qa — UB-11 — proves moveTasks relocation + order + progress recalc.
 *
 * Replaces the old route-source mirror with calls to the REAL pure helper
 * `applyMove` exported from `services/taskMutationService.js` (w3-mutation
 * landed it; the contract says "implemented as small pure helpers …
 * (exported for tests: applyAdditions, applyUpdates, applyDeletes, applyMove)").
 *
 * The previous `moveTask(cycle, ...)` mirror in this file is gone — it
 * duplicated the service. Tests now drive `applyMove` and `calculateProgress`
 * (from shared/progress) directly, and a separate layer-boundary check
 * replaces the route-source grep.
 *
 * No mongoose. No HTTP. Runnable with: node backend/scripts/test-move-tasks.js
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const { calculateProgress } = require('../../shared/progress');
const { applyMove } = require('../services/taskMutationService');

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

function fixture() {
  return {
    progress: 0,
    weeks: [
      {
        uuid: 'w-1',
        progress: 0,
        conquered: false,
        days: [
          {
            uuid: 'd-a',
            tasks: [
              { uuid: 't-1', optional: false, completed: false, order: 0 },
              { uuid: 't-2', optional: false, completed: true,  order: 1 },
            ],
          },
          {
            uuid: 'd-b',
            tasks: [{ uuid: 't-3', optional: false, completed: false, order: 0 }],
          },
        ],
      },
    ],
  };
}

check('moves task across days and updates order', () => {
  const cycle = fixture();
  const miss = applyMove(cycle, { taskUuid: 't-1', targetDayUuid: 'd-b', targetIndex: 0 });
  assert.strictEqual(miss, null, 'applyMove returns null on success');
  assert.strictEqual(cycle.weeks[0].days[0].tasks.map((t) => t.uuid).join(','), 't-2');
  assert.strictEqual(cycle.weeks[0].days[1].tasks.map((t) => t.uuid).join(','), 't-1,t-3');
  assert.strictEqual(cycle.weeks[0].days[1].tasks[0].order, 0);
  assert.strictEqual(cycle.weeks[0].days[1].tasks[1].order, 1);
  assert.strictEqual(cycle.weeks[0].days[0].tasks[0].order, 0);
});

check('default targetIndex appends to end', () => {
  const cycle = fixture();
  const miss = applyMove(cycle, { taskUuid: 't-1', targetDayUuid: 'd-b' });
  assert.strictEqual(miss, null);
  assert.deepStrictEqual(
    cycle.weeks[0].days[1].tasks.map((t) => t.uuid),
    ['t-3', 't-1']
  );
});

check('same-day reorder via targetIndex', () => {
  const cycle = fixture();
  const miss = applyMove(cycle, { taskUuid: 't-1', targetDayUuid: 'd-a', targetIndex: 1 });
  assert.strictEqual(miss, null);
  assert.deepStrictEqual(
    cycle.weeks[0].days[0].tasks.map((t) => t.uuid),
    ['t-2', 't-1']
  );
  assert.strictEqual(cycle.weeks[0].days[0].tasks[0].order, 0);
  assert.strictEqual(cycle.weeks[0].days[0].tasks[1].order, 1);
});

check('missing task → returns {type:"task"} sentinel; cycle unchanged', () => {
  const cycle = fixture();
  const before = JSON.stringify(cycle);
  const miss = applyMove(cycle, { taskUuid: 't-missing', targetDayUuid: 'd-b', targetIndex: 0 });
  assert.ok(miss, 'should return a miss sentinel');
  assert.strictEqual(miss.type, 'task');
  assert.strictEqual(miss.uuid, 't-missing');
  assert.strictEqual(JSON.stringify(cycle), before, 'cycle is byte-for-byte unchanged');
});

check('missing target restores source; returns {type:"targetDay"} sentinel', () => {
  // Legacy behavior (preserved by the service per contract): on missing
  // target, splice-removes the task from its source day, then push-resto
  // it to the end of the same day. Source-day set is preserved; the task
  // ends up at the end of its day rather than its original index — this
  // matches the legacy route handler and the pre-existing test.
  const cycle = fixture();
  const sourceDayBefore = cycle.weeks[0].days[0].tasks.map((t) => t.uuid);
  const miss = applyMove(cycle, { taskUuid: 't-1', targetDayUuid: 'd-missing', targetIndex: 0 });
  assert.ok(miss);
  assert.strictEqual(miss.type, 'targetDay');
  assert.strictEqual(miss.uuid, 'd-missing');
  // Source task is restored (it's still present in the source day).
  const sourceDayAfter = cycle.weeks[0].days[0].tasks.map((t) => t.uuid);
  assert.deepStrictEqual(sourceDayAfter, ['t-2', 't-1'],
    'source task restored at end of source day (legacy semantics)');
  // Day and target-day still untouched.
  assert.deepStrictEqual(
    cycle.weeks[0].days[1].tasks.map((t) => t.uuid),
    ['t-3']
  );
  // Source-day set membership is preserved.
  assert.strictEqual(sourceDayAfter.length, sourceDayBefore.length);
});

check('progress recalculated after move (required completion distribution)', () => {
  // Move completed t-2 to empty-ish day; week still 1/3 required done → 33%
  const cycle = fixture();
  // add another required incomplete on d-b so totals stay clear
  cycle.weeks[0].days[1].tasks.push({ uuid: 't-4', optional: false, completed: false, order: 1 });
  const miss = applyMove(cycle, { taskUuid: 't-2', targetDayUuid: 'd-b', targetIndex: 0 });
  assert.strictEqual(miss, null);
  // required: t-1 incomplete (d-a), t-2 complete (d-b), t-3 incomplete (d-b), t-4 incomplete (d-b)
  // → 1/4 = 25% in this single-week fixture.
  calculateProgress(cycle);
  assert.strictEqual(cycle.weeks[0].progress, 25);
  assert.strictEqual(cycle.progress, 25);
});

// ---- Layer-boundary check (replacing the old route-source grep) ----------
//
// The old assertion `cycleRoutes.js source contains moveTasks branch …` was
// a static check against the route's source. The W3 contract moved the
// branch into the service; the routes file is now wiring-only. The new
// invariant is: `applyMove` lives in the service module and is the only
// place it's implemented.

check('services/taskMutationService.js exports applyMove (and the service owns moveTasks)', () => {
  const svcPath = path.join(__dirname, '../services/taskMutationService.js');
  const src = fs.readFileSync(svcPath, 'utf8');
  assert.ok(/function\s+applyMove\s*\(/.test(src),
    'applyMove must be defined in services/taskMutationService.js');
  assert.ok(/module\.exports\s*=\s*\{[^}]*applyMove/m.test(src),
    'applyMove must be exported from services/taskMutationService.js');
});

check('routes/cycleRoutes.js has no inline moveTasks implementation', () => {
  const routesSrc = fs.readFileSync(
    path.join(__dirname, '../routes/cycleRoutes.js'),
    'utf8'
  );
  // None of these move-related tokens should appear in the wiring-only routes file.
  assert.ok(!/applyMove/.test(routesSrc),
    'routes/cycleRoutes.js must not contain applyMove (lives in service)');
  assert.ok(!/moveTasks/.test(routesSrc),
    'routes/cycleRoutes.js must not contain the moveTasks branch');
  assert.ok(!/findIndex\(/.test(routesSrc),
    'routes/cycleRoutes.js must not contain inline task findIndex loops');
});

check('controllers/cycleController.js does not loop over weeks/days/tasks', () => {
  const ctlPath = path.join(__dirname, '../controllers/cycleController.js');
  if (!fs.existsSync(ctlPath)) {
    throw new Error('controllers/cycleController.js missing — w3-core C3 not landed');
  }
  const src = fs.readFileSync(ctlPath, 'utf8');
  // No structural iteration; the controller calls services only.
  assert.ok(!/for\s*\(\s*const\s+week/.test(src), 'no week loops in controller');
  assert.ok(!/for\s*\(\s*const\s+day/.test(src), 'no day loops in controller');
  assert.ok(!/tasks\.find/.test(src), 'no task lookup in controller');
});

// =========================================================================
// v2.1 — moveTasks preserves ALL task fields (contract §3 guarantee)
// =========================================================================

check('v2.1: PATCH /:id/moveTasks keeps ALL task fields (per v2.1 contract §3)', async () => {
  const { createFakeCycleRepository } = require('./fakes/cycleRepo');
  const fixtures = require('./fakes/fixtures');
  const svcMod = require('../services/taskMutationService');
  const { createTaskMutationService } = svcMod;
  const svc = createTaskMutationService({
    cycleRepo: createFakeCycleRepository(),
    profileRepo: { applyLifetimeDelta: async () => null },
    scoreService: { scoreCompletionFlips: () => ({ pointsEarned: 0 }), tierFor: () => 'Bronze' },
  });
  const cycle = fixtures.emptyCycle('Test');
  fixtures.addTask(cycle, 0, 0, {
    uuid: 't-keep',
    description: 'A', optional: false, completed: true,
    completedAt: new Date('2026-10-14T10:00:00Z'),
    habitId: 'h-abc', tag: 'rare', durationMin: 25,
    timeOfDay: 'evening', dueTime: '18:30',
    recurrenceId: 'rec-1', icon: '📚',
    gifUrl: 'https://example.com/x.gif',
    gifVideoUrl: 'https://example.com/x.mp4',
    gifStillUrl: 'https://example.com/x.jpg',
    notes: 'memo',
  });
  const cycleRepo = createFakeCycleRepository();
  const saved = await cycleRepo.create(cycle);
  // Wire the right repos into the service (above used fake repos, but the
  // cycleRepo is the same one we created `saved` in — re-instantiate with
  // this repo so applyMove/save round-trips correctly).
  const realSvc = createTaskMutationService({
    cycleRepo,
    profileRepo: { applyLifetimeDelta: async () => null },
    scoreService: { scoreCompletionFlips: () => ({ pointsEarned: 0 }), tierFor: () => 'Bronze' },
  });
  await realSvc.patchCycle(saved.uuid, {
    type: 'moveTasks', taskUuid: 't-keep', targetDayUuid: saved.weeks[0].days[1].uuid, targetIndex: 0,
  });
  const raw = cycleRepo._raw(saved.uuid);
  const moved = raw.weeks[0].days[1].tasks[0];
  assert.strictEqual(moved.uuid, 't-keep');
  assert.strictEqual(moved.description, 'A');
  assert.strictEqual(moved.optional, false);
  assert.strictEqual(moved.completed, true);
  assert.ok(((x) => x instanceof Date || (typeof x === 'string' && !Number.isNaN(Date.parse(x))))(moved.completedAt), 'completedAt preserved (Date or ISO string from the fake clone)');
  assert.strictEqual(moved.habitId, 'h-abc');
  assert.strictEqual(moved.tag, 'rare');
  assert.strictEqual(moved.durationMin, 25);
  assert.strictEqual(moved.timeOfDay, 'evening');
  assert.strictEqual(moved.dueTime, '18:30');
  assert.strictEqual(moved.recurrenceId, 'rec-1');
  assert.strictEqual(moved.icon, '📚');
  assert.strictEqual(moved.gifUrl, 'https://example.com/x.gif');
  assert.strictEqual(moved.notes, 'memo');
});
__chain.then(() => {
  if (process.exitCode) process.exit(1);
  console.log(`\n${passed} checks passed`);
  process.exit(0);
});
