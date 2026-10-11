/**
 * Task mutation + scoring orchestration (W3 layer contract).
 *
 * Owns the PATCH /api/cycles/:id business rules: walks weeks/days,
 * applies the discriminated-union branch, recalculates progress,
 * scores completion flips, persists the cycle, and updates the
 * profile lifetime delta when points were earned or reversed.
 *
 * Layers (layer-contract-w3.md):
 *   routes → controllers → services → repositories → models
 *
 * This file:
 *   - No `req` / `res` (HTTP concerns live in the controller).
 *   - No mongoose / model imports — repositories are injected.
 *   - Exports pure helpers `applyAdditions`, `applyUpdates`,
 *     `applyDeletes`, `applyMove` for direct testing (w3-qa).
 *
 * Errors come from `./errors`; the profile uuid constant lives in
 * `../config` (PROFILE_UUID). Both files are owned by w3-core (C1).
 *
 * Scoring (`shared/scoring.calculateTaskPoints`, `getTierFromProgress`)
 * and progress (`shared/progress.calculateProgress`) are the same
 * single source of truth the legacy PATCH handler used — porting
 * keeps the same numbers.
 */

'use strict';

const { notFound, cycleFinished } = require('./errors');
const { PROFILE_UUID } = require('../config');
const { calculateProgress } = require('../../shared/progress');

/**
 * Pure: push each `addition.task` into the matching week/day.
 * Tasks without a matching day are silently dropped (matches
 * the legacy handler — zod already validated the uuids exist
 * semantically; the cycle may have been re-shaped client-side).
 *
 * @param {object} cycle
 * @param {Array<{weekUuid:string, dayUuid:string, task:object}>} additions
 */
function applyAdditions(cycle, additions) {
  for (const addition of additions) {
    for (const week of cycle.weeks) {
      if (week.uuid === addition.weekUuid) {
        const day = week.days.find((d) => d.uuid === addition.dayUuid);
        if (day) day.tasks.push(addition.task);
        break;
      }
    }
  }
}

/**
 * Pure: apply each update to its matching task. Returns the array
 * of completion flips for the scoring service.
 *
 * `null` on `icon` / `gifUrl` clears the field; `undefined` leaves
 * it untouched (FIX-01). All other fields use `undefined === no
 * change` semantics, identical to the legacy PATCH branch.
 *
 * @param {object} cycle
 * @param {Array<object>} updates  zod-validated items
 * @returns {Array<{optional:boolean, legendary:boolean, direction:'complete'|'uncomplete'}>}
 */
function applyUpdates(cycle, updates) {
  const flips = [];
  for (const update of updates) {
    for (const week of cycle.weeks) {
      for (const day of week.days) {
        const task = day.tasks.find((t) => t.uuid === update.uuid);
        if (!task) continue;
        const wasCompleted = task.completed;

        if (update.completed !== undefined) task.completed = update.completed;
        if (update.description !== undefined) task.description = update.description;
        if (update.optional !== undefined) task.optional = update.optional;
        if (update.legendary !== undefined) task.legendary = update.legendary;
        if (update.icon !== undefined) task.icon = update.icon; // null clears
        if (update.gifUrl !== undefined) task.gifUrl = update.gifUrl; // null clears
        if (update.order !== undefined) task.order = update.order;

        if (update.completed !== undefined && wasCompleted !== update.completed) {
          flips.push({
            optional: task.optional,
            legendary: task.legendary || false,
            direction: !wasCompleted && update.completed ? 'complete' : 'uncomplete',
          });
        }
      }
    }
  }
  return flips;
}

/**
 * Pure: delete tasks by uuid set OR by recurrenceId (XOR at the
 * zod layer). Matches the legacy PATCH branch.
 *
 * @param {object} cycle
 * @param {{taskUuids?:string[], recurrenceId?:string}} body
 */
function applyDeletes(cycle, body) {
  if (Array.isArray(body.taskUuids)) {
    const set = new Set(body.taskUuids);
    for (const week of cycle.weeks) {
      for (const day of week.days) {
        day.tasks = day.tasks.filter((t) => !set.has(t.uuid));
      }
    }
  } else if (body.recurrenceId) {
    for (const week of cycle.weeks) {
      for (const day of week.days) {
        day.tasks = day.tasks.filter((t) => t.recurrenceId !== body.recurrenceId);
      }
    }
  }
}

/**
 * Pure: relocate one task to another day (or reorder within a
 * day). Re-indexes both source and target days after the move.
 *
 * Preserves the legacy "restore on missing target" semantics so
 * a 404 leaves the cycle byte-for-byte unchanged.
 *
 * @param {object} cycle
 * @param {{taskUuid:string, targetDayUuid:string, targetIndex?:number}} body
 * @returns {null | {type:'task'|'targetDay', uuid:string}}
 */
