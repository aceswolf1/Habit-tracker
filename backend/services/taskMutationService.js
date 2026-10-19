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
const { calculateProgress, generateUuid } = require('../../shared/progress');
const { newHabitId, normalizeDescription } = require('../../shared/habits');
const { nextCombo, comboName } = require('../../shared/combos');

// v2.1: max length of the `habitId` field on TaskSchema. The schema
// constraint is duplicated here so the service can pre-trim before save.
const HABIT_ID_MAX = 64;

/**
 * Pure: push each `addition.task` into the matching week/day.
 *
 * v2.1 additions:
 *   - Server assigns `habitId` when it's missing. All tasks sharing a
 *     `recurrenceId` in the SAME request and missing a `habitId` share
 *     a single newly-generated id (D3).
 *   - Sets `completedAt` when `completed: true` is sent in.
 *   - Persists `habitId` on subsequent writes (D3: "persist on next
 *     save"). The same logic lives in `applyUpdates`.
 *   - Server assigns a task `uuid` when omitted (existing W5 behavior).
 *
 * Tasks without a matching day are silently dropped (matches
 * the legacy handler — zod already validated the uuids exist
 * semantically; the cycle may have been re-shaped client-side).
 *
 * @param {object} cycle
 * @param {Array<{weekUuid:string, dayUuid:string, task:object}>} additions
 */
function applyAdditions(cycle, additions) {
  // First pass: figure out which recurrence groups need a shared habitId.
  // Map<recurrenceId, habitId> for groups that need a fresh id.
  const groupHabitIds = new Map();
  for (const a of additions) {
    const t = a.task;
    if (!t) continue;
    if (t.habitId) continue;                            // client supplied
    if (!t.recurrenceId) continue;                      // one-off
    const key = `add:${t.recurrenceId}`;
    if (!groupHabitIds.has(key)) groupHabitIds.set(key, newHabitId());
  }

  for (const addition of additions) {
    for (const week of cycle.weeks) {
      if (week.uuid === addition.weekUuid) {
        const day = week.days.find((d) => d.uuid === addition.dayUuid);
        if (!day) break;
        const input = addition.task || {};

        // Server-assigned task uuid (W5).
        const taskUuid = input.uuid || generateUuid('t');

        // Resolve `habitId`. Priority:
        //   1. client-supplied (already validated)
        //   2. shared by recurrenceId group (assigned in pre-pass)
        //   3. freshly minted one-off id
        let habitId = input.habitId;
        if (!habitId) {
          if (input.recurrenceId && groupHabitIds.has(`add:${input.recurrenceId}`)) {
            habitId = groupHabitIds.get(`add:${input.recurrenceId}`);
          } else {
            habitId = newHabitId();
          }
        }
        if (typeof habitId === 'string' && habitId.length > HABIT_ID_MAX) {
          habitId = habitId.slice(0, HABIT_ID_MAX);
        }

        // Spread the input, then normalize the fields we own. We never
        // trust the client's `completedAt` — the server owns it. A new
        // task created `completed: true` gets `completedAt: now`.
        const now = input.completed ? new Date() : null;
        const merged = {
          ...input,
          uuid: taskUuid,
          habitId,
          completedAt: now,
        };
        // Strip the input keys we never want to persist verbatim even
        // if the schema accidentally allowed them (defense in depth).
        delete merged.completedAt;
        // ^ Re-set below; we just want to be explicit that we own it.
        merged.completedAt = now;
        day.tasks.push(merged);
        break;
      }
    }
  }
}

/**
 * Resolve the habitKey for a task. Prefer `task.habitId`; fall back to
 * `name:<normalized description>` (matches `shared/habits.habitKey`).
 */
function resolveHabitKey(task) {
  if (task && typeof task.habitId === 'string' && task.habitId.length > 0) {
    return task.habitId;
  }
  const desc = task && typeof task.description === 'string' ? task.description : '';
  return `name:${normalizeDescription(desc)}`;
}

/**
 * Format a Date as a UTC 'YYYY-MM-DD' (matches `shared/dates.dayDate`
 * style; uses UTC so it's timezone-stable regardless of host TZ).
 */
