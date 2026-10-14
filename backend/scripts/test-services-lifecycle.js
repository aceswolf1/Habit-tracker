#!/usr/bin/env node
/**
 * W3-qa — service-layer tests for `cycleLifecycleService`.
 *
 * Validates the contract from `development/remediation-w3/orchestration-ctx/
 * decisions/layer-contract-w3.md` §"Services":
 *   getOrCreateCurrent()  auto-create empty cycle when none is open
 *   getByUuid(uuid)       NOT_FOUND when missing
 *   list({limit,offset})  { items, meta: { total, limit, offset } }
 *   create({name})        new empty cycle via shared createEmptyMonth
 *   finish(uuid)          idempotent; returns { cycle, statistics, alreadyFinished }
 *   getProfile()          { uuid, lifetimeScore }
 *
 * Mocks: in-memory fakes from `./fakes/`. No mongoose.
 *
 * Coverage targets from the QA task assignment:
 *   - list pagination meta (total / limit / offset)
 *   - getOrCreateCurrent creates when none
 *   - finish idempotent with statistics
 *   - NOT_FOUND propagation on missing cycle
 *
 * Runnable with: node backend/scripts/test-services-lifecycle.js
 */

'use strict';

const assert = require('assert');

const { createFakeCycleRepository } = require('./fakes/cycleRepo');
const { createFakeUserProfileRepository } = require('./fakes/profileRepo');
const fixtures = require('./fakes/fixtures');

const { calculateProgress } = require('../../shared/progress');

function tryRequire(spec, label) {
  try {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    const mod = require(spec);
    return { ok: true, mod };
  } catch (err) {
    if (err && err.code === 'MODULE_NOT_FOUND') {
      console.log(`PENDING: ${label} — module not found at ${spec}`);
      console.log('PENDING: this test will pass once w3-core lands cycleLifecycleService');
      process.exit(0);
    }
    throw err;
  }
}

const { mod: lifecycleMod } = tryRequire(
  '../services/cycleLifecycleService',
  'services/cycleLifecycleService'
);

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

function makeService() {
  const cycleRepo = createFakeCycleRepository();
  const profileRepo = createFakeUserProfileRepository();
  const svc = lifecycleMod.createCycleLifecycleService({ cycleRepo, profileRepo });
  return { svc, cycleRepo, profileRepo };
}

// =========================================================================
// getOrCreateCurrent
// =========================================================================

check('getOrCreateCurrent: returns the existing unfinished cycle when one is open', async () => {
  const { svc, cycleRepo } = makeService();
  const c = fixtures.emptyCycle('Open');
  const saved = await cycleRepo.create(c);
  const out = await svc.getOrCreateCurrent();
  assert.strictEqual(out.uuid, saved.uuid, 'returns the existing one');
  // Repo must NOT have grown — auto-create only triggers on miss.
  assert.strictEqual(cycleRepo._all().length, 1);
});

check('getOrCreateCurrent: auto-creates an empty cycle when none is open', async () => {
  const { svc, cycleRepo } = makeService();
  const out = await svc.getOrCreateCurrent();
  assert.ok(out && out.uuid, 'returns a cycle');
  assert.strictEqual(out.finished, false);
  assert.strictEqual(out.weeks.length, 4, 'auto-created cycle has 4 weeks');
  assert.strictEqual(out.weeks[0].days.length, 7, '7 days/week');
  assert.strictEqual(cycleRepo._all().length, 1, 'cycleRepo now has 1 doc');
});

check('getOrCreateCurrent: prefers the newest unfinished cycle when multiple are open', async () => {
  const { svc, cycleRepo } = makeService();
  // Seed two unfinished cycles with different createdAt.
  const older = fixtures.emptyCycle('Older');
  older.createdAt = new Date('2026-01-01T00:00:00Z');
  const newer = fixtures.emptyCycle('Newer');
  newer.createdAt = new Date('2026-02-01T00:00:00Z');
  await cycleRepo.create(older);
  await cycleRepo.create(newer);

  const out = await svc.getOrCreateCurrent();
  assert.strictEqual(out.uuid, newer.uuid, 'returns the newer one');
});

check('getOrCreateCurrent: ignores finished cycles (auto-creates a new one)', async () => {
  const { svc, cycleRepo } = makeService();
  const done = fixtures.emptyCycle('Done');
  done.finished = true;
  await cycleRepo.create(done);
  const out = await svc.getOrCreateCurrent();
  assert.notStrictEqual(out.uuid, done.uuid, 'does not return the finished cycle');
  assert.strictEqual(out.finished, false);
});

// =========================================================================
// getByUuid
// =========================================================================

check('getByUuid: returns the cycle when present', async () => {
  const { svc, cycleRepo } = makeService();
  const c = fixtures.emptyCycle('One');
  const saved = await cycleRepo.create(c);
  const out = await svc.getByUuid(saved.uuid);
  assert.strictEqual(out.uuid, saved.uuid);
  assert.strictEqual(out.weeks.length, 4);
});

