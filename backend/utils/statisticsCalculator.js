/**
 * Statistics Calculator for PixelPaladin Month Completion
 *
 * Calculates comprehensive statistics when a month is finished:
 * - Week performance (best/worst weeks, consistency)
 * - Task completion rates (grouped by recurrenceId)
 * - Day of week patterns
 * - Perfect days and streaks
 * - Best/worst habits
 */

const { getTierFromProgress } = require('./scoreCalculator');

/**
 * Calculate statistics for all weeks in the month
 */
function calculateWeekStatistics(cycle) {
  if (!cycle || !cycle.weeks || cycle.weeks.length === 0) {
    return {
      weekStats: [],
      bestWeek: null,
      worstWeek: null,
      weekConsistency: 0
    };
  }

  const weekStats = cycle.weeks.map(week => {
    let requiredTotal = 0;
    let requiredCompleted = 0;
    let totalTasks = 0;
    let completedTasks = 0;

    for (const day of week.days) {
      for (const task of day.tasks) {
        totalTasks++;
        if (task.completed) completedTasks++;

        if (!task.optional) {
          requiredTotal++;
          if (task.completed) requiredCompleted++;
        }
      }
    }

    return {
      weekUuid: week.uuid,
      weekName: week.name,
      progress: week.progress || 0,
      tasksCompleted: completedTasks,
      tasksTotal: totalTasks,
      requiredCompleted,
      requiredTotal
    };
  });

  // Find best and worst weeks
  let bestWeek = weekStats[0];
  let worstWeek = weekStats[0];

  for (const week of weekStats) {
    if (week.progress > bestWeek.progress) {
      bestWeek = week;
    }
    if (week.progress < worstWeek.progress) {
      worstWeek = week;
    }
  }

  // Calculate consistency (standard deviation of week progress)
  const avgProgress = weekStats.reduce((sum, w) => sum + w.progress, 0) / weekStats.length;
  const variance = weekStats.reduce((sum, w) => sum + Math.pow(w.progress - avgProgress, 2), 0) / weekStats.length;
  const weekConsistency = Math.round(Math.sqrt(variance) * 100) / 100;

  return {
    weekStats,
    bestWeek: {
      weekUuid: bestWeek.weekUuid,
      weekName: bestWeek.weekName,
      progress: bestWeek.progress
    },
    worstWeek: {
      weekUuid: worstWeek.weekUuid,
      weekName: worstWeek.weekName,
      progress: worstWeek.progress
    },
    weekConsistency
  };
}

/**
 * Calculate task statistics grouped by recurrenceId
 * This tracks the same habit across the entire month
 */
function calculateTaskStatistics(cycle) {
  if (!cycle || !cycle.weeks) {
    return {
      totalTasks: 0,
      completedTasks: 0,
      taskCompletionRate: 0,
      requiredTasksCompleted: 0,
      requiredTasksTotal: 0,
      requiredCompletionRate: 0,
      optionalTasksCompleted: 0,
      optionalTasksTotal: 0,
      optionalCompletionRate: 0,
      legendaryTasksCompleted: 0
    };
  }

  let totalTasks = 0;
  let completedTasks = 0;
  let requiredTasksTotal = 0;
  let requiredTasksCompleted = 0;
  let optionalTasksTotal = 0;
  let optionalTasksCompleted = 0;
  let legendaryTasksCompleted = 0;

  for (const week of cycle.weeks) {
    for (const day of week.days) {
      for (const task of day.tasks) {
        totalTasks++;
        if (task.completed) {
          completedTasks++;
          if (task.legendary) legendaryTasksCompleted++;
        }

        if (task.optional) {
          optionalTasksTotal++;
          if (task.completed) optionalTasksCompleted++;
        } else {
          requiredTasksTotal++;
          if (task.completed) requiredTasksCompleted++;
        }
      }
    }
  }

  return {
    totalTasks,
    completedTasks,
    taskCompletionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
    requiredTasksCompleted,
    requiredTasksTotal,
    requiredCompletionRate: requiredTasksTotal > 0 ? Math.round((requiredTasksCompleted / requiredTasksTotal) * 100) : 0,
    optionalTasksCompleted,
    optionalTasksTotal,
    optionalCompletionRate: optionalTasksTotal > 0 ? Math.round((optionalTasksCompleted / optionalTasksTotal) * 100) : 0,
    legendaryTasksCompleted
  };
}

