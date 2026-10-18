#!/usr/bin/env node
/**
 * v2.2 — tests for the insights service (`backend/services/insightsService.js`).
 *
 * Coverage (per contract §3):
 *   - perfectDays.current / .longest with E5's "no-task days skipped" rule
 *   - finishedMonths.total / .streak (consecutive finished cycles)
 *   - habits: top 20 by completions, currentCombo (≤2 day window),
 *     bestCombo (max stored), lastCompletedOn
 *   - months: chronological order with progress, score, perfectDays,
 *     completionRate
 *   - weekdayRates[7] (Mon..Sun % completed)
 *   - combatLog: last 7 days, newest first, capped at 100, with xp + combo
 *
 * No mongoose — uses the in-memory fake cycleRepo. Standalone runner.
 * Runnable with: `node backend/scripts/test-insights.js`
 */
'use strict';

const assert = require('assert');

const { createFakeCycleRepository } = require('./fakes/cycleRepo');
const fixtures = require('./fakes/fixtures');
const { createInsightsService } = require('../services/insightsService');

const TODAY = '2026-10-14';

let passed = 0;
const checks = [];
function check(name, fn) {
  checks.push(
    Promise.resolve()
      .then(() => fn())
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
  const svc = createInsightsService({ cycleRepo });
  return { svc, cycleRepo };
}

/**
 * Build a 4-week cycle whose days all have `requiredCount` required
 * tasks (none optional) on each day, plus `extraOptional` optionals
 * per day. `dayProgress(cycle, dayIndex, weekIndex)` is the
 * completion pattern — pass an array of 28 booleans (weeks 0..3, days 0..6).
 */
function buildCycle({ required = 4, optional = 1, dayCompleted }) {
  const c = fixtures.emptyCycle('Insights');
  for (let w = 0; w < 4; w++) {
    for (let d = 0; d < 7; d++) {
      for (let i = 0; i < required; i++) {
        const completed = !!(dayCompleted && dayCompleted[w * 7 + d]);
        fixtures.addTask(c, w, d, {
          description: `R-${i}`, optional: false, completed,
        });
      }
      for (let i = 0; i < optional; i++) {
        const completed = !!(dayCompleted && dayCompleted[w * 7 + d]);
        fixtures.addTask(c, w, d, {
          description: `O-${i}`, optional: true, completed,
        });
      }
    }
  }
  return c;
}

// =========================================================================
// Response shape — minimal sanity
// =========================================================================

check('insights: returns the documented response shape', async () => {
  const { svc, cycleRepo } = makeService();
  await cycleRepo.create(buildCycle({}));
  const out = await svc.compute({ today: TODAY });
  assert.ok(out.perfectDays && typeof out.perfectDays.current === 'number');
  assert.ok(out.finishedMonths && typeof out.finishedMonths.total === 'number');
  assert.ok(Array.isArray(out.habits));
  assert.ok(Array.isArray(out.months));
  assert.ok(Array.isArray(out.weekdayRates));
  assert.ok(Array.isArray(out.combatLog));
  assert.strictEqual(out.weekdayRates.length, 7);
});

// =========================================================================
// Perfect-day rules
// =========================================================================

check('insights: perfectDays skips no-task days and counts completed required days', async () => {
  const { svc, cycleRepo } = makeService();
  // Only day 0 has tasks (one required, completed). Days 1–27 have no
  // tasks → skipped, no streak reset.
  const c = fixtures.emptyCycle('OnlyDay0');
  fixtures.addTask(c, 0, 0, { description: 'A', optional: false, completed: true });
  await cycleRepo.create(c);
  const out = await svc.compute({ today: TODAY });
  assert.strictEqual(out.perfectDays.current, 1, 'one perfect day');
  assert.strictEqual(out.perfectDays.longest, 1);
});

check('insights: perfectDays streaks across cycles (chronological)', async () => {
  const { svc, cycleRepo } = makeService();
  // Two cycles whose END and START perfect days link together:
  //   cycle 1 has a perfect day at its LAST day (week 3 day 6),
  //   cycle 2 has a perfect day at its FIRST day (week 0 day 0).
  // All other days have no tasks so they don't break it.
  function buildOnePerfectDayAt(weekIdx, dayIdx) {
    const c = fixtures.emptyCycle('Streak');
    fixtures.addTask(c, weekIdx, dayIdx, {
      description: 'P', optional: false, completed: true,
    });
    return c;
  }
  const cycle1 = buildOnePerfectDayAt(3, 6);
  cycle1.startDate = '2026-10-05';
  await cycleRepo.create(cycle1);

  const cycle2 = buildOnePerfectDayAt(0, 0);
  cycle2.startDate = '2026-10-12';
  await cycleRepo.create(cycle2);

  const out = await svc.compute({ today: TODAY });
  assert.strictEqual(out.perfectDays.longest, 2, 'streak 2 across cycles');
  assert.strictEqual(out.perfectDays.current, 2, 'streak still live at end');
});

check('insights: no-task days are skipped (no streak reset)', async () => {
  const { svc, cycleRepo } = makeService();
  // Cycle with required on day 0 + day 1 only; day 0 perfect, day 1 not.
  // day 2 onward has NO tasks → should not reset the streak.
  const c = fixtures.emptyCycle('Skip');
  fixtures.addTask(c, 0, 0, { description: 'A', optional: false, completed: true });
  fixtures.addTask(c, 0, 1, { description: 'A', optional: false, completed: false });
  await cycleRepo.create(c);
  const out = await svc.compute({ today: TODAY });
  // day 0 perfect, day 1 not, days 2-27 no tasks. Longest is 1, current is 0.
  assert.strictEqual(out.perfectDays.longest, 1);
  assert.strictEqual(out.perfectDays.current, 0, 'day 1 broke the streak; no-task days did not');
});

// =========================================================================
// Finished months streak
// =========================================================================

check('insights: finishedMonths counts total + consecutive streak', async () => {
  const { svc, cycleRepo } = makeService();
  const mk = (finished, startDate) => {
    const c = fixtures.emptyCycle('F');
    c.finished = finished;
    c.finishedAt = finished ? new Date('2026-10-12T10:00:00Z') : null;
    c.startDate = startDate;
    return c;
  };
  // chronological: undated (gap), finished (1), finished (2), finished (3)
  await cycleRepo.create(mk(false, null)); // undated gap (first in sort)
  await cycleRepo.create(mk(true,  '2026-10-05'));
  await cycleRepo.create(mk(true,  '2026-10-12'));
  await cycleRepo.create(mk(true,  '2026-10-19'));
  const out = await svc.compute({ today: TODAY });
  assert.strictEqual(out.finishedMonths.total, 3);
  assert.strictEqual(out.finishedMonths.streak, 3);
});

// =========================================================================
// Habits: top 20, currentCombo (2-day window), bestCombo
// =========================================================================

check('insights: habits top 20 by completions with current/best combo', async () => {
  const { svc, cycleRepo } = makeService();
  // Habit A completed today (combo 1), day before (combo 2), 3 days ago
  // (combo 1, then broken).
  // Habit B completed 5 days ago only.
  const c = fixtures.emptyCycle('Habits');
  fixtures.addTask(c, 0, 0, {
    description: 'A', optional: false, habitId: 'h-A',
    completed: true, completedAt: new Date('2026-10-10T08:00:00Z'),
    completedOn: '2026-10-10', combo: 1,
  });
  fixtures.addTask(c, 0, 1, {
    description: 'A', optional: false, habitId: 'h-A',
    completed: true, completedAt: new Date('2026-10-13T08:00:00Z'),
    completedOn: '2026-10-13', combo: 2,
  });
  fixtures.addTask(c, 0, 2, {
    description: 'B', optional: false, habitId: 'h-B',
    completed: true, completedAt: new Date('2026-10-09T08:00:00Z'),
    completedOn: '2026-10-09', combo: 1,
  });
  await cycleRepo.create(c);
  const out = await svc.compute({ today: TODAY });
  const a = out.habits.find((h) => h.habitKey === 'h-A');
  const b = out.habits.find((h) => h.habitKey === 'h-B');
  assert.ok(a, 'A present');
  assert.ok(b, 'B present');
  assert.strictEqual(a.completions, 2);
  assert.strictEqual(a.bestCombo, 2);
  assert.strictEqual(a.lastCompletedOn, '2026-10-13');
  // Today (10-14) - 10-13 = 1 day ≤ 2 → currentCombo carries over (combo=2).
  assert.strictEqual(a.currentCombo, 2);
  // B was 10-09, today 10-14 → diff=5 → outside window → currentCombo=0.
  assert.strictEqual(b.currentCombo, 0);
});

check('insights: completed tasks without completedOn (pre-v2.2) still count', async () => {
  const { svc, cycleRepo } = makeService();
  const c = fixtures.emptyCycle('Legacy');
  fixtures.addTask(c, 0, 0, { description: 'Read', optional: false, completed: true });
  fixtures.addTask(c, 0, 1, { description: 'read ', optional: false, completed: true });
  fixtures.addTask(c, 0, 2, { description: 'Read', optional: false, completed: false });
  await cycleRepo.create(c);
  const out = await svc.compute({ today: TODAY });
  const r = out.habits.find((h) => h.habitKey === 'name:read');
  assert.ok(r, 'legacy habit present (linked by name)');
  assert.strictEqual(r.completions, 2);
  assert.strictEqual(r.lastCompletedOn, null);
  assert.strictEqual(r.currentCombo, 0);
  assert.strictEqual(r.bestCombo, 0);
});

check('insights: habits capped at top 20 by completions', async () => {
  const { svc, cycleRepo } = makeService();
  const c = fixtures.emptyCycle('Cap');
  for (let i = 0; i < 25; i++) {
    fixtures.addTask(c, 0, 0, {
      description: `H${i}`, optional: false, habitId: `h-${i}`,
      completed: true, completedAt: new Date(TODAY + 'T08:00:00Z'),
      completedOn: TODAY, combo: 1,
    });
  }
  await cycleRepo.create(c);
  const out = await svc.compute({ today: TODAY });
  assert.strictEqual(out.habits.length, 20);
});

// =========================================================================
// Months list (chronological + rollups)
// =========================================================================

check('insights: months array is chronological with progress + score + perfectDays', async () => {
  const { svc, cycleRepo } = makeService();
  const p1 = new Array(28).fill(true); // everything done
  const c1 = buildCycle({ required: 1, dayCompleted: p1 });
  c1.startDate = '2026-10-05';
  c1.progress = 100;
  c1.score = 100;
  await cycleRepo.create(c1);
  const p2 = new Array(28).fill(false);
  p2[0] = true; // one perfect day
  const c2 = buildCycle({ required: 1, dayCompleted: p2 });
  c2.startDate = '2026-10-12';
  c2.progress = 25;
  c2.score = 15;
  await cycleRepo.create(c2);
  const out = await svc.compute({ today: TODAY });
  assert.strictEqual(out.months.length, 2);
  assert.strictEqual(out.months[0].startDate, '2026-10-05');
  assert.strictEqual(out.months[1].startDate, '2026-10-12');
  assert.strictEqual(out.months[0].progress, 100);
  assert.strictEqual(out.months[1].progress, 25);
  assert.strictEqual(out.months[0].perfectDays, 28);
  assert.strictEqual(out.months[1].perfectDays, 1);
});

// =========================================================================
// Weekday rates
// =========================================================================

check('insights: weekdayRates returns Mon..Sun array with percentages', async () => {
  const { svc, cycleRepo } = makeService();
  const c = fixtures.emptyCycle('WD');
  // Mon (day 0) — 2 required, 1 done → 50%.
  fixtures.addTask(c, 0, 0, { description: 'A', optional: false, completed: true });
  fixtures.addTask(c, 0, 0, { description: 'A', optional: false, completed: false });
  // Tue (day 1) — 2 required, 2 done → 100%.
  fixtures.addTask(c, 0, 1, { description: 'A', optional: false, completed: true });
  fixtures.addTask(c, 0, 1, { description: 'A', optional: false, completed: true });
  await cycleRepo.create(c);
  const out = await svc.compute({ today: TODAY });
  assert.strictEqual(out.weekdayRates[0], 50, 'Mon');
  assert.strictEqual(out.weekdayRates[1], 100, 'Tue');
  // No tasks Wed..Sun → 0.
  for (let i = 2; i < 7; i++) {
    assert.strictEqual(out.weekdayRates[i], 0, `day ${i} = 0`);
  }
});

// =========================================================================
// Combat log (last 7 days, newest first, max 100)
// =========================================================================

check('insights: combatLog returns last 7 days newest-first with combo info', async () => {
  const { svc, cycleRepo } = makeService();
  const c = fixtures.emptyCycle('Log');
  // Today — combo 2 with 4-point bonus.
  fixtures.addTask(c, 0, 0, {
    description: 'Read', optional: false, habitId: 'h-read',
    completed: true, completedAt: new Date('2026-10-14T08:00:00Z'),
    completedOn: '2026-10-14', combo: 2, comboBonus: 4,
  });
  // 8 days ago — outside window.
  fixtures.addTask(c, 0, 6, {
    description: 'Old', optional: false,
    completed: true, completedAt: new Date('2026-10-06T08:00:00Z'),
    completedOn: '2026-10-06', combo: 1,
  });
  await cycleRepo.create(c);
  const out = await svc.compute({ today: TODAY });
  assert.strictEqual(out.combatLog.length, 1, '8-day-old entry excluded');
  assert.strictEqual(out.combatLog[0].description, 'Read');
  assert.strictEqual(out.combatLog[0].combo, 2);
  assert.strictEqual(out.combatLog[0].comboName, 'DOUBLE STRIKE');
  assert.ok(out.combatLog[0].xp >= 19, 'xp = base 15 + bonus 4');
});

check('insights: combatLog caps at 100 entries', async () => {
  const { svc, cycleRepo } = makeService();
  const c = fixtures.emptyCycle('Cap');
  for (let i = 0; i < 120; i++) {
    fixtures.addTask(c, 0, 0, {
      description: `T${i}`, optional: false, habitId: `h-${i}`,
      completed: true, completedAt: new Date(TODAY + 'T08:00:00Z'),
      completedOn: TODAY, combo: 1,
    });
  }
  await cycleRepo.create(c);
  const out = await svc.compute({ today: TODAY });
  assert.strictEqual(out.combatLog.length, 100);
});

Promise.all(checks).then(() => {
  console.log(`\n${passed} checks passed`);
  process.exit(0);
});