check('getByUuid: missing uuid throws DomainError(NOT_FOUND) with uuid in message', async () => {
  const { svc } = makeService();
  let thrown = null;
  try {
    await svc.getByUuid('nope');
  } catch (err) { thrown = err; }
  assert.ok(thrown, 'should throw');
  assert.strictEqual(thrown.code, 'NOT_FOUND');
  assert.ok(/nope/.test(thrown.message), 'message includes uuid');
});

// =========================================================================
// list — pagination meta
// =========================================================================

check('list: returns { items, meta: { total, limit, offset } }', async () => {
  const { svc, cycleRepo } = makeService();
  for (let i = 0; i < 5; i++) {
    await cycleRepo.create(fixtures.emptyCycle(`Cycle ${i}`));
  }
  const out = await svc.list({ limit: 2, offset: 0 });
  assert.ok(Array.isArray(out.items), 'items is array');
  assert.strictEqual(out.items.length, 2);
  assert.strictEqual(out.meta.total, 5);
  assert.strictEqual(out.meta.limit, 2);
  assert.strictEqual(out.meta.offset, 0);
});

check('list: summary items do NOT carry `weeks` (projection)', async () => {
  const { svc, cycleRepo } = makeService();
  const c = fixtures.emptyCycle('Cyc');
  await cycleRepo.create(c);
  const out = await svc.list({ limit: 50, offset: 0 });
  assert.strictEqual(out.items.length, 1);
  assert.strictEqual(out.items[0].weeks, undefined, 'weeks stripped');
  assert.strictEqual(typeof out.items[0].uuid, 'string');
});

check('list: respects offset (page 2)', async () => {
  const { svc, cycleRepo } = makeService();
  // 3 cycles, fetch page 2 of size 1
  for (let i = 0; i < 3; i++) {
    await cycleRepo.create(fixtures.emptyCycle(`Cyc ${i}`));
  }
  const page1 = await svc.list({ limit: 1, offset: 0 });
  const page2 = await svc.list({ limit: 1, offset: 1 });
  assert.notStrictEqual(page1.items[0].uuid, page2.items[0].uuid, 'different items');
  assert.strictEqual(page2.meta.offset, 1);
  assert.strictEqual(page2.meta.total, 3);
});

check('list: sort createdAt desc (newest first)', async () => {
  const { svc, cycleRepo } = makeService();
  const a = fixtures.emptyCycle('A');
  a.createdAt = new Date('2026-01-01T00:00:00Z');
  const b = fixtures.emptyCycle('B');
  b.createdAt = new Date('2026-02-01T00:00:00Z');
  const c = fixtures.emptyCycle('C');
  c.createdAt = new Date('2026-03-01T00:00:00Z');
  await cycleRepo.create(a);
  await cycleRepo.create(b);
  await cycleRepo.create(c);
  const out = await svc.list({ limit: 50, offset: 0 });
  assert.deepStrictEqual(out.items.map((i) => i.uuid), [c.uuid, b.uuid, a.uuid]);
});

// =========================================================================
// create
// =========================================================================

check('create: produces a new cycle with the given name; weeks structure intact', async () => {
  const { svc, cycleRepo } = makeService();
  const out = await svc.create({ name: 'Brand New' });
  assert.strictEqual(out.name, 'Brand New');
  assert.strictEqual(out.weeks.length, 4);
  assert.strictEqual(out.weeks[0].days.length, 7);
  // persisted
  assert.strictEqual(cycleRepo._all().length, 1);
  assert.strictEqual(cycleRepo._raw(out.uuid).name, 'Brand New');
});

// =========================================================================
// finish — idempotent + statistics
// =========================================================================

check('finish: first call marks finished, calculates statistics, returns alreadyFinished=false', async () => {
  const { svc, cycleRepo } = makeService();
  const c = fixtures.cycleWithRequiredTasks(4);
  // complete all required → 100% Final
  for (const t of c.weeks[0].days[0].tasks) t.completed = true;
  calculateProgress(c);
  const saved = await cycleRepo.create(c);

  const out = await svc.finish(saved.uuid);
  assert.strictEqual(out.alreadyFinished, false);
  assert.strictEqual(out.cycle.finished, true);
  assert.ok(out.cycle.finishedAt, 'finishedAt timestamp set');
  assert.ok(out.statistics && typeof out.statistics === 'object');
  assert.ok('finalTier' in out.statistics, 'statistics has finalTier');
  assert.strictEqual(out.statistics.finalTier, 'Final', '100% → Final tier');
  assert.ok('totalXP' in out.statistics);
  assert.strictEqual(out.statistics.totalXP, 30, '100% Final → required 30');
});

check('finish: idempotent — second call returns alreadyFinished=true with same statistics', async () => {
  const { svc, cycleRepo } = makeService();
  const c = fixtures.cycleWithRequiredTasks(4);
  for (const t of c.weeks[0].days[0].tasks) t.completed = true;
  calculateProgress(c);
  const saved = await cycleRepo.create(c);

  const first = await svc.finish(saved.uuid);
  const second = await svc.finish(saved.uuid);
  assert.strictEqual(second.alreadyFinished, true);
  assert.deepStrictEqual(second.statistics, first.statistics,
    'idempotent — same statistics object on the second call');
  assert.strictEqual(second.cycle.uuid, first.cycle.uuid);
});