/**
 * Find best and worst habits based on completion rate
 * Groups tasks by recurrenceId to track same habit across month
 */
function calculateBestWorstHabits(cycle) {
  if (!cycle || !cycle.weeks) {
    return { bestHabit: null, worstHabit: null };
  }

  // Map to store habit statistics: recurrenceId -> { description, icon, completed, total }
  const habitMap = new Map();

  for (const week of cycle.weeks) {
    for (const day of week.days) {
      for (const task of day.tasks) {
        // Group by recurrenceId if available, otherwise use description as fallback
        const habitKey = task.recurrenceId || `single_${task.uuid}`;

        if (!habitMap.has(habitKey)) {
          habitMap.set(habitKey, {
            recurrenceId: task.recurrenceId || null,
            description: task.description,
            icon: task.icon,
            timesCompleted: 0,
            timesAppeared: 0
          });
        }

        const habit = habitMap.get(habitKey);
        habit.timesAppeared++;
        if (task.completed) {
          habit.timesCompleted++;
        }
      }
    }
  }

  // Calculate completion rates and filter out single-occurrence tasks
  const habits = Array.from(habitMap.values())
    .filter(h => h.timesAppeared > 1) // Only consider habits that appear multiple times
    .map(h => ({
      ...h,
      completionRate: Math.round((h.timesCompleted / h.timesAppeared) * 100)
    }))
    .filter(h => h.timesAppeared >= 2); // At least 2 occurrences to be meaningful

  if (habits.length === 0) {
    return { bestHabit: null, worstHabit: null };
  }

  // Sort by completion rate
  habits.sort((a, b) => b.completionRate - a.completionRate);

  const bestHabit = habits[0];
  const worstHabit = habits[habits.length - 1];

  return {
    bestHabit: {
      description: bestHabit.description,
      icon: bestHabit.icon,
      recurrenceId: bestHabit.recurrenceId,
      completionRate: bestHabit.completionRate,
      timesCompleted: bestHabit.timesCompleted,
      timesAppeared: bestHabit.timesAppeared
    },
    worstHabit: habits.length > 1 ? {
      description: worstHabit.description,
      icon: worstHabit.icon,
      recurrenceId: worstHabit.recurrenceId,
      completionRate: worstHabit.completionRate,
      timesCompleted: worstHabit.timesCompleted,
      timesAppeared: worstHabit.timesAppeared
    } : null
  };
}

/**
 * Calculate day of week statistics (Mon, Tue, Wed, etc.)
 * Aggregates all Mondays together, all Tuesdays together, etc.
 */
function calculateDayOfWeekStatistics(cycle) {
  if (!cycle || !cycle.weeks) {
    return {
      dayOfWeekStats: [],
      bestDayOfWeek: null,
      worstDayOfWeek: null
    };
  }

  // Map to store day statistics: dayName -> { totalDays, completionSum, perfectDays }
  const dayMap = new Map();
  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  // Initialize map
  dayNames.forEach(name => {
    dayMap.set(name, {
      dayName: name,
      totalDaysInMonth: 0,
      completionSum: 0,
      perfectDays: 0
    });
  });

  for (const week of cycle.weeks) {
    for (const day of week.days) {
      const dayStats = dayMap.get(day.name);
      if (!dayStats) continue;

      dayStats.totalDaysInMonth++;

      // Calculate day completion rate (required tasks only)
      const requiredTasks = day.tasks.filter(t => !t.optional);
      const requiredCompleted = requiredTasks.filter(t => t.completed);

      if (requiredTasks.length > 0) {
        const dayCompletion = (requiredCompleted.length / requiredTasks.length) * 100;
        dayStats.completionSum += dayCompletion;

        if (dayCompletion === 100) {
          dayStats.perfectDays++;
        }
      }
    }
  }

  // Calculate averages
  const dayOfWeekStats = Array.from(dayMap.values()).map(day => ({
    dayName: day.dayName,
    averageCompletion: day.totalDaysInMonth > 0
      ? Math.round(day.completionSum / day.totalDaysInMonth)
      : 0,
    totalDaysInMonth: day.totalDaysInMonth,
    perfectDays: day.perfectDays
  }));

  // Find best and worst days
  const sortedDays = [...dayOfWeekStats].sort((a, b) => b.averageCompletion - a.averageCompletion);

  return {
    dayOfWeekStats,
    bestDayOfWeek: sortedDays[0] ? {
      dayName: sortedDays[0].dayName,
      completion: sortedDays[0].averageCompletion
    } : null,
    worstDayOfWeek: sortedDays[sortedDays.length - 1] ? {
      dayName: sortedDays[sortedDays.length - 1].dayName,
      completion: sortedDays[sortedDays.length - 1].averageCompletion
    } : null
  };
}

