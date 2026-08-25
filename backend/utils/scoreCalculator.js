/**
 * Point calculation utility for PixelPaladin scoring system
 *
 * Tier-based points system:
 * - Bronze (0-24%): Required = 10, Optional = 5
 * - Silver (25-49%): Required = 15, Optional = 7
 * - Gold (50-74%): Required = 20, Optional = 10
 * - Champion (75-99%): Required = 25, Optional = 12
 * - Final (100%+): Required = 30, Optional = 15
 *
 * Legendary tasks receive 3x score multiplier
 */

// Get the tier name based on progress percentage
function getTierFromProgress(progress) {
  if (progress >= 100) return 'Final';
  if (progress >= 75) return 'Champion';
  if (progress >= 50) return 'Gold';
  if (progress >= 25) return 'Silver';
  return 'Bronze';
}

// Get point values for a given tier
function getPointsForTier(tier) {
  const pointMap = {
    'Bronze': { required: 10, optional: 5 },
    'Silver': { required: 15, optional: 7 },
    'Gold': { required: 20, optional: 10 },
    'Champion': { required: 25, optional: 12 },
    'Final': { required: 30, optional: 15 }
  };
  return pointMap[tier] || pointMap['Bronze'];
}

// Calculate points for completing a task based on current progress
function calculateTaskPoints(isOptional, currentProgress, isLegendary = false) {
  const tier = getTierFromProgress(currentProgress);
  const points = getPointsForTier(tier);
  let basePoints = isOptional ? points.optional : points.required;

  // Apply 3x multiplier for legendary tasks
  if (isLegendary) {
    basePoints *= 3;
  }

  return basePoints;
}

// Calculate total score for a month based on all completed tasks
function calculateMonthScore(month) {
  let totalScore = 0;

  if (!month || !month.weeks) return 0;

  for (const week of month.weeks) {
    for (const day of week.days) {
      for (const task of day.tasks) {
        if (task.completed) {
          // For recalculating score, we use current progress as baseline
          const points = calculateTaskPoints(
            task.optional,
            month.progress || 0,
            task.legendary || false
          );
          totalScore += points;
        }
      }
    }
  }

  return totalScore;
}

module.exports = {
  getTierFromProgress,
  getPointsForTier,
  calculateTaskPoints,
  calculateMonthScore
};