function utcDateOf(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return null;
  const yy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/**
 * Pure: apply each update to its matching task. Returns the array
 * of completion flips for the scoring service.
 *
 * `null` on `icon` / `gifUrl` / `notes` / `tag` / `durationMin` /
 * `timeOfDay` / `dueTime` clears the field; `undefined` leaves it
 * untouched (FIX-01). All other fields use `undefined === no
 * change` semantics, identical to the legacy PATCH branch.
 *
 * v2.1 completion-flip semantics:
 *   - `false → true`  → server stamps `completedAt = new Date()`
 *   - `true → false`  → server clears `completedAt` to `null`
 *
 * v2.2 combo semantics (E1–E4):
 *   - On a false→true flip the server also stamps `completedOn`
 *     (either `opts.clientDate` or the UTC date of `completedAt`)
 *     and computes `combo` by chaining with the most recent prior
 *     completion of the same habitKey (`opts.lookupPreviousCompletion`).
 *   - On a true→false flip the server unsets `completedOn`, `combo`,
 *     and `comboBonus`. The flip carries the stored `comboBonus` so
 *     the scoring service can reverse it exactly.
 *
 * `opts` is optional; when omitted, the function falls back to legacy
 * v2.1 behavior (no combo math; `comboBonus` flips stay at 0).
 *
 * @param {object} cycle
 * @param {Array<object>} updates  zod-validated items
 * @param {{
 *   clientDate?: string|null,
 *   lookupPreviousCompletion?: (habitKey:string, beforeIso:string, excludeTaskUuid:string) =>
 *     Promise<{completedOn:string, combo:number, comboBonus:number}|null>,
 * }} [opts]
 * @returns {Promise<Array<{optional:boolean, legendary:boolean,
 *   direction:'complete'|'uncomplete', combo?:number, comboBonus?:number,
 *   taskUuid?:string}>>}
 */
async function applyUpdates(cycle, updates, opts) {
  const ctx = opts || {};
  const clientDate = typeof ctx.clientDate === 'string' && ctx.clientDate
    ? ctx.clientDate : null;
  const lookup = typeof ctx.lookupPreviousCompletion === 'function'
    ? ctx.lookupPreviousCompletion : null;
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
        if (update.gifVideoUrl !== undefined) task.gifVideoUrl = update.gifVideoUrl; // null clears
        if (update.gifStillUrl !== undefined) task.gifStillUrl = update.gifStillUrl; // null clears
        if (update.notes !== undefined) task.notes = update.notes; // null clears
        if (update.order !== undefined) task.order = update.order;
        // v2.1 task metadata: same null/clear + undefined/leave-alone semantics.
        if (update.habitId !== undefined) {
          let h = update.habitId;
          if (typeof h === 'string' && h.length > HABIT_ID_MAX) h = h.slice(0, HABIT_ID_MAX);
          task.habitId = h;
        }
        if (update.tag !== undefined) task.tag = update.tag;
        if (update.durationMin !== undefined) task.durationMin = update.durationMin;
        if (update.timeOfDay !== undefined) task.timeOfDay = update.timeOfDay;
        if (update.dueTime !== undefined) task.dueTime = update.dueTime;

        // v2.1 D3: persist `habitId` on next save when a task is missing
        // one and the client didn't supply one in *this* update.
        // (Already-handled above when update.habitId !== undefined.)
        if (task.habitId == null) {
          task.habitId = newHabitId();
        }

        // v2.1: server-maintained `completedAt`. Maintain on completion flip.
        if (update.completed !== undefined && wasCompleted !== update.completed) {
          if (update.completed) {
            task.completedAt = new Date();
            // v2.2: stamp `completedOn` for combo math.
            const completedOn = clientDate || utcDateOf(task.completedAt);
            task.completedOn = completedOn;
            // Resolve combo by chaining with the most recent prior
            // completion of the same habitKey. Awaited because the lookup
            // hits the DB.
            let prev = null;
            if (lookup) {
              const habitKey = resolveHabitKey(task);
              try {
                prev = await lookup(habitKey, completedOn, task.uuid);
              } catch (err) {
                // Defensive: a lookup failure should not block a check.
                // Surface in logs (server.js request-id logger) and fall
                // back to combo=1.
                prev = null;
              }
            }
            const combo = nextCombo(
              prev && prev.completedOn ? prev.completedOn : null,
              prev && typeof prev.combo === 'number' ? prev.combo : null,
              completedOn
            );
            task.combo = combo;
            // `comboBonus` is computed at POST-recalc tier by the scoring
            // service (UB-06) and then stamped on the task by the patchCycle
            // orchestrator after the score loop runs. We track the resolved
            // combo on the flip so the scorer can derive the bonus.
            flips.push({
              taskUuid: task.uuid,
              optional: task.optional,
              legendary: task.legendary || false,
              direction: 'complete',
              combo,
              // comboBonus is set by patchCycle after scoring; default 0 so
              // legacy callers (no v2.2) get the same behaviour.
              comboBonus: 0,
            });
          } else {
            task.completedAt = null;
            task.completedOn = null;
            task.combo = undefined;
            // Capture the bonus + stored base BEFORE clearing so the
            // scoring service can reverse them exactly (E4: forward-only;
            // un-check reverses). For pre-v2.2 tasks neither field is set,
            // and the score service falls back to POST-recalc tier (v2.1
            // behavior) — see scoreCompletionFlips.
            const storedBonus = typeof task.comboBonus === 'number' ? task.comboBonus : 0;
            const storedBase = typeof task.comboBase === 'number' ? task.comboBase : null;
            task.comboBonus = undefined;
            task.comboBase = undefined;
            const flip = {
              taskUuid: task.uuid,
              optional: task.optional,
              legendary: task.legendary || false,
              direction: 'uncomplete',
              comboBonus: storedBonus,
            };
            if (storedBase !== null) flip.basePoints = storedBase;
            flips.push(flip);
          }
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
 * v2.1: apply a metadata-only PATCH (name + startDate). Performs the same
 * `NOT_FOUND` / `CYCLE_FINISHED` checks as the loop-driven branches but
 * never touches tasks.
 *
 * Pure: mutates the cycle in place. Returns true on success. Returns
 * `{ type: 'notFound' | 'finished' }` when the guard rejects the call.
 */
function applyCycleUpdate(cycle, body) {
  if (body.name !== undefined) cycle.name = body.name;
  if (body.startDate !== undefined) cycle.startDate = body.startDate; // null clears
  return true;
}

/**
 * Build a task-mutation service bound to the given repositories +
 * scoring service. Use ONE instance per process; default instances
 * live in `services/index.js` (w3-core).
 *
 * @param {{
 *   cycleRepo: { findByUuid(uuid):Promise<object|null>, save(doc):Promise<object>,
 *                findRecentCompletionForHabit(habitKey:string, beforeIso:string,
 *                  opts?:{excludeTaskUuid?:string}):Promise<{completedOn:string, combo:number, comboBonus:number}|null> },
 *   profileRepo: { applyLifetimeDelta(uuid:string, delta:number):Promise<object> },
 *   scoreService: { scoreCompletionFlips(cycle, flips):{pointsEarned:number},
 *                   scoreForCompletion(combo:number, optional:boolean, progress:number, legendary:boolean):{base:number, bonus:number, total:number},
 *                   tierFor(progress):string }
 *   rewardsService?: { syncRewards(uuid:string, opts?:object): Promise<{newChests:object[], newAchievements:object[]}> },
 * }} deps
 */
function createTaskMutationService({ cycleRepo, profileRepo, scoreService, rewardsService }) {
  if (!cycleRepo || !profileRepo || !scoreService) {
    throw new Error(
      'createTaskMutationService requires { cycleRepo, profileRepo, scoreService }'
    );
  }

  /**
   * @param {string} uuid
   * @param {object} body  zod-validated PATCH body
   * @returns {Promise<{cycle:object, pointsEarned:number, isLegendary:boolean,
   *    currentTier:string, combo?:{taskUuid:string, combo:number, name:string|null, bonus:int}}>}
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
      case 'updateTasks': {
        const ctx = {
          clientDate: body.clientDate || null,
          lookupPreviousCompletion: async (habitKey, beforeIso, excludeTaskUuid) => {
            if (typeof cycleRepo.findRecentCompletionForHabit !== 'function') return null;
            return cycleRepo.findRecentCompletionForHabit(habitKey, beforeIso, {
              excludeUuid: uuid,
              excludeTaskUuid,
            });
          },
        };
        flips = await applyUpdates(cycle, body.updates, ctx);
        break;
      }
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
      case 'updateCycle':
        applyCycleUpdate(cycle, body);
        break;
      default:
        // zod should reject unknown types; defensive guard.
        throw new Error(`Unsupported patch type: ${body.type}`);
    }

    // UB-06: progress recalc must precede scoring so points use the
    // post-mutation tier (e.g. crossing 24% → 25% should award Silver,
    // not Bronze).
    calculateProgress(cycle);

    // v2.2: for each `complete` flip, stamp `task.comboBonus` (and the
    // task's stored base `comboBase`) with the values the scoring service
    // computes at POST-recalc tier. These are what gets reversed exactly
    // on un-check — see also the `flip.basePoints` branch below.
    if (typeof scoreService.scoreForCompletion === 'function') {
      for (const flip of flips) {
        if (flip.direction !== 'complete') continue;
        if (!flip.taskUuid) continue;
        outer: for (const week of cycle.weeks) {
          for (const day of week.days) {
            const t = day.tasks.find((x) => x.uuid === flip.taskUuid);
            if (t) {
              const { base, bonus } = scoreService.scoreForCompletion(
                flip.combo || 1,
                t.optional,
                cycle.progress || 0,
                t.legendary || false
              );
              t.comboBonus = bonus;
              t.comboBase = base;
              flip.comboBonus = bonus;
              flip.basePoints = base; // stored base; un-check uses it
              break outer;
            }
          }
        }
      }
    }

    // Score completion flips using post-recalc progress / tier.
    // `updateCycle` never flips anything → score stays 0.
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

    // v2.2: PATCH response `combo` field — the LAST completion in the
    // request, so the UI can flash 'TRIPLE STRIKE +5' etc. Only emit
    // when the last update was an `updateTasks` completing a task.
    let comboField;
    if (body.type === 'updateTasks' && body.updates.length > 0) {
      const last = body.updates[body.updates.length - 1];
      // Find the last completing flip (matches the last update only if
      // it actually flipped false→true).
      for (let i = flips.length - 1; i >= 0; i--) {
        const f = flips[i];
        if (f.direction === 'complete' && f.taskUuid === last.uuid) {
          comboField = {
            taskUuid: f.taskUuid,
            combo: f.combo || 1,
            name: comboName(f.combo || 1),
            bonus: f.comboBonus || 0,
          };
          break;
        }
      }
    }

    const result = {
      cycle: savedCycle,
      pointsEarned,
      isLegendary,
      currentTier: scoreService.tierFor(savedCycle.progress || 0),
    };
    if (comboField) result.combo = comboField;

    // v2.3: sync rewards after every lifecycle-affecting write. Only
    // attach the `rewards` block when something is new (the FE flashes
    // toasts only for actual unlocks; an empty delta is silent).
    if (rewardsService && typeof rewardsService.syncRewards === 'function') {
      try {
        const sync = await rewardsService.syncRewards(PROFILE_UUID);
        if (sync && (sync.newChests.length || sync.newAchievements.length)) {
          result.rewards = {
            newChests: sync.newChests.map((c) => c.level),
            newAchievements: sync.newAchievements.map((a) => ({
              id: a.id,
              // name + credits come from the catalog; the FE merges them
              // with the rewards store response on the next fetchRewards,
              // so for toasts the id + a server-derived amount is enough.
              credits: a.credits,
            })),
          };
        }
      } catch (err) {
        // Defensive: a rewards-sync failure must not roll back the cycle.
        // Surface in logs (server.js request-id logger) and continue.
        // eslint-disable-next-line no-console
        console.error('[taskMutationService] rewards sync failed', err);
      }
    }

    return result;
  }

  return {
    patchCycle,
    // exposed for tests
    applyAdditions,
    applyUpdates,
    applyDeletes,
    applyMove,
    applyCycleUpdate,
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
  applyCycleUpdate,
};
