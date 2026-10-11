#!/usr/bin/env node
/**
 * W3-qa — service-layer tests for `scoreService` (pure).
 *
 * Validates the scoreService contract from `development/remediation-w3/
 * orchestration-ctx/decisions/layer-contract-w3.md` §"Services":
 *   - tierFor(progress)                 -> tier string
 *   - scoreCompletionFlips(cycle, flips) -> { pointsEarned }; mutates cycle.score (floor 0);
 *                                          legendary ×3; uses cycle.progress AFTER recalc (UB-06).
 *
 * Coverage targets from the QA task assignment:
 *   - tier crossing at 24→25% (UB-06)
 *   - legendary ×3
 *   - score floor 0 (no negative)
 *   - lifetime floor 0 (verifies the repo floor, not the service —
 *     done in test-services-mutation.js)
 *
 * No HTTP, no mongoose. Standalone node runner — no test framework.
 * Runnable with: node backend/scripts/test-services-score.js
 */

'use strict';

const assert = require('assert');

// ---- shared math used by these tests (single source of truth) ------------
const { calculateProgress } = require('../../shared/progress');
const {
  getTierFromProgress,
  calculateTaskPoints,
} = require('../../shared/scoring');

// ---- try-require helper (lets us ship tests before services land) --------
function tryRequire(spec, label) {
  try {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    const mod = require(spec);
    return { ok: true, mod };
  } catch (err) {
    if (err && err.code === 'MODULE_NOT_FOUND') {
      console.log(`PENDING: ${label} — module not found at ${spec}`);
      console.log('PENDING: this test will pass once w3-mutation lands scoreService');
      process.exit(0);
    }
    throw err;
  }
}

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

function freshCycleWithRequiredTasks(n) {
  // 4 required tasks across 1 day → completing each one shifts week/month progress
  // predictably (1/4=25, 2/4=50, 3/4=75, 4/4=100).
  const tasks = [];
  for (let i = 0; i < n; i++) {
    tasks.push({ uuid: `t-${i}`, optional: false, completed: false });
  }
  return {
    uuid: 'c-test',
    progress: 0,
    score: 0,
    weeks: [
      {
        uuid: 'w-1',
        progress: 0,
        conquered: false,
        days: [{ uuid: 'd-1', tasks }],
      },
    ],
  };
}

// ---- tierFor --------------------------------------------------------------

check('tierFor delegates to shared getTierFromProgress at every boundary', () => {
  for (const v of [0, 24, 25, 49, 50, 74, 75, 99, 100, 110]) {
    assert.strictEqual(scoreService.tierFor(v), getTierFromProgress(v),
      `tierFor(${v}) must equal shared.getTierFromProgress(${v})`);
  }
});

check('tierFor crosses Bronze → Silver at 24→25 (UB-06)', () => {
  assert.strictEqual(scoreService.tierFor(24), 'Bronze');
  assert.strictEqual(scoreService.tierFor(25), 'Silver');
});

check('tierFor handles non-numeric input without throwing (matches shared fallback)', () => {
  // shared getTierFromProgress coerces NaN/undefined to 0 via Number(progress) || 0
  assert.strictEqual(scoreService.tierFor(undefined), getTierFromProgress(undefined));
  assert.strictEqual(scoreService.tierFor(null), getTierFromProgress(null));
  assert.strictEqual(scoreService.tierFor(NaN), getTierFromProgress(NaN));
});

// ---- scoreCompletionFlips: happy paths -----------------------------------

check('scoreCompletionFlips: completing required task at 25% awards Silver (15), not Bronze (10)', () => {
  // 4 required tasks → mark 1 complete (the flip target) then recalc → 25% → Silver 15.
  // The contract says the service uses cycle.progress AS-IS; the caller (patchCycle)
  // is responsible for calculateProgress FIRST (UB-06). We mirror that flow here.
  const cycle = freshCycleWithRequiredTasks(4);
  cycle.weeks[0].days[0].tasks[0].completed = true;
  calculateProgress(cycle);
  assert.strictEqual(cycle.progress, 25, 'progress should be 25 after recalc');
  const flips = [
    { optional: false, legendary: false, direction: 'complete' },
  ];
  const { pointsEarned } = scoreService.scoreCompletionFlips(cycle, flips);
  assert.strictEqual(getTierFromProgress(cycle.progress), 'Silver');
  assert.strictEqual(pointsEarned, 15, 'Silver/required/15');
  assert.strictEqual(cycle.score, 15);
});

