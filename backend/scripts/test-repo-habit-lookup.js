'use strict';
/**
 * v2.2 regression: the REAL cycleRepository.findRecentCompletionForHabit must
 * return the LATEST completion ≤ beforeIso (the fake repo hid a bug where the
 * first match was kept, so a 3-day chain scored DOUBLE instead of TRIPLE).
 * Runs the repository against a stub `Cycle` model — no mongoose connection.
 */
const assert = require('assert');
const { createCycleRepository } = require('../repositories/cycleRepository');

const task = (uuid, completedOn, combo, extra = {}) => ({
  uuid, description: 'Pushups', habitId: 'h-1', completed: true, completedOn, combo, ...extra,
});
const docs = [
  { uuid: 'c-old', weeks: [{ days: [{ tasks: [task('t1', '2026-10-12', 1)] }] }] },
  {
    uuid: 'c-new',
    weeks: [{ days: [
      { tasks: [task('t2', '2026-10-13', 2)] },
      { tasks: [task('t3', '2026-10-14', 3)] },
      { tasks: [task('t4', '2026-10-20', 1)] },
      { tasks: [{ uuid: 't5', description: 'Other', habitId: 'h-2', completed: true, completedOn: '2026-10-14', combo: 9 }] },
    ] }],
  },
];
const Cycle = { find: () => ({ lean: async () => docs }) };
const repo = createCycleRepository({ Cycle });

let passed = 0;
async function check(name, fn) { await fn(); passed++; console.log(`PASS: ${name}`); }

(async () => {
  await check('latest completion on or before the date wins', async () => {
    const r = await repo.findRecentCompletionForHabit('h-1', '2026-10-15');
    assert.strictEqual(r.completedOn, '2026-10-14');
    assert.strictEqual(r.combo, 3);
  });
  await check('completions after the date are ignored', async () => {
    const r = await repo.findRecentCompletionForHabit('h-1', '2026-10-13');
    assert.strictEqual(r.completedOn, '2026-10-13');
    assert.strictEqual(r.combo, 2);
  });
  await check('the task being completed is excluded', async () => {
    const r = await repo.findRecentCompletionForHabit('h-1', '2026-10-14', { excludeUuid: 'c-new', excludeTaskUuid: 't3' });
    assert.strictEqual(r.completedOn, '2026-10-13');
  });
  await check('other habits never match', async () => {
    const r = await repo.findRecentCompletionForHabit('h-3', '2026-10-15');
    assert.strictEqual(r, null);
  });
  console.log(`\n${passed} checks passed`);
})().catch((err) => { console.error('FAIL:', err.message); process.exit(1); });
