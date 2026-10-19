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
  calculateDayProgress,
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
const {
  isIsoDate,
  isMonday,
  mondayOf,
  dayDate,
  dayOfMonth,
  todayIso,
  findToday,
} = require('./dates');
const { normalizeDescription, habitKey, newHabitId } = require('./habits');
const { levelInfo } = require('./levels');
const { BOSSES, bossForWeek } = require('./bosses');
const { TAGS, TIMES_OF_DAY, isHHMM } = require('./taskMeta');
const {
  COMBO_GAP_DAYS,
  comboMultiplier,
  comboName,
  daysBetween,
  nextCombo,
} = require('./combos');
const {
  CHEST_CREDITS,
  chestOdds,
  rollRarity,
  nextRewardInfo,
} = require('./rewards');
const {
  ACHIEVEMENTS,
  ACHIEVEMENT_CREDITS,
  evaluateAchievements,
  indexOfTier,
} = require('./achievements');

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

check('UB-31: week with zero required tasks → progress=0, conquered=false (no stale carry)', () => {
  // A week with only optional tasks (or no tasks at all) must reset progress
  // and conquered rather than carrying stale values forward. Required count
  // drives both signals.
  const cycle = {
    weeks: [
      {
        // Pre-seed stale values to prove calculateProgress overwrites them.
        progress: 87,
        conquered: true,
        days: [
          {
            tasks: [
              { optional: true, completed: true },
              { optional: true, completed: false },
            ],
          },
          {
            tasks: [],
          },
        ],
      },
    ],
    progress: 0,
  };
  calculateProgress(cycle);
  assert.strictEqual(cycle.weeks[0].progress, 0);
  assert.strictEqual(cycle.weeks[0].conquered, false);
  assert.strictEqual(cycle.progress, 0);
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

check('UB-44: calculateDayProgress (required only, 0–100, empty → 0)', () => {
  // Empty day
  assert.strictEqual(calculateDayProgress({ tasks: [] }), 0);
  assert.strictEqual(calculateDayProgress({ tasks: undefined }), 0);
  assert.strictEqual(calculateDayProgress(null), 0);
  assert.strictEqual(calculateDayProgress(undefined), 0);

  // Only optional tasks → still 0 (required count drives the prop)
  assert.strictEqual(
    calculateDayProgress({
      tasks: [
        { optional: true, completed: true },
        { optional: true, completed: false },
      ],
    }),
    0
  );

  // Partial required completion → rounds toward nearest int
  // 1 of 3 done = 33.3 → 33
  assert.strictEqual(
    calculateDayProgress({
      tasks: [
        { optional: false, completed: true },
        { optional: false, completed: false },
        { optional: false, completed: false },
        { optional: true, completed: true }, // ignored at day level
      ],
    }),
    33
  );

  // All required done → 100 (optional bonus NOT applied here — month level)
  assert.strictEqual(
    calculateDayProgress({
      tasks: [
        { optional: false, completed: true },
        { optional: false, completed: true },
        { optional: true, completed: true }, // ignored at day level
        { optional: true, completed: false },
      ],
    }),
    100
  );

  // None required, none completed → 0
  assert.strictEqual(
    calculateDayProgress({
      tasks: [{ optional: false, completed: false }],
    }),
    0
  );
});

check('backend thin re-export path resolves', () => {
  const viaUtils = require('../backend/utils/scoreCalculator');
  assert.strictEqual(viaUtils.getTierFromProgress(50), 'Gold');
  assert.strictEqual(viaUtils.calculateTaskPoints(false, 25), 15);
});

// =========================================================================
// v2.1 — shared/dates.js
// =========================================================================

check('isIsoDate accepts real YYYY-MM-DD and rejects garbage', () => {
  assert.strictEqual(isIsoDate('2026-10-13'), true);
  assert.strictEqual(isIsoDate('2026-02-29'), false, '2026 is not a leap year');
  assert.strictEqual(isIsoDate('2024-02-29'), true,  '2024 IS a leap year');
  assert.strictEqual(isIsoDate('2026-13-01'), false);
  assert.strictEqual(isIsoDate('2026-02-30'), false, 'Feb 30 silently rolls → reject');
  assert.strictEqual(isIsoDate('20261013'),   false);
  assert.strictEqual(isIsoDate(''),           false);
  assert.strictEqual(isIsoDate(null),         false);
  assert.strictEqual(isIsoDate(undefined),    false);
});

check('isMonday: only Mondays return true (parse at UTC noon, no TZ shifts)', () => {
  assert.strictEqual(isMonday('2026-10-12'), true,  '2026-10-12 is a Monday');
  assert.strictEqual(isMonday('2026-10-13'), false, 'Tuesday');
  assert.strictEqual(isMonday('2026-10-18'), false, 'Sunday');
  assert.strictEqual(isMonday('2026-10-19'), true,  'Monday of the next week');
  assert.strictEqual(isMonday('not-a-date'), false);
});

check('mondayOf returns local Monday (injectable Date for determinism)', () => {
  // Wed 2026-10-14 → Monday 2026-10-12
  assert.strictEqual(mondayOf(new Date(2026, 9, 14, 10, 0, 0)), '2026-10-12');
  // Sunday 2026-10-18 → previous Monday 2026-10-12 (offset -6)
  assert.strictEqual(mondayOf(new Date(2026, 9, 18, 23, 0, 0)), '2026-10-12');
  // Monday 2026-10-12 → itself
  assert.strictEqual(mondayOf(new Date(2026, 9, 12, 0, 0, 0)), '2026-10-12');
});

check('dayDate derives a calendar day from start + offsets; null when undated', () => {
  // Start 2026-10-12 (Mon); week 0 day 1 → 2026-10-13 (Tue)
  assert.strictEqual(dayDate('2026-10-12', 0, 1), '2026-10-13');
  // Week 0 day 6 → Sunday 2026-10-18
  assert.strictEqual(dayDate('2026-10-12', 0, 6), '2026-10-18');
  // Week 1 day 0 → Monday 2026-10-19
  assert.strictEqual(dayDate('2026-10-12', 1, 0), '2026-10-19');
  // Week 2 day 6 → Sunday 2026-11-01 (+20 days from 10-12)
  assert.strictEqual(dayDate('2026-10-12', 2, 6), '2026-11-01');
  // Week 3 day 6 → Sunday 2026-11-08 (+27 days from 10-12)
  assert.strictEqual(dayDate('2026-10-12', 3, 6), '2026-11-08');
  // Out-of-range or invalid
  assert.strictEqual(dayDate(null, 0, 0), null);
  assert.strictEqual(dayDate('', 0, 0), null);
  assert.strictEqual(dayDate('nope', 0, 0), null);
  assert.strictEqual(dayDate('2026-10-12', -1, 0), null);
  assert.strictEqual(dayDate('2026-10-12', 0, 7), null);
});

check('DST week: dayDate does not shift across the spring-forward boundary', () => {
  // US spring-forward 2026 is Sunday 2026-03-08. Cycle starting Monday
  // 2026-03-02 + 6 days → Sunday 2026-03-08 should still be 2026-03-08
  // regardless of which timezone the host is in (we compute at UTC noon).
  assert.strictEqual(dayDate('2026-03-02', 0, 6), '2026-03-08');
  // Week 1 monday after DST start
  assert.strictEqual(dayDate('2026-03-02', 1, 0), '2026-03-09');
  // UK BST starts Sunday 2026-03-29. Last Sunday of March in that week.
  assert.strictEqual(dayDate('2026-03-23', 0, 6), '2026-03-29');
});

check('dayOfMonth extracts the day number', () => {
  assert.strictEqual(dayOfMonth('2026-10-17'), 17);
  assert.strictEqual(dayOfMonth('not'), NaN);
});

check('todayIso returns the local date; injectable for tests', () => {
  const fixed = new Date(2026, 9, 14, 15, 30, 0); // Wed Oct 14 2026 local
  assert.strictEqual(todayIso(fixed), '2026-10-14');
  const live = todayIso();
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(live), `todayIso() must be ISO-shaped; got ${live}`);
});

check('findToday: locates today inside a dated cycle within the 28-day window', () => {
  // Dated cycle starting Mon 2026-10-12; "today" fixed at Wed 2026-10-14.
  const cycle = { startDate: '2026-10-12' };
  const now = new Date(2026, 9, 14, 12, 0, 0);
  assert.deepStrictEqual(findToday(cycle, now), { weekIndex: 0, dayIndex: 2 });
  // Week 1 day 0 (Mon 2026-10-19)
  const now2 = new Date(2026, 9, 19, 12, 0, 0);
  assert.deepStrictEqual(findToday(cycle, now2), { weekIndex: 1, dayIndex: 0 });
  // Today before start → null
  const before = new Date(2026, 9, 5, 12, 0, 0);
  assert.strictEqual(findToday(cycle, before), null);
  // Today outside the 28-day window → null
  const after = new Date(2026, 10, 20, 12, 0, 0); // > day 28 from start
  assert.strictEqual(findToday(cycle, after), null);
  // Undated cycle → null
  assert.strictEqual(findToday({}, now), null);
  assert.strictEqual(findToday({ startDate: null }, now), null);
});

// =========================================================================
// v2.1 — shared/habits.js
// =========================================================================

check('normalizeDescription: trim, collapse whitespace, lowercase', () => {
  assert.strictEqual(normalizeDescription('  Read a   book  '), 'read a book');
  assert.strictEqual(normalizeDescription('Write\tMail'), 'write mail');
  assert.strictEqual(normalizeDescription(''), '');
  assert.strictEqual(normalizeDescription(null), '');
  assert.strictEqual(normalizeDescription(123), '');
});

check('habitKey: prefer habitId; fallback to "name:<normalized>"', () => {
  assert.strictEqual(habitKey({ habitId: 'h-abc', description: 'X' }), 'h-abc');
  assert.strictEqual(
    habitKey({ description: 'Read a Book' }),
    'name:read a book'
  );
  assert.strictEqual(habitKey({}), 'name:');
});

check('newHabitId: matches the h-<base36> pattern', () => {
  const id = newHabitId();
  assert.ok(/^h-/.test(id), `expected h- prefix, got ${id}`);
  assert.ok(id.length > 2);
});

// =========================================================================
// v2.1 — shared/levels.js
// =========================================================================

check('levelInfo: level 1 = 0 XP RECRUIT; band titles; progress 0–100', () => {
  assert.deepStrictEqual(levelInfo(0),   { level: 1, title: 'RECRUIT',   xpIntoLevel: 0, xpForNext: 25, progress: 0 });
  assert.deepStrictEqual(levelInfo(24),  { level: 1, title: 'RECRUIT',   xpIntoLevel: 24, xpForNext: 25, progress: 96 });
  assert.deepStrictEqual(levelInfo(25),  { level: 2, title: 'RECRUIT',   xpIntoLevel: 0,  xpForNext: 75, progress: 0 });
  assert.deepStrictEqual(levelInfo(100), { level: 3, title: 'RECRUIT',   xpIntoLevel: 0,  xpForNext: 125, progress: 0 });
  // Level 5 / title OPERATIVE (minLevel 5)
  assert.deepStrictEqual(levelInfo(400), { level: 5, title: 'OPERATIVE', xpIntoLevel: 0,  xpForNext: 225, progress: 0 });
  // Level 10 / RUNNER — level n starts at 25*(n-1)^2 XP, next at 25*n^2
  assert.deepStrictEqual(levelInfo(2025), { level: 10, title: 'RUNNER', xpIntoLevel: 0, xpForNext: 475, progress: 0 });
  // Level 20 / SPECTER
  assert.deepStrictEqual(levelInfo(25 * 19 * 19), { level: 20, title: 'SPECTER', xpIntoLevel: 0, xpForNext: 975, progress: 0 });
  // Level 30 / VANGUARD
  assert.deepStrictEqual(levelInfo(25 * 29 * 29), { level: 30, title: 'VANGUARD', xpIntoLevel: 0, xpForNext: 1475, progress: 0 });
  // Level 40 / ARCHON — xpForNext=null, progress stays 100
  const archon = levelInfo(25 * 39 * 39);
  assert.strictEqual(archon.level, 40);
  assert.strictEqual(archon.title, 'ARCHON');
  assert.strictEqual(archon.xpForNext, null);
  assert.strictEqual(archon.progress, 100);
});

check('levelInfo: negative XP clamps to 0 and stays level 1', () => {
  const r = levelInfo(-42);
  assert.strictEqual(r.level, 1);
  assert.strictEqual(r.title, 'RECRUIT');
  assert.strictEqual(r.progress, 0);
});

check('levelInfo: lvl 5 boundary — 399 vs 400 XP both compute correctly', () => {
  // lvl 4 ends at 25*4*4 = 225 + (25*5*5 - 25*4*4) = 400
  assert.strictEqual(levelInfo(399).level, 4);
  assert.strictEqual(levelInfo(399).title, 'RECRUIT');
  assert.strictEqual(levelInfo(400).level, 5);
  assert.strictEqual(levelInfo(400).title, 'OPERATIVE');
});

// =========================================================================
// v2.1 — shared/bosses.js
// =========================================================================

check('BOSSES: four entries with codename', () => {
  assert.strictEqual(BOSSES.length, 4);
  const synthia = BOSSES.find((b) => b.codename === 'SYNTHIA');
  assert.ok(synthia && synthia.name === 'CHRONO ARCHON');
});

check('bossForWeek: cycles through the roster', () => {
  assert.strictEqual(bossForWeek(0).codename, 'SYNTHIA');
  assert.strictEqual(bossForWeek(1).codename, 'KAGE');
  assert.strictEqual(bossForWeek(2).codename, 'MERIDIAN');
  assert.strictEqual(bossForWeek(3).codename, 'NYX');
  // Cycle-safe
  assert.strictEqual(bossForWeek(4).codename, 'SYNTHIA');
  assert.strictEqual(bossForWeek(7).codename, 'NYX');
  // Defensive: negatives fall back to first boss
  assert.strictEqual(bossForWeek(-1).codename, 'SYNTHIA');
  assert.strictEqual(bossForWeek('nope').codename, 'SYNTHIA');
});

// =========================================================================
// v2.1 — shared/taskMeta.js
// =========================================================================

check('TAGS + TIMES_OF_DAY are the contract lists', () => {
  assert.deepStrictEqual([...TAGS], ['common', 'rare', 'essential', 'defense']);
  assert.deepStrictEqual([...TIMES_OF_DAY], ['morning', 'afternoon', 'evening', 'night']);
});

check('isHHMM accepts valid HH:MM and rejects common mistakes', () => {
  assert.strictEqual(isHHMM('00:00'), true);
  assert.strictEqual(isHHMM('09:30'), true);
  assert.strictEqual(isHHMM('23:59'), true);
  assert.strictEqual(isHHMM('9:00'),  false, 'single-digit hour');
  assert.strictEqual(isHHMM('24:00'), false, 'hour out of range');
  assert.strictEqual(isHHMM('12:60'), false, 'minute out of range');
  assert.strictEqual(isHHMM('12-00'), false, 'wrong separator');
  assert.strictEqual(isHHMM(''), false);
  assert.strictEqual(isHHMM(null), false);
});

// =========================================================================
// v2.1 — shared/index.js barrel
// =========================================================================

check('index barrel re-exports new modules without collisions', () => {
  const ix = require('./index');
  // pre-existing
  assert.strictEqual(typeof ix.calculateProgress, 'function');
  assert.strictEqual(typeof ix.getTierFromProgress, 'function');
  // v2.1
  assert.strictEqual(typeof ix.findToday, 'function');
  assert.strictEqual(typeof ix.levelInfo, 'function');
  assert.strictEqual(typeof ix.habitKey, 'function');
  assert.strictEqual(typeof ix.bossForWeek, 'function');
  assert.strictEqual(typeof ix.isHHMM, 'function');
  assert.ok(Array.isArray(ix.BOSSES));
});

// =========================================================================
// v2.2 — shared/combos.js
// =========================================================================

check('comboMultiplier: combo 1 → 1×, 2 → 1.25×, 3 → 1.5×, 4 → 1.75×, 5+ → 2× (cap)', () => {
  assert.strictEqual(comboMultiplier(1), 1);
  assert.strictEqual(comboMultiplier(2), 1.25);
  assert.strictEqual(comboMultiplier(3), 1.5);
  assert.strictEqual(comboMultiplier(4), 1.75);
  assert.strictEqual(comboMultiplier(5), 2);
  assert.strictEqual(comboMultiplier(6), 2);
  assert.strictEqual(comboMultiplier(99), 2);
  // Negative / NaN → floor at 1.
  assert.strictEqual(comboMultiplier(0), 1);
  assert.strictEqual(comboMultiplier(-3), 1);
  assert.strictEqual(comboMultiplier(NaN), 1);
});

check('comboName: null below 2; DOUBLE/TRIPLE/QUAD/PENTA STRIKE; ×N STRIKE above 5', () => {
  assert.strictEqual(comboName(0), null);
  assert.strictEqual(comboName(1), null);
  assert.strictEqual(comboName(null), null);
  assert.strictEqual(comboName(undefined), null);
  assert.strictEqual(comboName(2), 'DOUBLE STRIKE');
  assert.strictEqual(comboName(3), 'TRIPLE STRIKE');
  assert.strictEqual(comboName(4), 'QUAD STRIKE');
  assert.strictEqual(comboName(5), 'PENTA STRIKE');
  assert.strictEqual(comboName(6), '×6 STRIKE');
  assert.strictEqual(comboName(9), '×9 STRIKE');
});

check('daysBetween: integer calendar days across month + year boundaries (UTC noon math)', () => {
  assert.strictEqual(daysBetween('2026-10-12', '2026-10-12'), 0);
  assert.strictEqual(daysBetween('2026-10-12', '2026-10-13'), 1);
  assert.strictEqual(daysBetween('2026-10-12', '2026-10-14'), 2);
  assert.strictEqual(daysBetween('2026-10-12', '2026-10-15'), 3);
  // Month boundary
  assert.strictEqual(daysBetween('2026-10-31', '2026-11-01'), 1);
  assert.strictEqual(daysBetween('2026-10-30', '2026-11-02'), 3);
  // Year boundary — diff 1 must hold even though the months roll
  assert.strictEqual(daysBetween('2026-12-31', '2027-01-01'), 1);
  assert.strictEqual(daysBetween('2026-12-30', '2027-01-01'), 2);
  assert.strictEqual(daysBetween('2026-12-29', '2027-01-01'), 3);
  // Leap day
  assert.strictEqual(daysBetween('2024-02-28', '2024-03-01'), 2, '2024 leap year');
  assert.strictEqual(daysBetween('2026-02-28', '2026-03-01'), 1, '2026 NOT a leap year');
  // Defensive
  assert.ok(Number.isNaN(daysBetween('not-a-date', '2026-10-12')));
  assert.ok(Number.isNaN(daysBetween('2026-10-12', null)));
});

check('nextCombo: first-ever completion (prev null) → 1', () => {
  assert.strictEqual(nextCombo(null, null, '2026-10-12'), 1);
  assert.strictEqual(nextCombo(undefined, undefined, '2026-10-12'), 1);
  assert.strictEqual(nextCombo('2026-10-12', null, '2026-10-12'), 1, 'null prevCombo wins');
  assert.strictEqual(nextCombo('2026-10-12', 0, '2026-10-12'), 1, 'prevCombo 0 → 1');
});

check('nextCombo: gap 0 (same day) keeps the combo unchanged (no increase)', () => {
  assert.strictEqual(nextCombo('2026-10-12', 1, '2026-10-12'), 1, 'combo 1 stays at 1 same-day');
  assert.strictEqual(nextCombo('2026-10-12', 2, '2026-10-12'), 2, 'combo 2 stays at 2 same-day');
  assert.strictEqual(nextCombo('2026-10-12', 5, '2026-10-12'), 5, 'combo 5 stays at 5 same-day');
});

check('nextCombo: gap 1 → prevCombo+1', () => {
  assert.strictEqual(nextCombo('2026-10-12', 1, '2026-10-13'), 2);
  assert.strictEqual(nextCombo('2026-10-12', 2, '2026-10-13'), 3);
  assert.strictEqual(nextCombo('2026-10-12', 4, '2026-10-13'), 5);
  assert.strictEqual(nextCombo('2026-10-12', 5, '2026-10-13'), 6, 'above cap keeps growing');
});

check('nextCombo: gap 2 (the boundary) → prevCombo+1', () => {
  assert.strictEqual(nextCombo('2026-10-12', 1, '2026-10-14'), 2);
  assert.strictEqual(nextCombo('2026-10-12', 3, '2026-10-14'), 4);
});

check('nextCombo: gap > 2 (3+) resets to 1', () => {
  assert.strictEqual(nextCombo('2026-10-12', 1, '2026-10-15'), 1);
  assert.strictEqual(nextCombo('2026-10-12', 5, '2026-10-16'), 1);
  assert.strictEqual(nextCombo('2026-10-12', 9, '2026-11-01'), 1, '3-week gap → reset');
});

check('nextCombo: gap crosses month + year boundary correctly', () => {
  // Same-year month roll, gap 1
  assert.strictEqual(nextCombo('2026-10-31', 3, '2026-11-01'), 4);
  // Year roll, gap 1
  assert.strictEqual(nextCombo('2026-12-31', 2, '2027-01-01'), 3);
  // Year roll, gap 2
  assert.strictEqual(nextCombo('2026-12-30', 4, '2027-01-01'), 5);
  // Year roll, gap 3 → 1 (reset)
  assert.strictEqual(nextCombo('2026-12-29', 4, '2027-01-01'), 1);
});

check('nextCombo: defensive invalid completedOn / out-of-order dates', () => {
  assert.strictEqual(nextCombo('2026-10-12', 5, null), 1);
  assert.strictEqual(nextCombo('2026-10-12', 5, 'nope'), 1);
  assert.strictEqual(nextCombo('2026-10-12', 5, '2026-10-11'), 1, 'time-travel → reset');
});

check('COMBO_GAP_DAYS is the contract constant (2)', () => {
  assert.strictEqual(COMBO_GAP_DAYS, 2);
});

check('index barrel re-exports combo helpers', () => {
  const ix = require('./index');
  assert.strictEqual(typeof ix.comboMultiplier, 'function');
  assert.strictEqual(typeof ix.comboName, 'function');
  assert.strictEqual(typeof ix.nextCombo, 'function');
  assert.strictEqual(typeof ix.daysBetween, 'function');
  assert.strictEqual(ix.COMBO_GAP_DAYS, 2);
});

// =========================================================================
// v2.3 — shared/rewards.js
// =========================================================================

check('CHEST_CREDITS matches the contract (common 10 / rare 25 / epic 50 / legendary 100)', () => {
  assert.deepStrictEqual(CHEST_CREDITS, {
    common: 10, rare: 25, epic: 50, legendary: 100,
  });
});

check('chestOdds sums to exactly 1 at every level band', () => {
  for (const lv of [1, 5, 9, 10, 15, 19, 20, 30, 99]) {
    const o = chestOdds(lv);
    const sum = o.common + o.rare + o.epic + o.legendary;
    assert.ok(Math.abs(sum - 1) < 1e-9, `odds at level ${lv} must sum to 1; got ${sum}`);
    // Band-shape guard rails (F2):
    if (lv < 10) {
      assert.deepStrictEqual(o, { common: 0.60, rare: 0.25, epic: 0.12, legendary: 0.03 });
    } else if (lv < 20) {
      assert.deepStrictEqual(o, { common: 0.45, rare: 0.30, epic: 0.18, legendary: 0.07 });
    } else {
      assert.deepStrictEqual(o, { common: 0.30, rare: 0.35, epic: 0.25, legendary: 0.10 });
    }
  }
});

check('rollRarity: deterministic with an injected rand; covers boundaries', () => {
  // At level 5 (band <10): .60/.25/.12/.03
  //   sample < 0.60                  → common
  //   0.60 <= sample < 0.85          → rare
  //   0.85 <= sample < 0.97          → epic
  //   0.97 <= sample                 → legendary
  const cases = [
    { lv: 5,  sample: 0.0,     expect: 'common' },
    { lv: 5,  sample: 0.5999,  expect: 'common' },
    { lv: 5,  sample: 0.60,    expect: 'rare' },
    { lv: 5,  sample: 0.8499,  expect: 'rare' },
    { lv: 5,  sample: 0.85,    expect: 'epic' },
    { lv: 5,  sample: 0.9699,  expect: 'epic' },
    { lv: 5,  sample: 0.97,    expect: 'legendary' },
    { lv: 5,  sample: 0.9999,  expect: 'legendary' },
    // Level 10–19
    { lv: 15, sample: 0.4499,  expect: 'common' },
    { lv: 15, sample: 0.45,    expect: 'rare' },
    { lv: 15, sample: 0.7499,  expect: 'rare' },
    { lv: 15, sample: 0.75,    expect: 'epic' },
    { lv: 15, sample: 0.9299,  expect: 'epic' },
    { lv: 15, sample: 0.93,    expect: 'legendary' },
    // Level 20+
    { lv: 25, sample: 0.2999,  expect: 'common' },
    { lv: 25, sample: 0.30,    expect: 'rare' },
    { lv: 25, sample: 0.6499,  expect: 'rare' },
    { lv: 25, sample: 0.65,    expect: 'epic' },
    { lv: 25, sample: 0.8999,  expect: 'epic' },
    { lv: 25, sample: 0.90,    expect: 'legendary' },
  ];
  for (const c of cases) {
    const got = rollRarity(c.lv, () => c.sample);
    assert.strictEqual(got, c.expect, `lv=${c.lv} sample=${c.sample}: expected ${c.expect}, got ${got}`);
  }
});

check('rollRarity: defensive — bad rand (NaN, ≥1) collapses to common', () => {
  assert.strictEqual(rollRarity(5, () => NaN), 'common');
  assert.strictEqual(rollRarity(5, () => -0.1), 'common');
  assert.strictEqual(rollRarity(5, () => 1.5), 'common');
});

check('rollRarity: distribution sanity (10000 trials) stays inside a generous error band', () => {
  // Loose sanity: for level 5 the legendary share is 3%. Across 10000 trials
  // we expect a hit rate between 1% and 6%.
  let legend = 0;
  const N = 10000;
  for (let i = 0; i < N; i++) {
    if (rollRarity(5) === 'legendary') legend++;
  }
  const rate = legend / N;
  assert.ok(rate > 0.01 && rate < 0.06, `legendary rate should be ~0.03; got ${rate.toFixed(4)}`);
});

check('nextRewardInfo: level 1 (0 XP) → next reward level 2, xp 25', () => {
  // level 1 starts at 0 XP, next = 25, intoLevel = 0 → remaining 25.
  assert.deepStrictEqual(nextRewardInfo(0),   { level: 2, xpRemaining: 25 });
  assert.deepStrictEqual(nextRewardInfo(24),  { level: 2, xpRemaining: 1 });
  assert.deepStrictEqual(nextRewardInfo(25),  { level: 3, xpRemaining: 75 });
  assert.deepStrictEqual(nextRewardInfo(26),  { level: 3, xpRemaining: 74 });
});

check('nextRewardInfo: ARCHON (level 40+) → level:null, xpRemaining:null', () => {
  const archon = nextRewardInfo(25 * 39 * 39);
  assert.strictEqual(archon.level, null);
  assert.strictEqual(archon.xpRemaining, null);
});

check('nextRewardInfo: defensive — negative XP clamps to level 1', () => {
  const r = nextRewardInfo(-100);
  assert.strictEqual(r.level, 2, 'next reward is level 2');
  assert.strictEqual(r.xpRemaining, 25);
});

// =========================================================================
// v2.3 — shared/achievements.js
// =========================================================================

check('ACHIEVEMENTS catalog has 16 entries with the contract ids', () => {
  assert.strictEqual(ACHIEVEMENTS.length, 16);
  const ids = ACHIEVEMENTS.map((a) => a.id);
  for (const id of [
    'first-blood', 'grinder-10', 'grinder-100', 'grinder-500',
    'month-1', 'month-3', 'month-12',
    'tier-silver', 'tier-gold', 'tier-champion', 'tier-final',
    'perfect-3', 'perfect-7',
    'strike-2', 'strike-5',
    'level-10',
  ]) {
    assert.ok(ids.includes(id), `catalog missing ${id}`);
  }
});

check('ACHIEVEMENT_CREDITS maps size → credit (small 10 / medium 25 / large 50)', () => {
  assert.deepStrictEqual(ACHIEVEMENT_CREDITS, { small: 10, medium: 25, large: 50 });
});

check('evaluateAchievements: empty stats → all rows unlocked:false, progress=0', () => {
  const rows = evaluateAchievements({});
  assert.strictEqual(rows.length, ACHIEVEMENTS.length);
  for (const r of rows) {
    assert.strictEqual(r.unlocked, false, `${r.id} should be locked`);
    assert.strictEqual(r.progress, 0, `${r.id} should have progress 0`);
    assert.strictEqual(typeof r.target, 'number');
    assert.strictEqual(typeof r.credits, 'number');
  }
});

check('evaluateAchievements: first-blood unlocks at completions=1', () => {
  const rows = evaluateAchievements({ completions: 1 });
  const fb = rows.find((r) => r.id === 'first-blood');
  assert.strictEqual(fb.unlocked, true);
  assert.strictEqual(fb.current, 1);
  assert.strictEqual(fb.target, 1);
  assert.strictEqual(fb.progress, 1);
});

check('evaluateAchievements: progress is fractional (<1) under target', () => {
  const rows = evaluateAchievements({ completions: 5, finishedMonths: 2, level: 4 });
  const grinder = rows.find((r) => r.id === 'grinder-10');      // target 10
  const machine = rows.find((r) => r.id === 'grinder-500');    // target 500
  const level10 = rows.find((r) => r.id === 'level-10');       // target 10
  assert.strictEqual(grinder.unlocked, false);
  assert.ok(Math.abs(grinder.progress - 0.5) < 1e-9, `expected 0.5; got ${grinder.progress}`);
  assert.strictEqual(machine.unlocked, false);
  assert.ok(Math.abs(machine.progress - 0.01) < 1e-9);
  assert.strictEqual(level10.unlocked, false);
  assert.ok(Math.abs(level10.progress - 0.4) < 1e-9);
});

check('evaluateAchievements: tier-silver/champion require bestTierReached index 1/3', () => {
  const rows = evaluateAchievements({ bestTierReached: 3 });
  const silver    = rows.find((r) => r.id === 'tier-silver');
  const champion  = rows.find((r) => r.id === 'tier-champion');
  const finalForm = rows.find((r) => r.id === 'tier-final');
  assert.strictEqual(silver.unlocked, true);
  assert.strictEqual(silver.current, 3);
  assert.strictEqual(champion.unlocked, true);
  assert.strictEqual(finalForm.unlocked, false);
});

check('indexOfTier: maps progress to Bronze=0..Final=4', () => {
  assert.strictEqual(indexOfTier(0),    0);
  assert.strictEqual(indexOfTier(24),   0);
  assert.strictEqual(indexOfTier(25),   1);
  assert.strictEqual(indexOfTier(50),   2);
  assert.strictEqual(indexOfTier(75),   3);
  assert.strictEqual(indexOfTier(100),  4);
  assert.strictEqual(indexOfTier(110),  4);
  assert.strictEqual(indexOfTier(-10),  0);
});

check('evaluateAchievements: strike-2 unlocks at bestCombo=2', () => {
  const rows = evaluateAchievements({ bestCombo: 2 });
  const s2 = rows.find((r) => r.id === 'strike-2');
  const s5 = rows.find((r) => r.id === 'strike-5');
  assert.strictEqual(s2.unlocked, true);
  assert.strictEqual(s5.unlocked, false);
});

check('evaluateAchievements: level-10 unlocks at level=10', () => {
  const rows = evaluateAchievements({ level: 10 });
  const r = rows.find((x) => x.id === 'level-10');
  assert.strictEqual(r.unlocked, true);
});

// =========================================================================
// v2.3 — index barrel re-exports rewards + achievements
// =========================================================================

check('index barrel re-exports rewards + achievements helpers', () => {
  const ix = require('./index');
  assert.deepStrictEqual(ix.CHEST_CREDITS, CHEST_CREDITS);
  assert.strictEqual(typeof ix.chestOdds, 'function');
  assert.strictEqual(typeof ix.rollRarity, 'function');
  assert.strictEqual(typeof ix.nextRewardInfo, 'function');
  assert.strictEqual(typeof ix.evaluateAchievements, 'function');
  assert.deepStrictEqual(ix.ACHIEVEMENT_CREDITS, ACHIEVEMENT_CREDITS);
  assert.ok(Array.isArray(ix.ACHIEVEMENTS) && ix.ACHIEVEMENTS.length === 16);
});

console.log(`\n${passed} checks passed`);
process.exit(0);
