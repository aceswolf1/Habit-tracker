'use strict';
/**
 * Cycle lifecycle service — non-mutating lifecycle operations.
 *
 * Scope (layer-contract-w3.md):
 *   - getOrCreateCurrent()    auto-create an empty cycle when none is open
 *   - getByUuid(uuid)         single cycle (NOT_FOUND when missing)
 *   - list({ limit, offset }) paginated summaries + total
 *   - create({ name })        new empty cycle via shared createEmptyMonth
 *   - finish(uuid)            idempotent — calculates statistics once
 *   - getProfile()            lifetime score for the single-user profile
 *
 * This service does NOT mutate task structure. That's `taskMutationService`'s
 * job (PATCH /:id). Mutations + scoring + lifetime delta all live there.
 *
 * No `req` / `res`. No mongoose imports. Repositories are injected so tests
 * can substitute in-memory fakes (`backend/scripts/fakes/*` from w3-qa).
 */

const { calculateProgress, createEmptyMonth } = require('../../shared/progress');
const { calculateAllStatistics } = require('../utils/statisticsCalculator');
const { notFound } = require('./errors');
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
   * can wrap it in the standard 201 envelope.
   */
  async function create({ name } = {}) {
    const saved = await cycleRepo.create(createEmptyMonth(name));
    return saved && typeof saved.toObject === 'function' ? saved.toObject() : saved;
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
   * Return the single-user profile shape `{ uuid, lifetimeScore }`.
   * The repository auto-creates the profile with lifetimeScore 0 on
   * first call so the response shape is always populated.
   */
  async function getProfile() {
    const profile = await profileRepo.getOrCreate(PROFILE_UUID);
    return {
      uuid: profile.uuid,
      lifetimeScore: profile.lifetimeScore,
    };
  }

  return {
    getOrCreateCurrent,
    getByUuid,
    list,
    create,
    finish,
    getProfile,
  };
}

module.exports = {
  createCycleLifecycleService,
};