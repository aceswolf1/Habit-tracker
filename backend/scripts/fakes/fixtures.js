'use strict';

/**
 * W3-qa fixture helpers — small builders used by every service test.
 * Tests build cycles via `shared/progress.createEmptyMonth` (the contract's
 * canonical factory) and then mutate via these helpers so the cycle shape
 * matches what the real services will see.
 *
 * Each helper either returns a fresh cycle or mutates in place (and returns
 * the cycle for chaining). Helpers never `await` because they don't touch
 * I/O — service tests wrap the mutation in a `cycleRepo.save` afterwards.
 */

const { createEmptyMonth } = require('../../../shared/progress');

/**
 * Create a fresh empty cycle. Pass-through to the contract's canonical
 * factory so test fixtures always match the BE shape.
 *
 * @param {string} [name]
 */
function emptyCycle(name) {
  return createEmptyMonth(name);
}

/**
 * Add a task to a specific (weekIdx, dayIdx). Returns the task object so
 * tests can capture its assigned uuid.
 *
 * @param {object} cycle
 * @param {number} weekIdx  0..3
 * @param {number} dayIdx   0..6
 * @param {object} task     plain task fields (uuid is auto-assigned if absent)
 */
function addTask(cycle, weekIdx, dayIdx, task) {
  if (!cycle || !cycle.weeks) throw new TypeError('addTask: cycle.weeks missing');
  const week = cycle.weeks[weekIdx];
  if (!week) throw new RangeError(`addTask: weekIdx ${weekIdx} out of range`);
  const day = week.days[dayIdx];
  if (!day) throw new RangeError(`addTask: dayIdx ${dayIdx} out of range`);
  const t = Object.assign({ order: day.tasks.length }, task);
  if (!t.uuid) t.uuid = `t-${cycle.uuid}-${week.uuid}-${day.uuid}-${day.tasks.length}`.slice(0, 128);
  day.tasks.push(t);
  return t;
}

/**
 * Convenience: build a cycle with N required tasks across day0 of week0.
 * Defaults to `optional: false, completed: false`. Pass an `overrides`
 * function to tweak each task.
 *
 * @param {number} n
 * @param {(t:object,i:number)=>object} [overrides]
 */
function cycleWithRequiredTasks(n, overrides) {
  const c = emptyCycle('Test');
  for (let i = 0; i < n; i++) {
    const t = { description: `t${i}`, optional: false, completed: false };
    addTask(c, 0, 0, overrides ? overrides(t, i) : t);
  }
  return c;
}

/**
 * Look up a day uuid at (weekIdx, dayIdx).
 */
function dayUuid(cycle, weekIdx, dayIdx) {
  return cycle.weeks[weekIdx].days[dayIdx].uuid;
}
function weekUuid(cycle, weekIdx) {
  return cycle.weeks[weekIdx].uuid;
}

/**
 * Reset all fakes in one shot — tests call this in afterEach.
 *
 * @param {{_reset?:Function}[]} fakes
 */
function resetAll(fakes) {
  for (const f of fakes) {
    if (f && typeof f._reset === 'function') f._reset();
  }
}

module.exports = {
  emptyCycle,
  addTask,
  cycleWithRequiredTasks,
  dayUuid,
  weekUuid,
  resetAll,
};