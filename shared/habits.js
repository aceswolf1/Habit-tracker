/**
 * Habit identity helpers (D3 — v2.1 roadmap).
 *
 * A `habitId` identifies a recurring habit: a series of identical tasks
 * (by description) across the same cycle share one id, regardless of how
 * they were added (recurrence, clone, single). Old tasks without an id
 * get a fallback key derived from the normalized description until they're
 * next saved.
 *
 * Single source of truth — used by both backend (assignment + persist)
 * and frontend (keyed aggregations / streaks in v2.2+).
 */
'use strict';

/**
 * Trim + collapse internal whitespace + lowercase. The exact transform
 * that decides whether two descriptions name the same habit.
 *
 *   "  Read a   book  "  → "read a book"
 *   "Write\tMail"        → "write mail"
 */
function normalizeDescription(s) {
  if (typeof s !== 'string') return '';
  return s.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * The key an aggregation/streak helper uses to compare two tasks.
 * Prefer the explicit `habitId`; fall back to a name-based key for tasks
 * that haven't been written yet (D3: "Old tasks without one are linked
 * by name").
 *
 *   task = { habitId: 'h-abc', description: 'Read' }
 *     → 'h-abc'
 *   task = { description: 'Read a book' }
 *     → 'name:read a book'
 */
function habitKey(task) {
  if (task && typeof task.habitId === 'string' && task.habitId.length > 0) {
    return task.habitId;
  }
  const desc = task && typeof task.description === 'string' ? task.description : '';
  return `name:${normalizeDescription(desc)}`;
}

/**
 * Generate a fresh `h-…` id. Same base36 style as `progress.generateUuid`
 * so ids look uniform across the schema (c-, w-, d-, t-, h-, rec-).
 */
function newHabitId() {
  return `h-${Math.random().toString(36).slice(2)}`;
}

module.exports = {
  normalizeDescription,
  habitKey,
  newHabitId,
};
