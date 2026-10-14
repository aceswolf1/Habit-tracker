'use strict';
/**
 * Cycle lifecycle service — non-mutating lifecycle operations.
 *
 * Scope (layer-contract-w3.md):
 *   - getOrCreateCurrent()    auto-create an empty cycle when none is open
 *   - getByUuid(uuid)         single cycle (NOT_FOUND when missing)
 *   - list({ limit, offset }) paginated summaries + total
 *   - create({ name, startDate }) new empty cycle via shared createEmptyMonth
 *   - finish(uuid)            idempotent — calculates statistics once
 *   - getProfile()            lifetime score + displayName for the single-user profile
 *
 * v2.1 additions:
 *   - create({ startDate }) stamps a Monday on the cycle
 *   - updateCycle(uuid, { name?, startDate? }) sets/clears metadata
 *   - getProfile() returns the new `displayName` field
 *
 * This service does NOT mutate task structure. That's `taskMutationService`'s
 * job (PATCH /:id). Mutations + scoring + lifetime delta all live there.
 *
 * No `req` / `res`. No mongoose imports. Repositories are injected so tests
 * can substitute in-memory fakes (`backend/scripts/fakes/*` from w3-qa).
 */

const { calculateProgress, createEmptyMonth } = require('../../shared/progress');
const { calculateAllStatistics } = require('../utils/statisticsCalculator');
const { isMonday } = require('../../shared/dates');
const { notFound, cycleFinished } = require('./errors');
const { PROFILE_UUID } = require('../config');

/**
 * Build a lifecycle service bound to the given repositories.
 *
 * @param {{
 *   cycleRepo: {
 *     findByUuid(uuid): Promise<object|null>,
 *     findCurrentUnfinished(): Promise<object|null>,
 *     listSummaries({limit,offset}): Promise<{items:object[], total:number}>,
 *     create(data): Promise<object>,
 *     save(doc): Promise<object>,
 *   },
 *   profileRepo: {
 *     getOrCreate(uuid): Promise<object>,
 *     applyLifetimeDelta(uuid, delta): Promise<object>,
 *     updateProfile(uuid, updates): Promise<object>,
 *   },
 * }} deps
 */
