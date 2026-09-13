#!/usr/bin/env node
/**
 * UB-06 / BUG-06 — proves points use progress AFTER recalc.
 * Runnable with: node backend/scripts/test-score-order.js
 * No extra npm deps.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const {
  getTierFromProgress,
  calculateTaskPoints
} = require('../utils/scoreCalculator');

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

// Minimal progress calc mirroring cycleRoutes.calculateProgress (required tasks only)
function calculateProgress(cycle) {
  if (!cycle || !cycle.weeks) return;
  for (const week of cycle.weeks) {
    let weekTotalTasks = 0;
    let weekCompletedTasks = 0;
    for (const day of week.days) {
      const requiredTasks = day.tasks.filter((task) => !task.optional);
      weekTotalTasks += requiredTasks.length;
      weekCompletedTasks += requiredTasks.filter((task) => task.completed).length;
    }
    week.progress = weekTotalTasks > 0
      ? Math.round((weekCompletedTasks / weekTotalTasks) * 100)
      : 0;
  }
  const weekCount = cycle.weeks.length;
  if (weekCount === 0) {
    cycle.progress = 0;
    return;
  }
  const totalWeekProgress = cycle.weeks.reduce((sum, w) => sum + (w.progress || 0), 0);
  cycle.progress = Math.round(totalWeekProgress / weekCount);
}

/**
 * Simulate UB-06 route ordering for a single completion flip:
 * apply flip → calculateProgress → calculateTaskPoints(updated progress)
 */
function scoreCompletionAfterRecalc(cycle, task, complete) {
  const wasCompleted = task.completed;
  task.completed = complete;
  calculateProgress(cycle);
  if (wasCompleted === complete) return 0;
  const points = calculateTaskPoints(task.optional, cycle.progress, task.legendary || false);
  return complete ? points : -points;
}

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

check('UB-06 order: completing task that crosses 24→25 awards Silver (15), not Bronze (10)', () => {
  // 4 required tasks, 1 already complete → 25% if we complete a 2nd? Wait:
  // With 4 required across one week: 0/4=0%, 1/4=25%. Start at 0 completed.
  // Completing the first required task → progress 25% → Silver → 15 pts.
  // Old bug used progress 0 (Bronze) → 10 pts.
  const taskA = { uuid: 't-a', optional: false, completed: false, legendary: false };
  const taskB = { uuid: 't-b', optional: false, completed: false, legendary: false };
  const taskC = { uuid: 't-c', optional: false, completed: false, legendary: false };
  const taskD = { uuid: 't-d', optional: false, completed: false, legendary: false };

  const cycle = {
    progress: 0,
    weeks: [
      {
        progress: 0,
        days: [{ tasks: [taskA, taskB, taskC, taskD] }]
      }
    ]
  };

  // Stale (pre-recalc) score using current progress BEFORE flip
  const stalePoints = calculateTaskPoints(taskA.optional, cycle.progress, false);
  assert.strictEqual(stalePoints, 10, 'stale path should be Bronze/10');

  // Correct UB-06 path
  const points = scoreCompletionAfterRecalc(cycle, taskA, true);
  assert.strictEqual(cycle.progress, 25, `expected progress 25 after flip, got ${cycle.progress}`);
  assert.strictEqual(getTierFromProgress(cycle.progress), 'Silver');
  assert.strictEqual(points, 15, `expected Silver/15 after recalc, got ${points}`);
  assert.notStrictEqual(points, stalePoints, 'post-recalc points must differ from stale Bronze points');
});

check('UB-06 order: uncomplete uses post-recalc (lower) progress', () => {
  const taskA = { uuid: 't-a', optional: false, completed: true, legendary: false };
  const taskB = { uuid: 't-b', optional: false, completed: true, legendary: false };
  const taskC = { uuid: 't-c', optional: false, completed: false, legendary: false };
  const taskD = { uuid: 't-d', optional: false, completed: false, legendary: false };

  const cycle = {
    progress: 50, // would be 2/4 before uncomplete
    weeks: [
      {
        progress: 50,
        days: [{ tasks: [taskA, taskB, taskC, taskD] }]
      }
    ]
  };

  // Uncomplete one → 1/4 = 25% Silver → subtract 15 (not Gold/20 from stale 50%)
  const stalePoints = calculateTaskPoints(false, cycle.progress, false);
  assert.strictEqual(stalePoints, 20, 'stale at 50% is Gold/20');

  const delta = scoreCompletionAfterRecalc(cycle, taskA, false);
  assert.strictEqual(cycle.progress, 25);
  assert.strictEqual(delta, -15, `expected -15 (Silver), got ${delta}`);
});

check('route source contains finished 409 guard (UB-02)', () => {
  const routePath = path.join(__dirname, '../routes/cycleRoutes.js');
  const src = fs.readFileSync(routePath, 'utf8');
  assert.ok(src.includes('cycle.finished'), 'missing cycle.finished check');
  assert.ok(src.includes('status(409)'), 'missing 409 status');
  assert.ok(
    /if\s*\(\s*cycle\.finished\s*\)[\s\S]{0,200}status\(409\)/.test(src),
    'finished guard must return 409'
  );
});

check('route source scores after calculateProgress (UB-06)', () => {
  const routePath = path.join(__dirname, '../routes/cycleRoutes.js');
  const src = fs.readFileSync(routePath, 'utf8');
  const progressIdx = src.indexOf('calculateProgress(cycle)');
  const scoreIdx = src.indexOf('completionFlips');
  assert.ok(progressIdx !== -1, 'calculateProgress(cycle) missing');
  assert.ok(scoreIdx !== -1, 'completionFlips tracking missing');
  // First scoring loop over flips should appear after calculateProgress call in PATCH body
  const afterProgress = src.slice(progressIdx);
  assert.ok(
    afterProgress.includes('for (const flip of completionFlips)'),
    'flip scoring loop must follow calculateProgress'
  );
  assert.ok(
    afterProgress.includes('calculateTaskPoints(flip.optional, cycle.progress'),
    'points must use cycle.progress after recalc'
  );
});

console.log(`\n${passed} checks passed.`);
process.exit(0);