function applyMove(cycle, body) {
  if (!body || !body.taskUuid || !body.targetDayUuid) {
    // zod should have caught this; defensive guard.
    return { type: 'task', uuid: body && body.taskUuid };
  }

  let movingTask = null;
  let sourceDay = null;

  outerTask: for (const week of cycle.weeks) {
    for (const day of week.days) {
      const idx = day.tasks.findIndex((t) => t.uuid === body.taskUuid);
      if (idx !== -1) {
        movingTask = day.tasks[idx];
        sourceDay = day;
        day.tasks.splice(idx, 1);
        break outerTask;
      }
    }
  }
  if (!movingTask) {
    return { type: 'task', uuid: body.taskUuid };
  }

  let targetDay = null;
  outerDay: for (const week of cycle.weeks) {
    for (const day of week.days) {
      if (day.uuid === body.targetDayUuid) {
        targetDay = day;
        break outerDay;
      }
    }
  }
  if (!targetDay) {
    // Restore source to keep the cycle unchanged on 404.
    sourceDay.tasks.push(movingTask);
    return { type: 'targetDay', uuid: body.targetDayUuid };
  }

  let insertAt =
    typeof body.targetIndex === 'number' ? body.targetIndex : targetDay.tasks.length;
  if (insertAt < 0) insertAt = 0;
  if (insertAt > targetDay.tasks.length) insertAt = targetDay.tasks.length;
  targetDay.tasks.splice(insertAt, 0, movingTask);

  const affected = sourceDay === targetDay ? [targetDay] : [sourceDay, targetDay];
  for (const d of affected) {
    d.tasks.forEach((t, i) => {
      t.order = i;
    });
  }

  return null;
}

/**
 * Build a task-mutation service bound to the given repositories +
 * scoring service. Use ONE instance per process; default instances
 * live in `services/index.js` (w3-core).
 *
 * @param {{
 *   cycleRepo: { findByUuid(uuid):Promise<object|null>, save(doc):Promise<object> },
 *   profileRepo: { applyLifetimeDelta(uuid:string, delta:number):Promise<object> },
 *   scoreService: { scoreCompletionFlips(cycle, flips):{pointsEarned:number}, tierFor(progress):string }
 * }} deps
 */
function createTaskMutationService({ cycleRepo, profileRepo, scoreService }) {
  if (!cycleRepo || !profileRepo || !scoreService) {
    throw new Error(
      'createTaskMutationService requires { cycleRepo, profileRepo, scoreService }'
    );
  }

  /**
   * @param {string} uuid
   * @param {object} body  zod-validated PATCH body
   * @returns {Promise<{cycle:object, pointsEarned:number, isLegendary:boolean, currentTier:string}>}
   */
  async function patchCycle(uuid, body) {
    const cycle = await cycleRepo.findByUuid(uuid);
    if (!cycle) throw notFound(`Cycle ${uuid} not found`);

    if (cycle.finished) {
      throw cycleFinished(
        'Cannot modify a finished cycle. Finished months are locked and immutable.'
      );
    }

    let flips = [];

    switch (body.type) {
      case 'addTasks':
        applyAdditions(cycle, body.additions);
        break;
      case 'updateTasks':
        flips = applyUpdates(cycle, body.updates);
        break;
      case 'deleteTasks':
        applyDeletes(cycle, body);
        break;
      case 'moveTasks': {
        const miss = applyMove(cycle, body);
        if (miss) {
          if (miss.type === 'task') {
            throw notFound(`Task ${miss.uuid} not found`);
          }
          if (miss.type === 'targetDay') {
            throw notFound(`Target day ${miss.uuid} not found`);
          }
        }
        break;
      }
      default:
        // zod should reject unknown types; defensive guard.
        throw new Error(`Unsupported patch type: ${body.type}`);
    }

    // UB-06: progress recalc must precede scoring so points use the
    // post-mutation tier (e.g. crossing 24% → 25% should award Silver,
    // not Bronze).
    calculateProgress(cycle);

    // Score completion flips using post-recalc progress / tier.
    const { pointsEarned } = scoreService.scoreCompletionFlips(cycle, flips);

    // UB-10: lifetime delta gated on pointsEarned !== 0; floor 0 is
    // the profile repo's responsibility (per contract).
    if (pointsEarned !== 0) {
      await profileRepo.applyLifetimeDelta(PROFILE_UUID, pointsEarned);
    }

    const saved = await cycleRepo.save(cycle);
    const savedCycle =
      saved && typeof saved.toObject === 'function' ? saved.toObject() : saved;

    // isLegendary = legendary flag of the FIRST updated task
    // (UI burst signal; only meaningful for updateTasks).
    let isLegendary = false;
    if (body.type === 'updateTasks' && body.updates.length > 0) {
      const targetUuid = body.updates[0].uuid;
      lookup: for (const week of savedCycle.weeks) {
        for (const day of week.days) {
          const task = day.tasks.find((t) => t.uuid === targetUuid);
          if (task) {
            isLegendary = task.legendary || false;
            break lookup;
          }
        }
      }
    }

    return {
      cycle: savedCycle,
      pointsEarned,
      isLegendary,
      currentTier: scoreService.tierFor(savedCycle.progress || 0),
    };
  }

  return {
    patchCycle,
    // exposed for tests
    applyAdditions,
    applyUpdates,
    applyDeletes,
    applyMove,
  };
}

module.exports = {
  createTaskMutationService,
  // also re-exported at module scope so tests can import the pure
  // helpers directly without instantiating the service.
  applyAdditions,
  applyUpdates,
  applyDeletes,
  applyMove,
};