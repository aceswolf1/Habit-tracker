const express = require('express');
const router = express.Router();
const Cycle = require('../models/Cycle');
const UserProfile = require('../models/UserProfile');
const { calculateTaskPoints, calculateMonthScore } = require('../utils/scoreCalculator');
const { calculateAllStatistics } = require('../utils/statisticsCalculator');
// UB-13/14: single source of truth for progress + empty month
const { calculateProgress, createEmptyMonth } = require('../../shared/progress');

// Get user profile (lifetime score)
router.get('/profile', async (req, res) => {
  try {
    let userProfile = await UserProfile.findOne({ uuid: 'default-user' });
    if (!userProfile) {
      userProfile = new UserProfile({ uuid: 'default-user', lifetimeScore: 0 });
      await userProfile.save();
    }
    res.json(userProfile);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get current active cycle
router.get('/current', async (req, res) => {
  try {
    let cycle = await Cycle.findOne({ finished: false }).sort({ createdAt: -1 });

    // If no active cycle exists, create one automatically
    if (!cycle) {
      console.log('No active cycle found, creating a new one...');
      const monthData = createEmptyMonth();
      cycle = new Cycle(monthData);
      await cycle.save();
      console.log('New cycle created:', cycle.name);
    }

    res.json(cycle);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get all cycles
router.get('/', async (req, res) => {
  try {
    const cycles = await Cycle.find().sort({ createdAt: -1 });
    res.json(cycles);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create new cycle
router.post('/', async (req, res) => {
  try {
    const cycle = new Cycle(req.body);
    const savedCycle = await cycle.save();
    res.status(201).json(savedCycle);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Update cycle (for task operations)
router.patch('/:id', async (req, res) => {
  try {
    const { type, updates, additions, taskUuids, recurrenceId, taskUuid, targetDayUuid, targetIndex } = req.body;
    const cycle = await Cycle.findOne({ uuid: req.params.id });

    if (!cycle) {
      return res.status(404).json({ message: 'Cycle not found' });
    }

    // UB-02 / BUG-02: finished months are immutable server-side
    if (cycle.finished) {
      return res.status(409).json({
        message: 'Cannot modify a finished cycle. Finished months are locked and immutable.'
      });
    }

    let pointsEarned = 0; // Track points earned in this operation
    // UB-06: track completion flips so points use progress AFTER recalculation
    const completionFlips = [];

    // Handle different operation types
    if (type === 'updateTasks') {
      // Apply property updates first; defer point scoring until after progress recalc
      for (const update of updates) {
        for (const week of cycle.weeks) {
          for (const day of week.days) {
            const task = day.tasks.find(t => t.uuid === update.uuid);
            if (task) {
              const wasCompleted = task.completed;

              // Update all provided properties
              if (update.completed !== undefined) task.completed = update.completed;
              if (update.description !== undefined) task.description = update.description;
              if (update.optional !== undefined) task.optional = update.optional;
              if (update.legendary !== undefined) task.legendary = update.legendary;
              if (update.icon !== undefined) task.icon = update.icon;
              if (update.gifUrl !== undefined) task.gifUrl = update.gifUrl;
              if (update.order !== undefined) task.order = update.order;

              // Record completion flips for post-recalc scoring (UB-06)
              if (update.completed !== undefined && wasCompleted !== update.completed) {
                completionFlips.push({
                  optional: task.optional,
                  legendary: task.legendary || false,
                  direction: !wasCompleted && update.completed ? 'complete' : 'uncomplete'
                });
              }
            }
          }
        }
      }
    } else if (type === 'addTasks') {
      // Add new tasks
      for (const addition of additions) {
        for (const week of cycle.weeks) {
          if (week.uuid === addition.weekUuid) {
            const day = week.days.find(d => d.uuid === addition.dayUuid);
            if (day) {
              day.tasks.push(addition.task);
            }
          }
        }
      }
    } else if (type === 'deleteTasks') {
      // Delete tasks
      if (recurrenceId) {
        // Delete all tasks with this recurrenceId
        for (const week of cycle.weeks) {
          for (const day of week.days) {
            day.tasks = day.tasks.filter(t => t.recurrenceId !== recurrenceId);
          }
        }
      } else if (taskUuids) {
        // Delete specific tasks
        for (const week of cycle.weeks) {
          for (const day of week.days) {
            day.tasks = day.tasks.filter(t => !taskUuids.includes(t.uuid));
          }
        }
      }
    } else if (type === 'moveTasks') {
      // UB-11: relocate a nested task to targetDayUuid at optional targetIndex
      if (!taskUuid || !targetDayUuid) {
        return res.status(400).json({
          message: 'moveTasks requires taskUuid and targetDayUuid'
        });
      }

      let movingTask = null;
      let sourceDay = null;

      for (const week of cycle.weeks) {
        for (const day of week.days) {
          const idx = day.tasks.findIndex(t => t.uuid === taskUuid);
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
        return res.status(404).json({ message: `Task ${taskUuid} not found` });
      }

      let targetDay = null;
      for (const week of cycle.weeks) {
        for (const day of week.days) {
          if (day.uuid === targetDayUuid) {
            targetDay = day;
            break;
          }
        }
        if (targetDay) break;
      }

      if (!targetDay) {
        // Restore task to source day to avoid data loss on bad target
        sourceDay.tasks.push(movingTask);
        return res.status(404).json({ message: `Target day ${targetDayUuid} not found` });
      }

      let insertAt = typeof targetIndex === 'number' ? targetIndex : targetDay.tasks.length;
      if (insertAt < 0) insertAt = 0;
      if (insertAt > targetDay.tasks.length) insertAt = targetDay.tasks.length;
      targetDay.tasks.splice(insertAt, 0, movingTask);

      // Reassign order fields on affected days (source + target; same day = once)
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

    // Find if the task that was updated is legendary
    let isLegendary = false;
    if (type === 'updateTasks' && updates && updates.length > 0) {
      for (const week of savedCycle.weeks) {
        for (const day of week.days) {
          const task = day.tasks.find(t => t.uuid === updates[0].uuid);
          if (task) {
            isLegendary = task.legendary || false;
            break;
          }
        }
        if (isLegendary !== false) break;
      }
    }

    // Return points earned so frontend can show floating animation
    res.json({
      success: true,
      month: savedCycle,
      pointsEarned: pointsEarned,
      currentTier: require('../utils/scoreCalculator').getTierFromProgress(savedCycle.progress),
      isLegendary: isLegendary
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Set current month
router.post('/set-current', async (req, res) => {
  try {
    const { monthUuid } = req.body;
    // In a multi-user system, you'd track this per user
    // For now, we just return success
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Finish a cycle
router.post('/:id/finish', async (req, res) => {
  try {
    const cycle = await Cycle.findOne({ uuid: req.params.id });
    if (!cycle) {
      return res.status(404).json({ message: 'Cycle not found' });
    }

    // Don't recalculate if already finished and has statistics
    if (cycle.finished && cycle.statistics) {
      return res.json({ success: true, cycle, alreadyFinished: true });
    }

    // Calculate progress one final time before finishing
    calculateProgress(cycle);

    // Calculate comprehensive statistics
    console.log('Calculating statistics for finished month:', cycle.name);
    const statistics = calculateAllStatistics(cycle);

    // Set finished status and store statistics
    cycle.finished = true;
    cycle.finishedAt = new Date();
    cycle.statistics = statistics;

    await cycle.save();

    console.log('Month finished successfully with statistics calculated');
    res.json({ success: true, cycle, statistics });
  } catch (err) {
    console.error('Error finishing cycle:', err);
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