/**
 * Count perfect days (days with 100% required task completion)
 */
function calculatePerfectDays(cycle) {
  if (!cycle || !cycle.weeks) return 0;

  let perfectDaysCount = 0;

  for (const week of cycle.weeks) {
    for (const day of week.days) {
      const requiredTasks = day.tasks.filter(t => !t.optional);
      const requiredCompleted = requiredTasks.filter(t => t.completed);

      if (requiredTasks.length > 0 && requiredCompleted.length === requiredTasks.length) {
        perfectDaysCount++;
      }
    }
  }

  return perfectDaysCount;
}

/**
 * Calculate longest streak of consecutive perfect days
 */
function calculateStreaks(cycle) {
  if (!cycle || !cycle.weeks) return 0;

  let longestStreak = 0;
  let currentStreak = 0;

  for (const week of cycle.weeks) {
    for (const day of week.days) {
      const requiredTasks = day.tasks.filter(t => !t.optional);
      const requiredCompleted = requiredTasks.filter(t => t.completed);

      const isPerfectDay = requiredTasks.length > 0 && requiredCompleted.length === requiredTasks.length;

      if (isPerfectDay) {
        currentStreak++;
        if (currentStreak > longestStreak) {
          longestStreak = currentStreak;
        }
      } else {
        currentStreak = 0;
      }
    }
  }

  return longestStreak;
}

/**
 * Main function to calculate all statistics for a finished month
 */
function calculateAllStatistics(cycle) {
  if (!cycle) {
    throw new Error('Cycle is required for statistics calculation');
  }

  // Calculate all stat categories
  const weekStats = calculateWeekStatistics(cycle);
  const taskStats = calculateTaskStatistics(cycle);
  const habitStats = calculateBestWorstHabits(cycle);
  const dayStats = calculateDayOfWeekStatistics(cycle);
  const totalPerfectDays = calculatePerfectDays(cycle);
  const longestStreak = calculateStreaks(cycle);

  // Calculate bonus percentage
  const baseProgress = Math.min(100, cycle.progress || 0);
  const bonusPercentage = Math.max(0, (cycle.progress || 0) - 100);

  return {
    // Week stats
    ...weekStats,

    // Task stats
    ...taskStats,

    // Best/worst habits
    ...habitStats,

    // Day of week stats
    ...dayStats,

    // Perfect days
    totalPerfectDays,

    // Streaks
    longestStreak,

    // Overall summary
    finalTier: getTierFromProgress(cycle.progress || 0),
    totalXP: cycle.score || 0,
    finalProgress: cycle.progress || 0,
    bonusPercentage: Math.round(bonusPercentage),

    // Metadata
    calculatedAt: new Date()
  };
}

module.exports = {
  calculateWeekStatistics,
  calculateTaskStatistics,
  calculateBestWorstHabits,
  calculateDayOfWeekStatistics,
  calculatePerfectDays,
  calculateStreaks,
  calculateAllStatistics
};
