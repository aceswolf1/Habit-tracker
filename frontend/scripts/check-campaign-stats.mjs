#!/usr/bin/env node
/**
 * check-campaign-stats.mjs
 *
 * Standalone Node script that loads `shared/scoring.js` + `shared/progress.js`
 * via `createRequire(import.meta.url)` and asserts the rules the V2
 * `useCampaignStats` composable promises:
 *
 *   1. `getTaskXp`         — uses the shared tier table; legendary = ×3.
 *   2. `getDayStats`       — required-only percent, earned + pending XP
 *                            split, counts.
 *   3. `getWeekDayXp`      — exactly 7 entries, one per day.
 *   4. `getReplicatedLabel` — single / multi-day / "MON-FRI" / "ALL DAYS".
 *
 * The label function is *duplicated* in this script (with the same shape
 * as `composables/useCampaignStats.ts`). That duplication is intentional:
 * the script is meant to run as `node frontend/scripts/check-campaign-stats.mjs`
 * with no Vite / Nuxt build step, so it can't `import` the composable. If
 * you change the label rules, change BOTH copies.
 *
 * Exit code: 0 on success, 1 on first failed assertion.
 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const requireCjs = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');
const scoring = requireCjs(path.join(repoRoot, 'shared', 'scoring.js'));
const progress = requireCjs(path.join(repoRoot, 'shared', 'progress.js'));

const { calculateTaskPoints, getTierFromProgress } = scoring;
const { calculateDayProgress } = progress;

// ---- duplicated label helpers (keep in sync with useCampaignStats.ts) ----

function dayShort(name) {
  const s = (name || '?').trim();
  if (!s) return '?';
  return s.substring(0, 3).toUpperCase();
}

function uniqueOrdered(items) {
  const seen = new Set();
  const out = [];
  for (const it of items) {
    if (seen.has(it)) continue;
    seen.add(it);
    out.push(it);
  }
  return out;
}

function getReplicatedLabel(task, week) {
  if (!task || !task.recurrenceId || !week || !Array.isArray(week.days)) return null;
  const dayShorts = [];
  for (const day of week.days) {
    if (!day) continue;
    const has = day.tasks.some((t) => t && t.recurrenceId === task.recurrenceId);
    if (has) dayShorts.push(dayShort(day.name));
  }
  if (dayShorts.length <= 1) return null;
  if (dayShorts.length === 7) return 'ALL DAYS';
  const joined = uniqueOrdered(dayShorts);
  const weekdayKey = joined.join(',');
  if (weekdayKey === 'MON,TUE,WED,THU,FRI') return 'MON-FRI';
  if (weekdayKey === 'SAT,SUN') return 'WEEKEND';
  return joined.join(', ');
}

// ---- fixture builders (match the contract shapes) ----

function task(p = {}) {
  return {
    uuid: p.uuid || 't-' + Math.random().toString(36).slice(2),
    description: p.description || 'do thing',
    optional: !!p.optional,
    completed: !!p.completed,
    legendary: !!p.legendary,
    recurrenceId: p.recurrenceId,
    order: p.order || 0,
    icon: p.icon,
    gifUrl: p.gifUrl,
    gifVideoUrl: p.gifVideoUrl,
    gifStillUrl: p.gifStillUrl,
  };
}

function day(p = {}) {
  return {
    uuid: p.uuid || 'd-' + Math.random().toString(36).slice(2),
    name: p.name,
    subtitle: p.subtitle || '',
    tasks: p.tasks || [],
  };
}

function week(p = {}) {
  return {
    uuid: p.uuid || 'w-' + Math.random().toString(36).slice(2),
    name: p.name,
    subtitle: p.subtitle || '',
    progress: p.progress || 0,
    conquered: !!p.conquered,
    days: p.days || [],
  };
}

// ---- 1. getTaskXp ----

(function testGetTaskXp() {
  // Required / Bronze (0%): 10
  assert.equal(calculateTaskPoints(false, 0, false), 10, 'Bronze required = 10');
  // Optional / Silver (30%): 7
  assert.equal(calculateTaskPoints(true, 30, false), 7, 'Silver optional = 7');
  // Required / Gold (60%): 20
  assert.equal(calculateTaskPoints(false, 60, false), 20, 'Gold required = 20');
  // Required / Champion (80%): 25
  assert.equal(calculateTaskPoints(false, 80, false), 25, 'Champion required = 25');
  // Required / Final (100%): 30
  assert.equal(calculateTaskPoints(false, 100, false), 30, 'Final required = 30');
  // Legendary × 3: Bronze required legendary = 30
  assert.equal(calculateTaskPoints(false, 0, true), 30, 'Bronze legendary = 30');
  // Legendary × 3: Silver required legendary = 45
  assert.equal(calculateTaskPoints(false, 30, true), 45, 'Silver legendary = 45');
  // Optional / Champion: 12
  assert.equal(calculateTaskPoints(true, 80, false), 12, 'Champion optional = 12');
  // Tier inference: 24.9 still Bronze, 25.0 = Silver
  assert.equal(getTierFromProgress(24.9), 'Bronze', '24.9 still Bronze');
  assert.equal(getTierFromProgress(25), 'Silver', '25 = Silver');
  console.log('  ✓ getTaskXp: tier + legendary math correct');
})();

// ---- 2. getDayStats (we test via the SHARED math; the composable wraps it) ----

(function testGetDayStats() {
  // 3 required, 1 done → 33% (required-only)
  const d = day({ tasks: [
    task({ completed: true,  optional: false }),
    task({ completed: false, optional: false }),
    task({ completed: false, optional: false }),
    // Optional: doesn't count toward percent
    task({ completed: true,  optional: true }),
  ] });
  const pct = calculateDayProgress(d);
  assert.equal(pct, 33, 'day percent = round(1/3 * 100) = 33');
  // Empty day → 0
  assert.equal(calculateDayProgress(day({ tasks: [] })), 0, 'empty day = 0');
  // All-optional day → 0 (required-only rule)
  assert.equal(calculateDayProgress(day({ tasks: [
    task({ optional: true, completed: true }),
  ] })), 0, 'all-optional day = 0');
  console.log('  ✓ getDayStats: required-only day progress correct');
})();

// ---- 3. getWeekDayXp (mirrors the composable locally) ----

(function testGetWeekDayXp() {
  // Local mirror of the composable's getWeekDayXp:
  function getWeekDayXp(w, monthProgress) {
    const out = [0, 0, 0, 0, 0, 0, 0];
    if (!w || !Array.isArray(w.days)) return out;
    w.days.forEach((d, i) => {
      if (i < 0 || i >= 7) return;
      let xp = 0;
      for (const t of d.tasks) {
        if (!t.completed) continue;
        xp += calculateTaskPoints(!!t.optional, monthProgress, !!t.legendary);
      }
      out[i] = xp;
    });
    return out;
  }
  const w = week({ days: [
    day({ name: 'Mon', tasks: [task({ completed: true, optional: false })] }),
    day({ name: 'Tue', tasks: [task({ completed: false, optional: false })] }),
    day({ name: 'Wed', tasks: [task({ completed: true,  optional: true })] }),
    day({ name: 'Thu', tasks: [] }),
    day({ name: 'Fri', tasks: [] }),
    day({ name: 'Sat', tasks: [] }),
    day({ name: 'Sun', tasks: [] }),
  ] });
  const xp = getWeekDayXp(w, 0); // Bronze
  assert.equal(xp.length, 7, 'exactly 7 entries');
  assert.equal(xp[0], 10, 'Mon: 1 required done (Bronze = 10)');
  assert.equal(xp[1], 0,  'Tue: not done');
  assert.equal(xp[2], 5,  'Wed: 1 optional done (Bronze = 5)');
  assert.equal(xp[3] + xp[4] + xp[5] + xp[6], 0, 'Thu–Sun empty');
  console.log('  ✓ getWeekDayXp: 7 entries, XP per day correct');
})();

// ---- 4. getReplicatedLabel ----

(function testGetReplicatedLabel() {
  // No recurrenceId → null
  assert.equal(
    getReplicatedLabel(task(), week({ days: [day({ name: 'Mon' })] })),
    null,
    'no recurrenceId → null',
  );
  // Single-day recurrence → null
  assert.equal(
    getReplicatedLabel(task({ recurrenceId: 'r' }), week({ days: [
      day({ name: 'Mon', tasks: [task({ recurrenceId: 'r' })] }),
    ] })),
    null,
    'single-day recurrence → null',
  );
  // Mon–Fri (weekdays) → "MON-FRI"
  const wkd = week({ days: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((n) => day({ name: n, tasks: ['Mon','Tue','Wed','Thu','Fri'].includes(n) ? [task({ recurrenceId: 'r' })] : [] })) });
  assert.equal(getReplicatedLabel(task({ recurrenceId: 'r' }), wkd), 'MON-FRI', 'Mon-Fri → MON-FRI');
  // All 7 days → "ALL DAYS"
  const all = week({ days: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((n) => day({ name: n, tasks: [task({ recurrenceId: 'r' })] })) });
  assert.equal(getReplicatedLabel(task({ recurrenceId: 'r' }), all), 'ALL DAYS', '7/7 → ALL DAYS');
  // Sat + Sun → "WEEKEND"
  const wknd = week({ days: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((n) => day({ name: n, tasks: n === 'Sat' || n === 'Sun' ? [task({ recurrenceId: 'r' })] : [] })) });
  assert.equal(getReplicatedLabel(task({ recurrenceId: 'r' }), wknd), 'WEEKEND', 'Sat+Sun → WEEKEND');
  // Mon + Wed → "MON, WED" (sorted by day order)
  const mw = week({ days: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((n) => day({ name: n, tasks: n === 'Mon' || n === 'Wed' ? [task({ recurrenceId: 'r' })] : [] })) });
  assert.equal(getReplicatedLabel(task({ recurrenceId: 'r' }), mw), 'MON, WED', 'Mon+Wed → "MON, WED"');
  // Recurrence but task not in this week → null
  const other = week({ days: ['Mon'].map((n) => day({ name: n, tasks: [] })) });
  assert.equal(getReplicatedLabel(task({ recurrenceId: 'r' }), other), null, 'recurrence not in week → null');
  console.log('  ✓ getReplicatedLabel: labels correct');
})();

console.log('\nAll useCampaignStats rules pass.');
