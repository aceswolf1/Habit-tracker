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

// Legacy endpoint for various month operations
router.post('/', async (req, res) => {
  try {
    const { type, monthUuid, name } = req.body;

    if (type === 'createMonth') {
      // Create a new empty month
      const monthData = createEmptyMonth(name);
      const cycle = new Cycle(monthData);
      const savedCycle = await cycle.save();
      res.json({ success: true, month: savedCycle });

    } else if (type === 'setCurrentMonth') {
      // Set current month (for now, just return success as we use the finished flag)
      res.json({ success: true });

    } else if (type === 'finishMonth') {
      // Finish a month
      const cycle = await Cycle.findOne({ uuid: monthUuid });
      if (!cycle) {
        return res.status(404).json({ message: 'Cycle not found' });
      }

      cycle.finished = true;
      cycle.finishedAt = new Date();
      await cycle.save();

      res.json({ success: true, month: cycle });

    } else {
      res.status(400).json({ message: 'Invalid operation type' });
    }
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
