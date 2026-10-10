const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const Cycle = require('../models/Cycle');
const UserProfile = require('../models/UserProfile');
const {
  calculateTaskPoints,
  calculateMonthScore,
  getTierFromProgress,
} = require('../utils/scoreCalculator');
const { calculateAllStatistics } = require('../utils/statisticsCalculator');
// UB-13/14: single source of truth for progress + empty month
const { calculateProgress, createEmptyMonth } = require('../../shared/progress');
// UB-18/19: envelope helpers + zod schemas
const {
  ok,
  created,
  fail,
  failValidation,
  failNotFound,
  failFinished,
  internal,
} = require('../utils/respond');
const {
  createCycleSchema,
  listQuerySchema,
  patchSchema,
  zodDetails,
} = require('../validation/cycleSchemas');

// UB-39: backend console.log gated behind DEBUG; console.error stays for real failures.
const DEBUG = process.env.DEBUG === '1' || process.env.DEBUG === 'true';

// --- route order matters in Express: literal paths before `/:id` -----------

// GET /profile — lifetime score
router.get('/profile', async (req, res) => {
  try {
    let userProfile = await UserProfile.findOne({ uuid: 'default-user' });
    if (!userProfile) {
      userProfile = new UserProfile({ uuid: 'default-user', lifetimeScore: 0 });
      await userProfile.save();
    }
    return ok(res, {
      uuid: userProfile.uuid,
      lifetimeScore: userProfile.lifetimeScore,
    });
  } catch (err) {
    return internal(res, err);
  }
});

// GET /current — auto-creates an empty cycle when no unfinished cycle exists
router.get('/current', async (req, res) => {
  try {
    let cycle = await Cycle.findOne({ finished: false }).sort({ createdAt: -1 });

    if (!cycle) {
      if (DEBUG) console.log('No active cycle found, creating a new one...');
      const monthData = createEmptyMonth();
      cycle = new Cycle(monthData);
      await cycle.save();
      if (DEBUG) console.log('New cycle created:', cycle.name);
    }

    return ok(res, cycle.toObject());
  } catch (err) {
    return internal(res, err);
  }
});

// GET / — paginated summaries (excludes `weeks`)
router.get('/', async (req, res) => {
  // Reject when body looks like a legacy POST (FE may still hit / for create).
  // The new contract requires POST / for create; keep GET / read-only.
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return failValidation(res, zodDetails(parsed.error));
  }
  const { limit, offset } = parsed.data;
  try {
    const [cycles, total] = await Promise.all([
      Cycle.find()
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .select({
          uuid: 1,
          name: 1,
          subtitle: 1,
          progress: 1,
          score: 1,
          finished: 1,
          createdAt: 1,
          finishedAt: 1,
        })
        .lean(),
      Cycle.countDocuments(),
    ]);
    return ok(
      res,
      cycles.map((c) => ({
        uuid: c.uuid,
        name: c.name,
        subtitle: c.subtitle,
        progress: c.progress || 0,
        score: c.score || 0,
        finished: !!c.finished,
        createdAt: c.createdAt,
        finishedAt: c.finishedAt || null,
      })),
      { total, limit, offset }
    );
  } catch (err) {
    return internal(res, err);
  }
});

// POST / — create empty cycle via shared createEmptyMonth
router.post('/', async (req, res) => {
  const parsed = createCycleSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return failValidation(res, zodDetails(parsed.error));
  }
  try {
    const cycle = new Cycle(createEmptyMonth(parsed.data.name));
    const saved = await cycle.save();
    return created(res, saved.toObject());
  } catch (err) {
    return internal(res, err);
  }
});

// GET /:id — single cycle
router.get('/:id', async (req, res) => {
  try {
    const cycle = await Cycle.findOne({ uuid: req.params.id });
    if (!cycle) return failNotFound(res, `Cycle ${req.params.id} not found`);
    return ok(res, cycle.toObject());
  } catch (err) {
    return internal(res, err);
  }
});

