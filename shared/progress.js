/**
 * Shared progress + empty-month helpers (CJS).
 * Single source of truth for BE (cycleRoutes) and FE (Nuxt #shared alias).
 *
 * Progress rules:
 * - Week: required (non-optional) tasks only → % + conquered
 * - Month: average of week.progress values
 * - When base month progress === 100, optional tasks add +2% each (cap +10)
 * - Final month progress capped at 110
 */

'use strict';

function generateUuid(prefix = 'c') {
  return `${prefix}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Mutates cycle in place (matches historical BE/FE behavior used with Mongoose docs).
 * @param {object} cycle
 */
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

    if (weekTotalTasks > 0) {
      week.progress = Math.round((weekCompletedTasks / weekTotalTasks) * 100);
      week.conquered = weekCompletedTasks === weekTotalTasks;
    } else {
      week.progress = 0;
      week.conquered = false;
    }
  }

  const weekCount = cycle.weeks.length;
  if (weekCount === 0) {
    cycle.progress = 0;
    return;
  }

  const totalWeekProgress = cycle.weeks.reduce((sum, w) => sum + (w.progress || 0), 0);
  const baseMonthProgress = Math.round(totalWeekProgress / weekCount);

  let bonus = 0;
  if (baseMonthProgress === 100) {
    let optionalCompleted = 0;
    for (const week of cycle.weeks) {
      for (const day of week.days) {
        optionalCompleted += day.tasks.filter((t) => t.optional && t.completed).length;
      }
    }
    bonus = Math.min(10, optionalCompleted * 2);
  }

  cycle.progress = Math.min(110, baseMonthProgress + bonus);
}

/**
 * Create a new empty month structure (4 weeks × 7 days).
 * @param {string} [name]
 * @returns {object}
 */
function createEmptyMonth(name) {
  const monthName =
    name || new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
  const weeks = [];
  const dayNames = [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
  ];

  for (let weekNum = 1; weekNum <= 4; weekNum++) {
    const days = [];
    for (let dayNum = 0; dayNum < 7; dayNum++) {
      days.push({
        uuid: generateUuid('d'),
        name: dayNames[dayNum],
        subtitle: `Day ${dayNum + 1}`,
        tasks: [],
      });
    }

    weeks.push({
      uuid: generateUuid('w'),
      name: `Week ${weekNum}`,
      subtitle: `Week ${weekNum} of the month`,
      progress: 0,
      conquered: false,
      days,
    });
  }

  return {
    uuid: generateUuid('m'),
    name: monthName,
    subtitle: 'Your journey begins',
    progress: 0,
    weeks,
    finished: false,
    createdAt: new Date(),
  };
}

module.exports = {
  generateUuid,
  calculateProgress,
  createEmptyMonth,
};