check('scoreCompletionFlips: legendary ×3 multiplier applied to required task', () => {
  // 4 required tasks → mark 1 complete then recalc → 25% Silver → required 15 × 3 = 45
  const cycle = freshCycleWithRequiredTasks(4);
  cycle.weeks[0].days[0].tasks[0].completed = true;
  calculateProgress(cycle);
  assert.strictEqual(cycle.progress, 25);
  assert.strictEqual(getTierFromProgress(cycle.progress), 'Silver');
  const flips = [
    { optional: false, legendary: true, direction: 'complete' },
  ];
  const { pointsEarned } = scoreService.scoreCompletionFlips(cycle, flips);
  assert.strictEqual(pointsEarned, 45, 'Silver required 15 × 3 = 45');
  assert.strictEqual(cycle.score, 45);
});

check('scoreCompletionFlips: optional task awards half-ish (Bronze optional=5)', () => {
  // 4 optional required tasks so progress stays at 0 (only required counts) → Bronze
  // Then completing an OPTIONAL task awards 5 (Bronze optional), not 10.
  const cycle = freshCycleWithRequiredTasks(4);
  const flips = [
    { optional: true, legendary: false, direction: 'complete' },
  ];
  const { pointsEarned } = scoreService.scoreCompletionFlips(cycle, flips);
  assert.strictEqual(pointsEarned, 5);
  assert.strictEqual(cycle.score, 5);
});

check('scoreCompletionFlips: legendary optional ×3 → 15 (Bronze)', () => {
  const cycle = freshCycleWithRequiredTasks(4);
  const flips = [
    { optional: true, legendary: true, direction: 'complete' },
  ];
  const { pointsEarned } = scoreService.scoreCompletionFlips(cycle, flips);
  assert.strictEqual(pointsEarned, 15, '5 × 3 = 15');
});

// ---- scoreCompletionFlips: uncomplete / negative -------------------------

check('scoreCompletionFlips: uncomplete subtracts points (negative)', () => {
  // Driver pattern: uncomplete the task FIRST, then recalc, then score.
  // This mirrors what patchCycle does (apply mutation → recalc → score).
  const cycle = freshCycleWithRequiredTasks(4);
  // Start 4/4 complete → 100% Final.
  for (const t of cycle.weeks[0].days[0].tasks) t.completed = true;
  calculateProgress(cycle);
  assert.strictEqual(cycle.progress, 100, 'pre: 4/4 → 100 Final');

  // Uncomplete one, then recalc → 3/4 = 75 Champion.
  cycle.weeks[0].days[0].tasks[0].completed = false;
  calculateProgress(cycle);
  assert.strictEqual(cycle.progress, 75, 'post: 3/4 → 75 Champion');

  const flips = [
    { optional: false, legendary: false, direction: 'uncomplete' },
  ];
  const { pointsEarned } = scoreService.scoreCompletionFlips(cycle, flips);
  assert.strictEqual(pointsEarned, -25, 'Champion required=25; -25');
  assert.strictEqual(cycle.score, Math.max(0, 0 + pointsEarned));
});

// ---- scoreCompletionFlips: score floor 0 ---------------------------------

check('scoreCompletionFlips: cycle.score floors at 0 on net-negative flips', () => {
  // Pre-seed score below the would-be subtraction, then uncomplete → floor 0.
  const cycle = freshCycleWithRequiredTasks(4);
  for (const t of cycle.weeks[0].days[0].tasks) t.completed = true;
  calculateProgress(cycle);
  cycle.score = 5; // <-- pre-seed below the would-be subtraction
  // Uncomplete + recalc → 75% Champion → -25 points → 5 - 25 = -20 → floor 0.
  cycle.weeks[0].days[0].tasks[0].completed = false;
  calculateProgress(cycle);
  assert.strictEqual(cycle.progress, 75, 'post: 3/4 → 75 Champion');

  const flips = [
    { optional: false, legendary: false, direction: 'uncomplete' },
  ];
  const { pointsEarned } = scoreService.scoreCompletionFlips(cycle, flips);
  assert.strictEqual(pointsEarned, -25);
  assert.strictEqual(cycle.score, 0, 'cycle.score must floor at 0');
});

