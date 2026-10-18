/**
 * v2.2: insights service — read-only analytics across ALL cycles.
 *
 * Computed on read from `cycleRepo.findAllForInsights()`. Nothing is
 * stored. The contract (development/v2-features/orchestration-ctx/
 * decisions/contract-v2.2.md §3) defines the response shape:
 *   - perfectDays     { current, longest }
 *   - finishedMonths  { total, streak }
 *   - habits[]        (top 20 by completions)
 *   - months[]        (chronological)
 *   - weekdayRates[7] (Mon..Sun % of tasks completed)
 *   - combatLog[]     (last 7 days by completedOn, newest first, max 100)
 *
 * Layers (W3 contract): controllers → services → repositories. No HTTP,
 * no mongoose. Pure derivation from cycles.
 */
'use strict';

const { habitKey } = require('../../shared/habits');
const { comboName, daysBetween } = require('../../shared/combos');
const { todayIso } = require('../../shared/dates');

const COMBO_LIVE_DAYS = 2;
const COMBAT_LOG_DAYS = 7;
const COMBAT_LOG_MAX = 100;
const HABITS_TOP = 20;

/**
 * Build an insights service bound to the cycle repo.
 *
 * @param {{
 *   cycleRepo: { findAllForInsights(): Promise<object[]> },
 * }} deps
 */
function createInsightsService({ cycleRepo }) {
  if (!cycleRepo) {
    throw new Error('createInsightsService requires { cycleRepo }');
  }

  /**
   * Compute the full insights payload for the player.
   *
   * @param {object} [opts]
   * @param {string} [opts.today]  injectable 'YYYY-MM-DD' for tests
   * @param {number} [opts.now]    injectable epoch ms (informational)
   */
  async function compute(opts) {
    const today = (opts && opts.today) || todayIso();
    const cycles = await cycleRepo.findAllForInsights();

    const sortedCycles = sortChronologically(cycles);

    const perfectDays = computePerfectDays(sortedCycles);
    const finishedMonths = computeFinishedMonths(sortedCycles);
    const habits = computeHabits(cycles, today);
    const months = computeMonthsList(sortedCycles);
    const weekdayRates = computeWeekdayRates(cycles);
    const combatLog = computeCombatLog(cycles, today);

    return {
      perfectDays,
      finishedMonths,
      habits,
      months,
      weekdayRates,
      combatLog,
    };
  }

  return { compute };
}

// ---- internal helpers ----------------------------------------------------

function sortChronologically(cycles) {
  // Stable sort: cycles with `startDate` come first (oldest first); then
  // cycles sorted by `createdAt`. Undated cycles keep insertion order at
  // the end so weeks/days inside still walk correctly.
  return [...cycles].sort((a, b) => {
    const ax = (a && a.startDate) || '';
    const bx = (b && b.startDate) || '';
    if (ax && bx) return ax < bx ? -1 : ax > bx ? 1 : 0;
    if (ax) return -1;
    if (bx) return 1;
    const ac = a && a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bc = b && b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return ac - bc;
  });
}

/**
 * Perfect-day rules (E5): every required task on that day done. Days
 * with NO tasks are skipped and don't break the streak.
 */
function computePerfectDays(cycles) {
  let longest = 0;
  let activeStreak = 0; // runs through no-task days without resetting

  for (const cycle of cycles) {
    if (!cycle || !cycle.weeks) continue;
    for (const week of cycle.weeks) {
      for (const day of week.days || []) {
        const tasks = (day && day.tasks) || [];
        let requiredTotal = 0;
        let requiredDone = 0;
        let hasAnyTask = false;
        for (const t of tasks) {
          hasAnyTask = true;
          if (!t.optional) {
            requiredTotal++;
            if (t.completed) requiredDone++;
          }
        }
        if (!hasAnyTask) {
          // No-task day: skip but preserve streak state.
          continue;
        }
        if (requiredTotal > 0 && requiredDone === requiredTotal) {
          activeStreak++;
          if (activeStreak > longest) longest = activeStreak;
        } else {
          activeStreak = 0;
        }
      }
    }
  }
  // `current` is the live streak at the END of the chronological walk.
  // No-task days preserve the streak; non-perfect days reset it.
  return { current: activeStreak, longest };
}

