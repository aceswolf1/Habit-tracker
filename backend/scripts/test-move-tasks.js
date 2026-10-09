#!/usr/bin/env node
/**
 * UB-11 — unit-level proof of moveTasks relocation + order + progress recalc.
 * Mirrors the cycleRoutes moveTasks branch without Express/Mongo.
 * Runnable with: node backend/scripts/test-move-tasks.js
 */

'use strict';

const assert = require('assert');
const { calculateProgress } = require('../../shared/progress');

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

/**
 * Pure relocation helper matching cycleRoutes moveTasks semantics.
 */
function moveTask(cycle, taskUuid, targetDayUuid, targetIndex) {
  let movingTask = null;
  let sourceDay = null;

  for (const week of cycle.weeks) {
    for (const day of week.days) {
      const idx = day.tasks.findIndex((t) => t.uuid === taskUuid);
      if (idx !== -1) {
        movingTask = day.tasks[idx];
        sourceDay = day;
        day.tasks.splice(idx, 1);
        break;
      }
    }
    if (movingTask) break;
  }
  if (!movingTask) return { ok: false, code: 404, message: 'task not found' };

  let targetDay = null;
  for (const week of cycle.weeks) {
    for (const day of week.days) {
      if (day.uuid === targetDayUuid) {
        targetDay = day;
        break;
      }
    }
    if (targetDay) break;
  }
  if (!targetDay) {
    sourceDay.tasks.push(movingTask);
    return { ok: false, code: 404, message: 'target not found' };
  }

  let insertAt = typeof targetIndex === 'number' ? targetIndex : targetDay.tasks.length;
  if (insertAt < 0) insertAt = 0;
  if (insertAt > targetDay.tasks.length) insertAt = targetDay.tasks.length;
  targetDay.tasks.splice(insertAt, 0, movingTask);

  const affected = sourceDay === targetDay ? [targetDay] : [sourceDay, targetDay];
  for (const d of affected) {
    d.tasks.forEach((t, i) => {
      t.order = i;
    });
  }

  calculateProgress(cycle);
  return { ok: true, sourceDay, targetDay, movingTask };
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
              { uuid: 't-2', optional: false, completed: true, order: 1 },
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
  const result = moveTask(cycle, 't-1', 'd-b', 0);
  assert.strictEqual(result.ok, true);
  assert.strictEqual(cycle.weeks[0].days[0].tasks.map((t) => t.uuid).join(','), 't-2');
  assert.strictEqual(cycle.weeks[0].days[1].tasks.map((t) => t.uuid).join(','), 't-1,t-3');
  assert.strictEqual(cycle.weeks[0].days[1].tasks[0].order, 0);
  assert.strictEqual(cycle.weeks[0].days[1].tasks[1].order, 1);
  assert.strictEqual(cycle.weeks[0].days[0].tasks[0].order, 0);
});

check('default targetIndex appends to end', () => {
  const cycle = fixture();
  const result = moveTask(cycle, 't-1', 'd-b');
  assert.strictEqual(result.ok, true);
  assert.deepStrictEqual(
    cycle.weeks[0].days[1].tasks.map((t) => t.uuid),
    ['t-3', 't-1']
  );
});

check('same-day reorder via targetIndex', () => {
  const cycle = fixture();
  const result = moveTask(cycle, 't-1', 'd-a', 1);
  assert.strictEqual(result.ok, true);
  assert.deepStrictEqual(
    cycle.weeks[0].days[0].tasks.map((t) => t.uuid),
    ['t-2', 't-1']
  );
  assert.strictEqual(cycle.weeks[0].days[0].tasks[0].order, 0);
  assert.strictEqual(cycle.weeks[0].days[0].tasks[1].order, 1);
});

check('missing task → 404 semantics; cycle unchanged', () => {
  const cycle = fixture();
  const before = JSON.stringify(cycle);
  const result = moveTask(cycle, 't-missing', 'd-b', 0);
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.code, 404);
  assert.strictEqual(JSON.stringify(cycle), before);
});

check('missing target restores source; 404', () => {
  const cycle = fixture();
  const result = moveTask(cycle, 't-1', 'd-missing', 0);
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.code, 404);
  assert.deepStrictEqual(
    cycle.weeks[0].days[0].tasks.map((t) => t.uuid),
    ['t-2', 't-1']
  );
});

check('progress recalculated after move (required completion distribution)', () => {
  // Move completed t-2 to empty-ish day; week still 1/3 required done → 33%
  const cycle = fixture();
  // add another required incomplete on d-b so totals stay clear
  const result = moveTask(cycle, 't-2', 'd-b', 0);
  assert.strictEqual(result.ok, true);
  // required: t-1 incomplete (d-a), t-2 complete (d-b), t-3 incomplete (d-b) → 1/3
  assert.strictEqual(cycle.weeks[0].progress, 33);
  assert.strictEqual(cycle.progress, 33);
});

check('cycleRoutes source contains moveTasks branch + shared progress', () => {
  const fs = require('fs');
  const src = fs.readFileSync(require('path').join(__dirname, '../routes/cycleRoutes.js'), 'utf8');
  assert.ok(src.includes("type === 'moveTasks'"));
  assert.ok(src.includes("require('../../shared/progress')"));
  assert.ok(src.includes('pointsEarned !== 0')); // UB-10 preserved
  assert.ok(src.includes('Math.max(0, userProfile.lifetimeScore + pointsEarned)'));
});

console.log(`\n${passed} checks passed`);
process.exit(0);