function createCycleLifecycleService({ cycleRepo, profileRepo }) {
  if (!cycleRepo || !profileRepo) {
    throw new Error('createCycleLifecycleService requires { cycleRepo, profileRepo }');
  }

  /**
   * Find the newest unfinished cycle, or create one if none is open.
   * The auto-create matches the legacy GET /current route exactly:
   *   - lookup: Cycle.findOne({finished:false}).sort({createdAt:-1})
   *   - miss:   new Cycle(createEmptyMonth()) + save
   */
  async function getOrCreateCurrent() {
    let cycle = await cycleRepo.findCurrentUnfinished();
    if (!cycle) {
        const monthData = createEmptyMonth();
        cycle = await cycleRepo.create(monthData);
    }
    const obj = cycle && typeof cycle.toObject === 'function' ? cycle.toObject() : cycle;
    return obj;
  }

  /**
   * Fetch a single cycle by uuid. Throws DomainError('NOT_FOUND') when
   * missing so the controller maps it to 404.
   */
  async function getByUuid(uuid) {
    const cycle = await cycleRepo.findByUuid(uuid);
    if (!cycle) throw notFound(`Cycle ${uuid} not found`);
    return cycle && typeof cycle.toObject === 'function' ? cycle.toObject() : cycle;
  }

  /**
   * Paginated summary list. Returns `{ items, meta: { total, limit, offset } }`
   * matching the contract's paginated shape.
   */
  async function list({ limit, offset }) {
    const { items, total } = await cycleRepo.listSummaries({ limit, offset });
    return { items, meta: { total, limit, offset } };
  }

  /**
   * Create a new empty cycle via `createEmptyMonth(name)`. Returns the
   * plain-object representation (mongoose `toObject()`), so the controller
   * can wrap it in the standard 201 envelope. v2.1: also stamps `startDate`
   * when supplied (already validated as a Monday ISO date by zod).
   */
  async function create({ name, startDate } = {}) {
    const data = createEmptyMonth(name);
    if (startDate) {
      // Defensive: zod already validated, but guard so a misconfigured
      // service caller can't poison the cycle with a non-Monday.
      if (!isMonday(startDate)) {
        throw new Error('create(startDate): startDate must be a Monday');
      }
      data.startDate = startDate;
    }
    const saved = await cycleRepo.create(data);
    return saved && typeof saved.toObject === 'function' ? saved.toObject() : saved;
  }

  /**
   * v2.1: edit a cycle's metadata (`name`, `startDate`) without touching
   * tasks. Recomputes `calculateProgress` (no-op for weeks) and persists.
   * `startDate: null` clears the start date (back to undated).
   * Throws `CYCLE_FINISHED` when the cycle is already finished and
   * `NOT_FOUND` when the cycle is missing.
   *
   * `pointsEarned` is always 0 and `isLegendary` is always false — this
   * branch never issues a flip.
   */
  async function updateCycle(uuid, body) {
    if (!body || typeof body !== 'object') {
      throw notFound(`Cycle ${uuid} not found`);
    }
    const cycle = await cycleRepo.findByUuid(uuid);
    if (!cycle) throw notFound(`Cycle ${uuid} not found`);
    if (cycle.finished) {
      throw cycleFinished(
        'Cannot modify a finished cycle. Finished months are locked and immutable.'
      );
    }
    if (body.name !== undefined) cycle.name = body.name;
    if (body.startDate !== undefined) {
      // null clears; any string value MUST be a Monday.
      if (body.startDate !== null && !isMonday(body.startDate)) {
        // Defensive — zod already enforced it, but a wrong service caller
        // must not poison the cycle.
        throw new Error('updateCycle(startDate): startDate must be a Monday');
      }
      cycle.startDate = body.startDate;
    }
    // No progress change here, but call calculateProgress to preserve the
    // historical invariant (it doesn't damage anything and matches the
    // service's pre-existing contract).
    calculateProgress(cycle);
    const saved = await cycleRepo.save(cycle);
    const obj = saved && typeof saved.toObject === 'function' ? saved.toObject() : saved;
    return {
      cycle: obj,
      pointsEarned: 0,
      isLegendary: false,
      currentTier: obj.progress >= 100 ? 'Final'
        : obj.progress >= 75 ? 'Champion'
        : obj.progress >= 50 ? 'Gold'
        : obj.progress >= 25 ? 'Silver'
        : 'Bronze',
    };
  }

  /**
   * Finish a cycle idempotently.
   *
   * - First call: runs `calculateProgress`, calculates statistics, marks
   *   the cycle finished, persists, returns `{ cycle, statistics,
   *   alreadyFinished: false }`.
   * - Subsequent calls (or if the cycle was already finished and
   *   statistics already persisted): returns
   *   `{ cycle, statistics, alreadyFinished: true }` without re-running
   *   statistics — matches the legacy POST /:id/finish handler.
   * - Throws DomainError('NOT_FOUND') when the cycle is missing.
   */
  async function finish(uuid) {
    const cycle = await cycleRepo.findByUuid(uuid);
    if (!cycle) throw notFound(`Cycle ${uuid} not found`);

    if (cycle.finished && cycle.statistics) {
      return {
        cycle: cycle.toObject(),
        statistics: cycle.statistics,
        alreadyFinished: true,
      };
    }

    calculateProgress(cycle);

    const statistics = calculateAllStatistics(cycle);

    cycle.finished = true;
    cycle.finishedAt = new Date();
    cycle.statistics = statistics;

    const saved = await cycleRepo.save(cycle);
    return {
      cycle: saved.toObject(),
      statistics,
      alreadyFinished: false,
    };
  }

  /**
   * v2.1: single-user profile shape `{ uuid, lifetimeScore, displayName? }`.
   * The repository auto-creates the profile with lifetimeScore 0 on
   * first call so the response shape is always populated.
   */
  async function getProfile() {
    const profile = await profileRepo.getOrCreate(PROFILE_UUID);
    return {
      uuid: profile.uuid,
      lifetimeScore: profile.lifetimeScore,
      displayName: profile.displayName || null,
    };
  }

  /**
   * v2.1: PATCH `/api/cycles/profile`. Updates the player display name
   * (or future cosmetic fields). The repository owns the write side.
   */
  async function updateProfile(updates) {
    const profile = await profileRepo.updateProfile(PROFILE_UUID, updates);
    return {
      uuid: profile.uuid,
      lifetimeScore: profile.lifetimeScore,
      displayName: profile.displayName || null,
    };
  }

  return {
    getOrCreateCurrent,
    getByUuid,
    list,
    create,
    updateCycle,
    finish,
    getProfile,
    updateProfile,
  };
}

module.exports = {
  createCycleLifecycleService,
};