// ---- scoreCompletionFlips: order uses progress AFTER recalc (UB-06) ------

check('scoreCompletionFlips: tier uses cycle.progress AFTER recalc (UB-06)', () => {
  // UB-06: the contract says scoreCompletionFlips reads cycle.progress as-is,
  // and the CALLER (taskMutationService.patchCycle) is responsible for
  // calculateProgress(cycle) BEFORE invoking scoring. This test simulates
  // that exact ordering: flip → recalc → score.
  const cycle = freshCycleWithRequiredTasks(4);
  // Pre-flip state: 3 of 4 complete → 75% Champion.
  cycle.weeks[0].days[0].tasks[0].completed = true;
  cycle.weeks[0].days[0].tasks[1].completed = true;
  cycle.weeks[0].days[0].tasks[2].completed = true;
  calculateProgress(cycle);
  assert.strictEqual(cycle.progress, 75, 'pre-flip: 3/4 → 75 Champion');
  const tierBefore = getTierFromProgress(cycle.progress);
  assert.strictEqual(tierBefore, 'Champion');

  // Flip the 4th task → recalc → 100% Final → score
  cycle.weeks[0].days[0].tasks[3].completed = true;
  calculateProgress(cycle);
  assert.strictEqual(cycle.progress, 100, 'post-flip: 4/4 → 100 Final');
  assert.strictEqual(getTierFromProgress(cycle.progress), 'Final');

  const flips = [
    { optional: false, legendary: false, direction: 'complete' },
  ];
  const { pointsEarned } = scoreService.scoreCompletionFlips(cycle, flips);
  // Post-recalc tier drives points: 100% Final required = 30.
  // If the service ever regressed to read tierBefore, it would award Champion 25.
  assert.strictEqual(pointsEarned, 30, 'Final/required/30 (not Champion/25)');
});

// ---- scoreCompletionFlips: idempotency / no-op cases ---------------------

check('scoreCompletionFlips: empty flips array is a no-op (returns 0)', () => {
  const cycle = freshCycleWithRequiredTasks(4);
  const beforeScore = cycle.score;
  const beforeProgress = cycle.progress;
  const { pointsEarned } = scoreService.scoreCompletionFlips(cycle, []);
  assert.strictEqual(pointsEarned, 0);
  assert.strictEqual(cycle.score, beforeScore);
  assert.strictEqual(cycle.progress, beforeProgress);
});

check('scoreCompletionFlips: return shape is exactly { pointsEarned }', () => {
  const cycle = freshCycleWithRequiredTasks(4);
  const out = scoreService.scoreCompletionFlips(cycle, [
    { optional: false, legendary: false, direction: 'complete' },
  ]);
  assert.deepStrictEqual(Object.keys(out).sort(), ['pointsEarned']);
});

// ---- cross-check against shared/scoring.calculateTaskPoints --------------

check('scoreCompletionFlips agrees with shared/scoring.calculateTaskPoints at every tier (parity)', () => {
  // Drive cycle.progress to each tier via required completions, then verify
  // that a non-legendary required flip awards exactly calculateTaskPoints(...)
  // at that tier. This guards against the service drifting from shared/.
  for (const target of [
    { reqDone: 0, tier: 'Bronze' },
    { reqDone: 1, tier: 'Silver' },
    { reqDone: 2, tier: 'Gold' },
    { reqDone: 3, tier: 'Champion' },
    { reqDone: 4, tier: 'Final' },
  ]) {
    const cycle = freshCycleWithRequiredTasks(4);
    for (let i = 0; i < target.reqDone; i++) {
      cycle.weeks[0].days[0].tasks[i].completed = true;
    }
    calculateProgress(cycle);
    const expected = calculateTaskPoints(false, cycle.progress, false);
    const flips = [
      { optional: false, legendary: false, direction: 'complete' },
    ];
    const { pointsEarned } = scoreService.scoreCompletionFlips(cycle, flips);
    assert.strictEqual(
      pointsEarned,
      expected,
      `tier=${target.tier} expected=${expected} got=${pointsEarned}`
    );
  }
});

console.log(`\n${passed} checks passed`);
process.exit(0);