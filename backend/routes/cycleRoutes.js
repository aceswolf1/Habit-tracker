const express = require('express');
const router = express.Router();
const Cycle = require('../models/Cycle');
const UserProfile = require('../models/UserProfile');
const { calculateTaskPoints, calculateMonthScore } = require('../utils/scoreCalculator');

// Helper function to generate UUID
function generateUuid(prefix = 'c') {
  return `${prefix}-${Math.random().toString(36).slice(2)}`;
}

// Helper function to calculate progress for the entire month
function calculateProgress(cycle) {
  if (!cycle || !cycle.weeks) return;

  // Calculate week progress
  for (const week of cycle.weeks) {
    let weekTotalTasks = 0;
    let weekCompletedTasks = 0;

    for (const day of week.days) {
      const requiredTasks = day.tasks.filter(task => !task.optional);
      weekTotalTasks += requiredTasks.length;
      weekCompletedTasks += requiredTasks.filter(task => task.completed).length;
    }

    if (weekTotalTasks > 0) {
      week.progress = Math.round((weekCompletedTasks / weekTotalTasks) * 100);
      week.conquered = weekCompletedTasks === weekTotalTasks;
    } else {
      week.progress = 0;
      week.conquered = false;
    }
  }

  // Calculate month progress
  const weekCount = cycle.weeks.length;
  if (weekCount === 0) {
    cycle.progress = 0;
    return;
  }

  const totalWeekProgress = cycle.weeks.reduce((sum, w) => sum + (w.progress || 0), 0);
  const baseMonthProgress = Math.round(totalWeekProgress / weekCount);

  // Optional bonus logic
  let bonus = 0;
  if (baseMonthProgress === 100) {
    let optionalCompleted = 0;
    for (const week of cycle.weeks) {
      for (const day of week.days) {
        optionalCompleted += day.tasks.filter(t => t.optional && t.completed).length;
      }
    }
    bonus = Math.min(10, optionalCompleted * 2);
  }

  cycle.progress = Math.min(110, baseMonthProgress + bonus);
}

// Helper function to create a new empty month structure
function createEmptyMonth(name) {
  const monthName = name || new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
  const weeks = [];

  // Create 4 weeks
  for (let weekNum = 1; weekNum <= 4; weekNum++) {
    const days = [];
    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    // Create 7 days for each week
    for (let dayNum = 0; dayNum < 7; dayNum++) {
      days.push({
        uuid: generateUuid('d'),
        name: dayNames[dayNum],
        subtitle: `Day ${dayNum + 1}`,
        tasks: []
      });
    }

    weeks.push({
      uuid: generateUuid('w'),
      name: `Week ${weekNum}`,
      subtitle: `Week ${weekNum} of the month`,
      progress: 0,
      conquered: false,
      days
    });
  }

  return {
    uuid: generateUuid('m'),
    name: monthName,
    subtitle: 'Your journey begins',
    progress: 0,
    weeks,
    finished: false,
    createdAt: new Date()
  };
}

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
    const { type, updates, additions, taskUuids, recurrenceId } = req.body;
    const cycle = await Cycle.findOne({ uuid: req.params.id });

    if (!cycle) {
      return res.status(404).json({ message: 'Cycle not found' });
    }

    let pointsEarned = 0; // Track points earned in this operation

    // Handle different operation types
    if (type === 'updateTasks') {
      // Update task completion status
      for (const update of updates) {
        for (const week of cycle.weeks) {
          for (const day of week.days) {
            const task = day.tasks.find(t => t.uuid === update.uuid);
            if (task) {
              const wasCompleted = task.completed;
              task.completed = update.completed;

              // Calculate points if task was just completed (not uncompleted)
              if (!wasCompleted && update.completed) {
                const points = calculateTaskPoints(task.optional, cycle.progress);
                pointsEarned += points;
                cycle.score = (cycle.score || 0) + points;
              } else if (wasCompleted && !update.completed) {
                // Subtract points if task was uncompleted
                const points = calculateTaskPoints(task.optional, cycle.progress);
                cycle.score = Math.max(0, (cycle.score || 0) - points);
                pointsEarned -= points;
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
    }

    // Recalculate progress after any changes
    calculateProgress(cycle);

    // Update lifetime score if points were earned
    if (pointsEarned > 0) {
      let userProfile = await UserProfile.findOne({ uuid: 'default-user' });
      if (!userProfile) {
        userProfile = new UserProfile({ uuid: 'default-user', lifetimeScore: 0 });
      }
      userProfile.lifetimeScore += pointsEarned;
      userProfile.updatedAt = new Date();
      await userProfile.save();
    }

    const savedCycle = await cycle.save();

    // Return points earned so frontend can show floating animation
    res.json({
      success: true,
      month: savedCycle,
      pointsEarned: pointsEarned,
      currentTier: require('../utils/scoreCalculator').getTierFromProgress(savedCycle.progress)
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
    
    cycle.finished = true;
    cycle.finishedAt = new Date();
    await cycle.save();
    
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
