#!/usr/bin/env node
/**
 * UB-13/14 — node smoke test for shared progress + scoring.
 * Runnable with: node shared/test-shared.js
 * No extra npm deps. Exit 0 on success.
 */

'use strict';

const assert = require('assert');
const {
  calculateProgress,
  createEmptyMonth,
  generateUuid,
} = require('./progress');
const {
  getTierFromProgress,
  getPointsForTier,
  calculateTaskPoints,
  calculateMonthScore,
  TIER_POINTS,
} = require('./scoring');

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

check('generateUuid prefixes', () => {
  assert.ok(generateUuid('t').startsWith('t-'));
  assert.ok(generateUuid().startsWith('c-'));
});

check('createEmptyMonth shape: 4 weeks × 7 days', () => {
  const month = createEmptyMonth('Test Month');
  assert.strictEqual(month.name, 'Test Month');
  assert.strictEqual(month.weeks.length, 4);
  assert.strictEqual(month.weeks[0].days.length, 7);
  assert.strictEqual(month.progress, 0);
  assert.strictEqual(month.finished, false);
  assert.ok(month.uuid.startsWith('m-'));
});

check('tier boundaries', () => {
  assert.strictEqual(getTierFromProgress(0), 'Bronze');
  assert.strictEqual(getTierFromProgress(24), 'Bronze');
  assert.strictEqual(getTierFromProgress(25), 'Silver');
  assert.strictEqual(getTierFromProgress(49), 'Silver');
  assert.strictEqual(getTierFromProgress(50), 'Gold');
  assert.strictEqual(getTierFromProgress(74), 'Gold');
  assert.strictEqual(getTierFromProgress(75), 'Champion');
  assert.strictEqual(getTierFromProgress(99), 'Champion');
  assert.strictEqual(getTierFromProgress(100), 'Final');
  assert.strictEqual(getTierFromProgress(110), 'Final');
});

check('tier point tables', () => {
  assert.deepStrictEqual(getPointsForTier('Bronze'), { required: 10, optional: 5 });
  assert.deepStrictEqual(getPointsForTier('Final'), { required: 30, optional: 15 });
  assert.deepStrictEqual(getPointsForTier('Nope'), TIER_POINTS.Bronze);
});

check('calculateTaskPoints + legendary ×3', () => {
  assert.strictEqual(calculateTaskPoints(false, 0, false), 10); // Bronze required
  assert.strictEqual(calculateTaskPoints(true, 0, false), 5); // Bronze optional
  assert.strictEqual(calculateTaskPoints(false, 100, false), 30); // Final required
  assert.strictEqual(calculateTaskPoints(false, 100, true), 90); // Final legendary
});

check('week progress + conquered from required tasks only', () => {
  const cycle = {
    weeks: [
      {
        days: [
          {
            tasks: [
              { optional: false, completed: true },
              { optional: false, completed: false },
              { optional: true, completed: true }, // ignored for week %
            ],
          },
        ],
        progress: 0,
        conquered: false,
      },
    ],
    progress: 0,
  };
  calculateProgress(cycle);
  assert.strictEqual(cycle.weeks[0].progress, 50);
  assert.strictEqual(cycle.weeks[0].conquered, false);
  assert.strictEqual(cycle.progress, 50);
});

check('optional bonus only when base === 100; cap +10 → 110', () => {
  const makeWeek = (requiredDone, requiredTotal, optionalDone) => {
    const tasks = [];
    for (let i = 0; i < requiredTotal; i++) {
      tasks.push({ optional: false, completed: i < requiredDone });
    }
    for (let i = 0; i < optionalDone; i++) {
      tasks.push({ optional: true, completed: true });
    }
    return {
      days: [{ tasks }],
      progress: 0,
      conquered: false,
    };
  };

  // 4 weeks fully conquered + 6 optionals → bonus min(10, 12)=10 → 110
  const cycle = {
    weeks: [
      makeWeek(1, 1, 2),
      makeWeek(1, 1, 2),
      makeWeek(1, 1, 1),
      makeWeek(1, 1, 1),
    ],
    progress: 0,
  };
  calculateProgress(cycle);
  assert.ok(cycle.weeks.every((w) => w.progress === 100 && w.conquered === true));
  assert.strictEqual(cycle.progress, 110);
});

check('no bonus when base < 100 even with optionals', () => {
  const cycle = {
    weeks: [
      {
        days: [
          {
            tasks: [
              { optional: false, completed: true },
              { optional: false, completed: false },
              { optional: true, completed: true },
              { optional: true, completed: true },
            ],
          },
        ],
        progress: 0,
        conquered: false,
      },
    ],
    progress: 0,
  };
  calculateProgress(cycle);
  assert.strictEqual(cycle.progress, 50);
});

check('calculateMonthScore sums completed task points at month progress tier', () => {
  const month = {
    progress: 100,
    weeks: [
      {
        days: [
          {
            tasks: [
              { completed: true, optional: false, legendary: false },
              { completed: true, optional: true, legendary: false },
              { completed: false, optional: false, legendary: false },
            ],
          },
        ],
      },
    ],
  };
  // Final tier: required 30 + optional 15 = 45
  assert.strictEqual(calculateMonthScore(month), 45);
});

check('backend thin re-export path resolves', () => {
  const viaUtils = require('../backend/utils/scoreCalculator');
  assert.strictEqual(viaUtils.getTierFromProgress(50), 'Gold');
  assert.strictEqual(viaUtils.calculateTaskPoints(false, 25), 15);
});

console.log(`\n${passed} checks passed`);
process.exit(0);