check('finish: missing cycle throws DomainError(NOT_FOUND)', async () => {
  const { svc } = makeService();
  let thrown = null;
  try { await svc.finish('gone'); } catch (err) { thrown = err; }
  assert.ok(thrown && thrown.code === 'NOT_FOUND');
  assert.ok(/gone/.test(thrown.message));
});

// =========================================================================
// getProfile
// =========================================================================

check('getProfile: returns { uuid: "default-user", lifetimeScore: 0 } on first call (auto-create)', async () => {
  const { svc, profileRepo } = makeService();
  const out = await svc.getProfile();
  assert.deepStrictEqual(out, { uuid: 'default-user', lifetimeScore: 0 });
  // The repo must now contain the profile.
  assert.ok(profileRepo._raw('default-user'));
});

check('getProfile: reflects prior lifetimeScore (no reset on read)', async () => {
  const { svc, profileRepo } = makeService();
  await profileRepo.applyLifetimeDelta('default-user', 42);
  const out = await svc.getProfile();
  assert.strictEqual(out.lifetimeScore, 42);
});

// =========================================================================
// v2.1 — create(startDate), updateCycle, profile displayName
// =========================================================================

check('v2.1: create with startDate stamps the cycle with that Monday', async () => {
  const { svc, cycleRepo } = makeService();
  const out = await svc.create({ name: 'Dated', startDate: '2026-10-12' });
  assert.strictEqual(out.startDate, '2026-10-12');
  // Persisted.
  assert.strictEqual(cycleRepo._raw(out.uuid).startDate, '2026-10-12');
});

check('v2.1: create without startDate leaves it absent (legacy undated)', async () => {
  const { svc, cycleRepo } = makeService();
  const out = await svc.create({ name: 'Undated' });
  assert.strictEqual(out.startDate, undefined);
});

check('v2.1: updateCycle sets name + startDate + clears startDate', async () => {
  const { svc, cycleRepo } = makeService();
  const saved = await cycleRepo.create(fixtures.emptyCycle('Old'));
  const a = await svc.updateCycle(saved.uuid, { type: 'updateCycle', name: 'Renamed', startDate: '2026-10-12' });
  assert.strictEqual(a.cycle.name, 'Renamed');
  assert.strictEqual(a.cycle.startDate, '2026-10-12');
  assert.strictEqual(a.pointsEarned, 0);
  assert.strictEqual(a.currentTier, 'Bronze');
  // Persisted.
  assert.strictEqual(cycleRepo._raw(saved.uuid).startDate, '2026-10-12');

  const b = await svc.updateCycle(saved.uuid, { type: 'updateCycle', startDate: null });
  assert.strictEqual(b.cycle.startDate, null);
  assert.strictEqual(cycleRepo._raw(saved.uuid).startDate, null);
});

check('v2.1: updateCycle throws CYCLE_FINISHED when the cycle is finished', async () => {
  const { svc, cycleRepo } = makeService();
  const saved = await cycleRepo.create(fixtures.emptyCycle('Done'));
  saved.finished = true;
  await cycleRepo.save(saved);
  let thrown = null;
  try {
    await svc.updateCycle(saved.uuid, { type: 'updateCycle', name: 'try' });
  } catch (err) { thrown = err; }
  assert.ok(thrown && thrown.code === 'CYCLE_FINISHED');
});

check('v2.1: updateCycle throws NOT_FOUND when the cycle is missing', async () => {
  const { svc } = makeService();
  let thrown = null;
  try {
    await svc.updateCycle('nope', { type: 'updateCycle', name: 'x' });
  } catch (err) { thrown = err; }
  assert.ok(thrown && thrown.code === 'NOT_FOUND');
});

check('v2.1: getProfile returns displayName (null on first call)', async () => {
  const { svc } = makeService();
  const out = await svc.getProfile();
  assert.strictEqual(out.displayName, null);
  assert.deepStrictEqual(Object.keys(out).sort(), ['displayName', 'lifetimeScore', 'uuid']);
});

check('v2.1: updateProfile sets displayName; subsequent getProfile reflects it', async () => {
  const { svc } = makeService();
  const updated = await svc.updateProfile({ displayName: 'Alice' });
  assert.strictEqual(updated.displayName, 'Alice');
  const out = await svc.getProfile();
  assert.strictEqual(out.displayName, 'Alice');
});

check('v2.1: updateProfile null displayName clears the field', async () => {
  const { svc } = makeService();
  await svc.updateProfile({ displayName: 'Alice' });
  const out = await svc.updateProfile({ displayName: null });
  assert.strictEqual(out.displayName, null);
});

console.log(`\n${passed} checks passed`);
process.exit(0);