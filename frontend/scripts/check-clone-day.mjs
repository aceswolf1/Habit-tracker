#!/usr/bin/env node
/**
 * check-clone-day.mjs
 *
 * Standalone Node script that exercises the pure helpers in
 * `frontend/utils/cloneDay.ts` (loaded via esbuild via tsc, or via
 * a small ESM wrapper — we use the latter for portability). The
 * `monthStore.cloneDayTasks` method delegates all of its logic to
 * `buildCloneAdditions`, so testing the helper end-to-end proves
 * the action's behavior too.
 *
 * The script is intentionally framework-free (no Vue, no Pinia) so
 * it can run in CI without a Nuxt build.
 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';

const requireCjs = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');

const tsPath = path.join(repoRoot, 'frontend', 'utils', 'cloneDay.ts');
const tsSource = readFileSync(tsPath, 'utf8');

// Transpile TS → ESM on the fly so the helpers can be `import`ed as plain JS.
const { code: jsSource } = transformSync(tsSource, {
  loader: 'ts',
  format: 'esm',
  target: 'es2022',
});

// Persist to a tmp file then import it.
const tmp = path.join(here, '__clone-day-tmp.mjs');
requireCjs('node:fs').writeFileSync(tmp, jsSource);
const cloneMod = await import(`file://${tmp}`);
process.on('exit', () => {
  try { requireCjs('node:fs').unlinkSync(tmp); } catch {}
});

const {
  buildCloneAdditions,
  appendClonedTasksToCycle,
  expectedCloneCount,
  taskFingerprint,
  cloneTaskFromSource,
  findDayInWeeks,
} = cloneMod;

let passed = 0;
function check(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`PASS: ${name}`);
  } catch (err) {
    console.error(`FAIL: ${name}`);
    console.error(err?.message ?? err);
    process.exit(1);
  }
}

// ---- minimal fixture factory (no Nuxt types) ---------------------------
function emptyCycle(weekCount = 1) {
  return {
    weeks: Array.from({ length: weekCount }, (_, wIdx) => ({
      uuid: `w-${wIdx}`,
      name: `WEEK ${wIdx + 1}`,
      subtitle: '',
      progress: 0,
      conquered: false,
      days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((n, dIdx) => ({
        uuid: `d-${wIdx}-${dIdx}`,
        name: n,
        subtitle: '',
        tasks: [],
      })),
    })),
  };
}

function addTask(cycle, wIdx, dIdx, t) {
  cycle.weeks[wIdx].days[dIdx].tasks.push(t);
}

// ---- taskFingerprint ----------------------------------------------------

check('taskFingerprint: same description+optional+legendary+icon+gifUrl → same key', () => {
  const a = { description: 'Walk', optional: false, legendary: true, icon: '🏃', gifUrl: 'https://x/a.gif' };
  const b = { description: 'Walk', optional: false, legendary: true, icon: '🏃', gifUrl: 'https://x/a.gif' };
  assert.strictEqual(taskFingerprint(a), taskFingerprint(b));
});

check('taskFingerprint: different description → different key', () => {
  const a = { description: 'Walk', optional: false, legendary: true, icon: '🏃', gifUrl: 'https://x/a.gif' };
  const b = { ...a, description: 'Run' };
  assert.notStrictEqual(taskFingerprint(a), taskFingerprint(b));
});

check('taskFingerprint: different gifUrl → different key (matches contract)', () => {
  const a = { description: 'Walk', optional: false, legendary: true, icon: '🏃', gifUrl: 'https://x/a.gif' };
  const b = { ...a, gifUrl: 'https://x/b.gif' };
  assert.notStrictEqual(taskFingerprint(a), taskFingerprint(b));
});

// ---- cloneTaskFromSource -----------------------------------------------

check('cloneTaskFromSource: new uuid; completed reset to false; notes preserved; no recurrenceId', () => {
  const src = {
    uuid: 't-src',
    description: 'Walk',
    optional: false,
    legendary: true,
    completed: true,
    recurrenceId: 'rec-1',
    icon: '🏃',
    gifUrl: 'https://x/a.gif',
    gifVideoUrl: 'https://x/a.mp4',
    gifStillUrl: 'https://x/a.jpg',
    notes: 'morning',
  };
  const c = cloneTaskFromSource(src);
  assert.notStrictEqual(c.uuid, src.uuid);
  assert.ok(c.uuid.startsWith('t-'));
  assert.strictEqual(c.completed, false);
  assert.strictEqual(c.description, 'Walk');
  assert.strictEqual(c.optional, false);
  assert.strictEqual(c.legendary, true);
  assert.strictEqual(c.icon, '🏃');
  assert.strictEqual(c.gifUrl, 'https://x/a.gif');
  assert.strictEqual(c.notes, 'morning');
  assert.ok(!('recurrenceId' in c) || c.recurrenceId === undefined,
    'clone must not carry a recurrenceId');
});

// ---- findDayInWeeks -----------------------------------------------------

check('findDayInWeeks: returns the matching day across weeks', () => {
  const c = emptyCycle(2);
  const d = findDayInWeeks(c.weeks, 'd-1-3');
  assert.ok(d);
  assert.strictEqual(d.name, 'Thu');
});

check('findDayInWeeks: returns null for unknown uuid', () => {
  const c = emptyCycle();
  assert.strictEqual(findDayInWeeks(c.weeks, 'd-ghost'), null);
});

// ---- buildCloneAdditions ------------------------------------------------

check('buildCloneAdditions: 5-task Monday → 4 target days = 20 additions, ONE batch', () => {
  const c = emptyCycle();
  for (let i = 0; i < 5; i++) {
    addTask(c, 0, 0, { uuid: `t-m-${i}`, description: `M${i}`, optional: false });
  }
  const targets = ['d-0-1', 'd-0-2', 'd-0-3', 'd-0-4'];
  const { additions, skippedDuplicates } = buildCloneAdditions({
    weeks: c.weeks,
    sourceDayUuid: 'd-0-0',
    targetDayUuids: targets,
  });
  assert.strictEqual(additions.length, 20, '5 source × 4 targets = 20 additions');
  assert.strictEqual(skippedDuplicates, 0, 'no duplicates on empty targets');
  // weekUuid is filled in by the helper.
  for (const a of additions) {
    assert.strictEqual(a.weekUuid, 'w-0');
    assert.ok(targets.includes(a.dayUuid));
  }
});

check('buildCloneAdditions: re-running adds 0 (dedup catches all)', () => {
  const c = emptyCycle();
  for (let i = 0; i < 5; i++) {
    addTask(c, 0, 0, { uuid: `t-m-${i}`, description: `M${i}`, optional: false });
  }
  const targets = ['d-0-1', 'd-0-2', 'd-0-3', 'd-0-4'];
  // First run adds 20; apply them to the cycle, then re-run.
  const { additions } = buildCloneAdditions({
    weeks: c.weeks, sourceDayUuid: 'd-0-0', targetDayUuids: targets,
  });
  appendClonedTasksToCycle(c.weeks, additions);
  // Now every target day has the same 5 tasks as the source → all dedup.
  const second = buildCloneAdditions({
    weeks: c.weeks, sourceDayUuid: 'd-0-0', targetDayUuids: targets,
  });
  assert.strictEqual(second.additions.length, 0, 'duplicate run adds 0');
  assert.strictEqual(second.skippedDuplicates, 20, 'all 20 skipped as duplicates');
});

check('buildCloneAdditions: empty source day → 0 additions, 0 errors', () => {
  const c = emptyCycle();
  const { additions } = buildCloneAdditions({
    weeks: c.weeks, sourceDayUuid: 'd-0-0', targetDayUuids: ['d-0-1'],
  });
  assert.strictEqual(additions.length, 0);
});

check('buildCloneAdditions: missing target day uuid → silently dropped', () => {
  const c = emptyCycle();
  addTask(c, 0, 0, { uuid: 't-a', description: 'A', optional: false });
  const { additions } = buildCloneAdditions({
    weeks: c.weeks, sourceDayUuid: 'd-0-0', targetDayUuids: ['d-ghost'],
  });
  assert.strictEqual(additions.length, 0);
});

check('buildCloneAdditions: same uuid on target list twice → deduped within that run', () => {
  const c = emptyCycle();
  addTask(c, 0, 0, { uuid: 't-a', description: 'A', optional: false });
  const { additions } = buildCloneAdditions({
    weeks: c.weeks, sourceDayUuid: 'd-0-0', targetDayUuids: ['d-0-1', 'd-0-1'],
  });
  assert.strictEqual(additions.length, 1, 'one insertion per target day');
});

check('buildCloneAdditions: cloned tasks get fresh uuids (not the source uuid)', () => {
  const c = emptyCycle();
  addTask(c, 0, 0, { uuid: 't-source-uuid', description: 'A', optional: false });
  const { additions } = buildCloneAdditions({
    weeks: c.weeks, sourceDayUuid: 'd-0-0', targetDayUuids: ['d-0-1'],
  });
  assert.notStrictEqual(additions[0].task.uuid, 't-source-uuid');
  assert.ok(additions[0].task.uuid.startsWith('t-'));
});

check('buildCloneAdditions: notes/icon/gifUrl are preserved on the clone', () => {
  const c = emptyCycle();
  addTask(c, 0, 0, {
    uuid: 't-a', description: 'A', optional: false, legendary: true,
    icon: '🏃', gifUrl: 'https://x/a.gif', gifVideoUrl: 'https://x/a.mp4', gifStillUrl: 'https://x/a.jpg',
    notes: 'morning memo',
  });
  const { additions } = buildCloneAdditions({
    weeks: c.weeks, sourceDayUuid: 'd-0-0', targetDayUuids: ['d-0-1'],
  });
  assert.strictEqual(additions[0].task.icon, '🏃');
  assert.strictEqual(additions[0].task.gifUrl, 'https://x/a.gif');
  assert.strictEqual(additions[0].task.gifVideoUrl, 'https://x/a.mp4');
  assert.strictEqual(additions[0].task.gifStillUrl, 'https://x/a.jpg');
  assert.strictEqual(additions[0].task.notes, 'morning memo');
});

check('buildCloneAdditions: source day as target → silently skipped', () => {
  const c = emptyCycle();
  addTask(c, 0, 0, { uuid: 't-a', description: 'A', optional: false });
  const { additions } = buildCloneAdditions({
    weeks: c.weeks, sourceDayUuid: 'd-0-0', targetDayUuids: ['d-0-0'],
  });
  assert.strictEqual(additions.length, 0);
});

// ---- expectedCloneCount -------------------------------------------------

check('expectedCloneCount: 5-task Monday × 4 target days = 20', () => {
  const c = emptyCycle();
  for (let i = 0; i < 5; i++) {
    addTask(c, 0, 0, { uuid: `t-m-${i}`, description: `M${i}`, optional: false });
  }
  assert.strictEqual(
    expectedCloneCount({ weeks: c.weeks, sourceDayUuid: 'd-0-0', targetDayUuids: ['d-0-1', 'd-0-2', 'd-0-3', 'd-0-4'] }),
    20
  );
});

check('expectedCloneCount: empty source day = 0', () => {
  const c = emptyCycle();
  assert.strictEqual(
    expectedCloneCount({ weeks: c.weeks, sourceDayUuid: 'd-0-0', targetDayUuids: ['d-0-1'] }),
    0
  );
});

console.log(`\n${passed} checks passed`);
process.exit(0);