// PATCH /:id — discriminated union { addTasks | updateTasks | deleteTasks | moveTasks }
router.patch('/:id', async (req, res) => {
  const parsed = patchSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return failValidation(res, zodDetails(parsed.error));
  }

  try {
    const cycle = await Cycle.findOne({ uuid: req.params.id });
    if (!cycle) return failNotFound(res, `Cycle ${req.params.id} not found`);

    if (cycle.finished) {
      return failFinished(
        res,
        'Cannot modify a finished cycle. Finished months are locked and immutable.'
      );
    }

    const body = parsed.data;
    let pointsEarned = 0;
    const completionFlips = [];

    if (body.type === 'updateTasks') {
      for (const update of body.updates) {
        for (const week of cycle.weeks) {
          for (const day of week.days) {
            const task = day.tasks.find((t) => t.uuid === update.uuid);
            if (!task) continue;
            const wasCompleted = task.completed;

            if (update.completed !== undefined) task.completed = update.completed;
            if (update.description !== undefined) task.description = update.description;
            if (update.optional !== undefined) task.optional = update.optional;
            if (update.legendary !== undefined) task.legendary = update.legendary;
            if (update.icon !== undefined) task.icon = update.icon;
            if (update.gifUrl !== undefined) task.gifUrl = update.gifUrl;
            if (update.order !== undefined) task.order = update.order;

            if (update.completed !== undefined && wasCompleted !== update.completed) {
              completionFlips.push({
                optional: task.optional,
                legendary: task.legendary || false,
                direction: !wasCompleted && update.completed ? 'complete' : 'uncomplete',
              });
            }
          }
        }
      }
    } else if (body.type === 'addTasks') {
      for (const addition of body.additions) {
        for (const week of cycle.weeks) {
          if (week.uuid === addition.weekUuid) {
            const day = week.days.find((d) => d.uuid === addition.dayUuid);
            if (day) day.tasks.push(addition.task);
          }
        }
      }
    } else if (body.type === 'deleteTasks') {
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
    } else if (body.type === 'moveTasks') {
      if (!body.taskUuid || !body.targetDayUuid) {
        return failValidation(res, [
          { path: 'moveTasks', message: 'taskUuid and targetDayUuid are required' },
        ]);
      }

      let movingTask = null;
      let sourceDay = null;
      for (const week of cycle.weeks) {
        for (const day of week.days) {
          const idx = day.tasks.findIndex((t) => t.uuid === body.taskUuid);
          if (idx !== -1) {
            movingTask = day.tasks[idx];
            sourceDay = day;
            day.tasks.splice(idx, 1);
            break;
          }
        }
        if (movingTask) break;
      }
      if (!movingTask) {
        return failNotFound(res, `Task ${body.taskUuid} not found`);
      }

      let targetDay = null;
      for (const week of cycle.weeks) {
        for (const day of week.days) {
          if (day.uuid === body.targetDayUuid) {
            targetDay = day;
            break;
          }
        }
        if (targetDay) break;
      }
      if (!targetDay) {
        // restore source to avoid data loss
        sourceDay.tasks.push(movingTask);
        return failNotFound(res, `Target day ${body.targetDayUuid} not found`);
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
    }

    // Recalculate progress after any changes (must run before scoring toggles)
    calculateProgress(cycle);

    // UB-06: score completion flips using post-recalc progress / tier
    for (const flip of completionFlips) {
      const points = calculateTaskPoints(flip.optional, cycle.progress, flip.legendary);
      if (flip.direction === 'complete') {
        pointsEarned += points;
        cycle.score = (cycle.score || 0) + points;
      } else {
        cycle.score = Math.max(0, (cycle.score || 0) - points);
        pointsEarned -= points;
      }
    }

    // UB-10: apply lifetime delta for earn and uncomplete; floor at 0
    if (pointsEarned !== 0) {
      let userProfile = await UserProfile.findOne({ uuid: 'default-user' });
      if (!userProfile) {
        userProfile = new UserProfile({ uuid: 'default-user', lifetimeScore: 0 });
      }
      userProfile.lifetimeScore = Math.max(0, userProfile.lifetimeScore + pointsEarned);
      userProfile.updatedAt = new Date();
      await userProfile.save();
    }

    const savedCycle = await cycle.save();

    // Find if the first updated task is legendary (for UI burst)
    let isLegendary = false;
    if (body.type === 'updateTasks' && body.updates.length > 0) {
      for (const week of savedCycle.weeks) {
        for (const day of week.days) {
          const task = day.tasks.find((t) => t.uuid === body.updates[0].uuid);
          if (task) {
            isLegendary = task.legendary || false;
            break;
          }
        }
        if (isLegendary !== false) break;
      }
    }

    return ok(res, {
      cycle: savedCycle.toObject(),
      pointsEarned,
      isLegendary,
      currentTier: getTierFromProgress(savedCycle.progress),
    });
  } catch (err) {
    return internal(res, err);
  }
});

// POST /:id/finish — finish a cycle (idempotent)
router.post('/:id/finish', async (req, res) => {
  try {
    const cycle = await Cycle.findOne({ uuid: req.params.id });
    if (!cycle) return failNotFound(res, `Cycle ${req.params.id} not found`);

    if (cycle.finished && cycle.statistics) {
      return ok(res, {
        cycle: cycle.toObject(),
        statistics: cycle.statistics,
        alreadyFinished: true,
      });
    }

    calculateProgress(cycle);

    if (DEBUG) console.log('Calculating statistics for finished month:', cycle.name);
    const statistics = calculateAllStatistics(cycle);

    cycle.finished = true;
    cycle.finishedAt = new Date();
    cycle.statistics = statistics;

    await cycle.save();

    if (DEBUG) console.log('Month finished successfully with statistics calculated');
    return ok(res, {
      cycle: cycle.toObject(),
      statistics,
      alreadyFinished: false,
    });
  } catch (err) {
    console.error('Error finishing cycle:', err);
    return internal(res, err, 'Failed to finish cycle');
  }
});

module.exports = router;