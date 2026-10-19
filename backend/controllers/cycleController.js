'use strict';
/**
 * CycleController — thin HTTP boundary for `/api/cycles`.
 *
 * Each route handler does exactly four things:
 *   1. Parse the request via a zod schema (already in `validation/cycleSchemas.js`).
 *      On failure → 400 VALIDATION_ERROR with flattened details.
 *   2. Call a service method (lifecycle or taskMutation).
 *   3. Wrap the result in the response envelope (ok / created / fail).
 *   4. Map `DomainError` from the service to 404 / 409 / 400, and any
 *      other thrown error to 500 INTERNAL.
 *
 * No loops over weeks / days / tasks. No model imports. No business logic.
 *
 * The factory returns the handler bag so `routes/cycleRoutes.js` can wire
 * it directly with `router.<verb>(path, controller.fn)`.
 */

const {
  ok,
  created,
  fail,
  internal,
  failValidation,
  failNotFound,
  failFinished,
  failAlreadyClaimed,
} = require('../utils/respond');
const {
  createCycleSchema,
  listQuerySchema,
  patchSchema,
  patchProfileSchema,
  zodDetails,
} = require('../validation/cycleSchemas');
const { DomainError } = require('../services/errors');

/**
 * Map a thrown error to its HTTP envelope response.
 *
 * - DomainError NOT_FOUND → 404 NOT_FOUND (no details)
 * - DomainError CYCLE_FINISHED → 409 CYCLE_FINISHED
 * - DomainError VALIDATION_ERROR → 400 VALIDATION_ERROR with details
 * - anything else → 500 INTERNAL via `internal(res, err)`
 *
 * Returns true when an envelope was sent (so the caller can stop).
 */
function handleError(res, err, fallbackMessage = 'Internal server error') {
  if (err && err instanceof DomainError) {
    if (err.code === 'NOT_FOUND') return failNotFound(res, err.message);
    if (err.code === 'CYCLE_FINISHED') return failFinished(res, err.message);
    if (err.code === 'ALREADY_CLAIMED') return failAlreadyClaimed(res, err.message);
    if (err.code === 'VALIDATION_ERROR') {
      return fail(res, 400, 'VALIDATION_ERROR', err.message || 'Request validation failed', err.details);
    }
    // Unknown DomainError code → generic 500.
    return internal(res, err, fallbackMessage);
  }
  return internal(res, err, fallbackMessage);
}

/**
 * Build a controller bound to the given service instances.
 *
 * @param {{
 *   lifecycleService: {
 *     getOrCreateCurrent(): Promise<object>,
 *     getByUuid(uuid:string): Promise<object>,
 *     list({limit,offset}): Promise<{items:object[], meta:{total:number, limit:number, offset:number}}>,
 *     create({name?:string, startDate?:string}): Promise<object>,
 *     updateCycle(uuid:string, body:object): Promise<{cycle, pointsEarned, isLegendary, currentTier}>,
 *     finish(uuid:string): Promise<{cycle:object, statistics:object, alreadyFinished:boolean, rewards?:object}>,
 *     getProfile(): Promise<{uuid, lifetimeScore, displayName?}>,
 *     updateProfile(updates:object): Promise<{uuid, lifetimeScore, displayName?}>,
 *     getRewards(): Promise<object>,
 *     claimChest(chestId:string): Promise<{chest:object, credits:number}>,
 *   },
 *   taskMutationService: {
 *     patchCycle(uuid:string, body:object): Promise<{cycle:object, pointsEarned:number, isLegendary:boolean, currentTier:string, combo?:object, rewards?:object}>,
 *   },
 *   insightsService?: {
 *     compute(opts?:{today?:string}): Promise<object>,
 *   },
 * }} deps
 */
function createCycleController({ lifecycleService, taskMutationService, insightsService }) {
  if (!lifecycleService || !taskMutationService) {
    throw new Error('createCycleController requires { lifecycleService, taskMutationService }');
  }

  // ---- GET /insights (v2.2) -----------------------------------------------
  async function getInsights(req, res) {
    if (!insightsService) {
      return fail(res, 501, 'INTERNAL', 'insights service is not configured');
    }
    try {
      const data = await insightsService.compute();
      return ok(res, data);
    } catch (err) {
      return handleError(res, err, 'Failed to compute insights');
    }
  }

  // ---- GET /profile --------------------------------------------------------
  async function getProfile(req, res) {
    try {
      const data = await lifecycleService.getProfile();
      return ok(res, data);
    } catch (err) {
      return handleError(res, err);
    }
  }

  // ---- PATCH /profile -----------------------------------------------------
  async function patchProfile(req, res) {
    const parsed = patchProfileSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return failValidation(res, zodDetails(parsed.error));
    }
    try {
      const data = await lifecycleService.updateProfile(parsed.data);
      return ok(res, data);
    } catch (err) {
      return handleError(res, err);
    }
  }

  // ---- GET /current --------------------------------------------------------
  async function getCurrent(req, res) {
    try {
      const data = await lifecycleService.getOrCreateCurrent();
      return ok(res, data);
    } catch (err) {
      return handleError(res, err);
    }
  }

  // ---- GET / (paginated summaries) ----------------------------------------
  async function list(req, res) {
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return failValidation(res, zodDetails(parsed.error));
    }
    const { limit, offset } = parsed.data;
    try {
      const { items, meta } = await lifecycleService.list({ limit, offset });
      return ok(res, items, meta);
    } catch (err) {
      return handleError(res, err);
    }
  }

  // ---- POST / (create) -----------------------------------------------------
  async function create(req, res) {
    const parsed = createCycleSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return failValidation(res, zodDetails(parsed.error));
    }
    try {
      const cycle = await lifecycleService.create(parsed.data);
      return created(res, cycle);
    } catch (err) {
      return handleError(res, err);
    }
  }

  // ---- GET /:id ------------------------------------------------------------
  async function getById(req, res) {
    try {
      const cycle = await lifecycleService.getByUuid(req.params.id);
      return ok(res, cycle);
    } catch (err) {
      return handleError(res, err, `Failed to load cycle ${req.params.id}`);
    }
  }

  // ---- PATCH /:id ---------------------------------------------------------
  async function patch(req, res) {
    const parsed = patchSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return failValidation(res, zodDetails(parsed.error));
    }
    try {
      const result = await taskMutationService.patchCycle(req.params.id, parsed.data);
      return ok(res, result);
    } catch (err) {
      return handleError(res, err);
    }
  }

  // ---- POST /:id/finish ---------------------------------------------------
  async function finish(req, res) {
    try {
      const result = await lifecycleService.finish(req.params.id);
      return ok(res, result);
    } catch (err) {
      return handleError(res, err, 'Failed to finish cycle');
    }
  }

  // ---- v2.3: GET /rewards — synced shape per contract §3 ----------------
  async function getRewards(req, res) {
    try {
      const data = await lifecycleService.getRewards();
      return ok(res, data);
    } catch (err) {
      return handleError(res, err, 'Failed to load rewards');
    }
  }

  // ---- v2.3: POST /rewards/chests/:chestId/claim --------------------------
  async function claimChest(req, res) {
    try {
      const result = await lifecycleService.claimChest(req.params.chestId);
      return ok(res, result);
    } catch (err) {
      return handleError(res, err, 'Failed to claim chest');
    }
  }

  return {
    getProfile,
    patchProfile,
    getCurrent,
    list,
    create,
    getById,
    patch,
    finish,
    getInsights,
    getRewards,
    claimChest,
  };
}

module.exports = {
  createCycleController,
  // exposed for direct testing
  handleError,
};
