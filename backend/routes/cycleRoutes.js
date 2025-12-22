const express = require('express');
const router = express.Router();
const Cycle = require('../models/Cycle');

// Helper function to generate UUID
function generateUuid(prefix = 'c') {
  return `${prefix}-${Math.random().toString(36).slice(2)}`;
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

    // Handle different operation types
    if (type === 'updateTasks') {
      // Update task completion status
      for (const update of updates) {
        for (const week of cycle.weeks) {
          for (const day of week.days) {
            const task = day.tasks.find(t => t.uuid === update.uuid);
            if (task) {
              task.completed = update.completed;
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

    const savedCycle = await cycle.save();
    res.json({ success: true, month: savedCycle });
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