function computeFinishedMonths(cycles) {
  let total = 0;
  let streak = 0;
  let activeStreak = 0;
  for (const c of sortChronologically(cycles)) {
    if (!c || !c.finished) {
      activeStreak = 0;
      continue;
    }
    total++;
    activeStreak++;
    if (activeStreak > streak) streak = activeStreak;
  }
  return { total, streak };
}

/**
 * Aggregate habits across all cycles (top 20 by completions). Each
 * habit row: { habitKey, name, completions, currentCombo, bestCombo,
 * lastCompletedOn }.
 *
 * `currentCombo` is the latest completion's combo if
 * `daysBetween(lastCompletedOn, today) <= 2`, else 0.
 * `bestCombo` is the max stored `combo` for this habitKey.
 */
function computeHabits(cycles, today) {
  /** @type {Map<string, {
   *   habitKey: string,
   *   name: string,
   *   completions: number,
   *   currentCombo: number,
   *   bestCombo: number,
   *   lastCompletedOn: string|null,
   * }>} */
  const byKey = new Map();

  for (const cycle of cycles) {
    if (!cycle || !cycle.weeks) continue;
    for (const week of cycle.weeks) {
      for (const day of week.days || []) {
        for (const task of day.tasks || []) {
          // Count every completed task (older completions have no
          // completedOn); dates only drive lastCompletedOn / currentCombo.
          if (!task.completed) continue;
          const key = habitKey(task);
          let row = byKey.get(key);
          if (!row) {
            row = {
              habitKey: key,
              name: task.description || key,
              completions: 0,
              currentCombo: 0,
              bestCombo: 0,
              lastCompletedOn: null,
            };
            byKey.set(key, row);
          }
          row.completions++;
          const combo = task.combo || 1;
          if (task.completedOn && combo > row.bestCombo) row.bestCombo = combo;
          if (task.completedOn && (!row.lastCompletedOn || task.completedOn > row.lastCompletedOn)) {
            row.lastCompletedOn = task.completedOn;
            // `currentCombo` is derived from the latest completion;
            // overwritten below once we've fully walked.
            row.currentCombo = combo;
          }
        }
      }
    }
  }

  // Apply the 2-day window to currentCombo.
  for (const row of byKey.values()) {
    if (!row.lastCompletedOn) {
      row.currentCombo = 0;
      continue;
    }
    const diff = daysBetween(row.lastCompletedOn, today);
    row.currentCombo = (Number.isFinite(diff) && diff >= 0 && diff <= COMBO_LIVE_DAYS)
      ? row.currentCombo : 0;
  }

  const rows = Array.from(byKey.values());
  rows.sort((a, b) => b.completions - a.completions);
  return rows.slice(0, HABITS_TOP);
}

function computeMonthsList(sortedCycles) {
  return sortedCycles.map((c) => {
    let progress = 0;
    let score = 0;
    let perfectDays = 0;
    let completionRate = 0;
    if (c && c.weeks) {
      // Reuse the month-level rollups the controller already maintains,
      // but fall back to deriving them when missing (legacy cycles).
      progress = Math.round(c.progress || 0);
      score = Math.round(c.score || 0);
      let requiredTotal = 0;
      let requiredDone = 0;
      for (const week of c.weeks) {
        for (const day of week.days || []) {
          let dayReqTotal = 0;
          let dayReqDone = 0;
          let dayHasAny = false;
          for (const t of day.tasks || []) {
            dayHasAny = true;
            if (!t.optional) {
              dayReqTotal++;
              requiredTotal++;
              if (t.completed) {
                dayReqDone++;
                requiredDone++;
              }
            }
          }
          if (dayHasAny && dayReqTotal > 0 && dayReqDone === dayReqTotal) {
            perfectDays++;
          }
        }
      }
      completionRate = requiredTotal > 0
        ? Math.round((requiredDone / requiredTotal) * 100)
        : 0;
    }
    return {
      uuid: c.uuid,
      name: c.name || '',
      startDate: c.startDate || null,
      finished: !!c.finished,
      progress,
      score,
      perfectDays,
      completionRate,
    };
  });
}

function computeWeekdayRates(cycles) {
  // Mon..Sun → { total, completed }. Weekday = dayIndex within the week
  // (0 = Mon, 6 = Sun). For undated cycles we just trust the dayIndex
  // (the FE doesn't change day order on legacy months either).
  const buckets = Array.from({ length: 7 }, () => ({ total: 0, completed: 0 }));
  for (const c of cycles) {
    if (!c || !c.weeks) continue;
    for (const week of c.weeks) {
      const days = week.days || [];
      for (let dIdx = 0; dIdx < days.length && dIdx < 7; dIdx++) {
        const day = days[dIdx];
        for (const t of day.tasks || []) {
          buckets[dIdx].total++;
          if (t.completed) buckets[dIdx].completed++;
        }
      }
    }
  }
  return buckets.map((b) => (b.total > 0 ? Math.round((b.completed / b.total) * 100) : 0));
}

/**
 * Combat log (E6): today's completions + last 7 days by completedOn.
 * Newest first, max 100 entries. `xp` = approximate base (at
 * `month.progress` / 100 tier) + `comboBonus` (current).
 */
function computeCombatLog(cycles, today) {
  const start = daysAgoIso(today, COMBAT_LOG_DAYS);
  const entries = [];
  for (const c of cycles) {
    if (!c || !c.weeks) continue;
    for (const week of c.weeks) {
      for (const day of week.days || []) {
        for (const t of day.tasks || []) {
          if (!t.completed || !t.completedOn) continue;
          if (t.completedOn > today) continue;
          if (t.completedOn < start) continue;
          entries.push(buildCombatLogEntry(t, c));
        }
      }
    }
  }
  entries.sort((a, b) => {
    if (b.completedOn !== a.completedOn) return b.completedOn < a.completedOn ? -1 : 1;
    // Newer completedAt first within the same day.
    const ac = a.completedAt ? new Date(a.completedAt).getTime() : 0;
    const bc = b.completedAt ? new Date(b.completedAt).getTime() : 0;
    return bc - ac;
  });
  return entries.slice(0, COMBAT_LOG_MAX);
}

function buildCombatLogEntry(task, cycle) {
  const tier = task.optional ? 'optional' : 'required';
  // Approximate base at the cycle's tier. Recompute the progress from
  // the cycle's tasks so the stored `cycle.progress` (which can lag) is
  // not the source of truth for the UI.
  const progress = computeCycleProgress(cycle);
  let base = 10;
  if (progress >= 100) base = tier === 'required' ? 30 : 15;
  else if (progress >= 75) base = tier === 'required' ? 25 : 12;
  else if (progress >= 50) base = tier === 'required' ? 20 : 10;
  else if (progress >= 25) base = tier === 'required' ? 15 : 7;
  if (task.legendary) base *= 3;
  const bonus = task.comboBonus || 0;
  const xp = base + bonus;
  const combo = task.combo || null;
  return {
    completedAt: task.completedAt
      ? new Date(task.completedAt).toISOString()
      : null,
    completedOn: task.completedOn,
    taskUuid: task.uuid,
    description: task.description || '',
    xp,
    combo,
    comboName: comboName(combo),
    cycleUuid: cycle.uuid,
  };
}

/**
 * Recompute a cycle's progress percentage from its tasks (avg of week
 * percentages, required-only). Mirrors the production formula
 * loosely so the insights view doesn't depend on stored `cycle.progress`
 * being current.
 */
function computeCycleProgress(cycle) {
  if (!cycle || !cycle.weeks) return 0;
  let total = 0;
  let count = 0;
  for (const week of cycle.weeks) {
    let reqTotal = 0;
    let reqDone = 0;
    let hasAny = false;
    for (const day of week.days || []) {
      for (const t of day.tasks || []) {
        hasAny = true;
        if (!t.optional) {
          reqTotal++;
          if (t.completed) reqDone++;
        }
      }
    }
    if (hasAny && reqTotal > 0) {
      total += Math.round((reqDone / reqTotal) * 100);
      count++;
    } else if (hasAny) {
      total += 0;
      count++;
    }
  }
  return count > 0 ? Math.round(total / count) : 0;
}

/**
 * Return the ISO date `n` days before `iso` (UTC noon math).
 */
function daysAgoIso(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const t = Date.UTC(y, m - 1, d, 12, 0, 0) - n * 86_400_000;
  const dt = new Date(t);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

// Re-export for direct unit testing if needed.
module.exports = {
  createInsightsService,
  // helpers exposed for tests
  sortChronologically,
  computePerfectDays,
  computeFinishedMonths,
  computeHabits,
  computeMonthsList,
  computeWeekdayRates,
  computeCombatLog,
};