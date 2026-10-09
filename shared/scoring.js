/**
 * Shared scoring / tier helpers (CJS).
 * Single source of truth for BE scoreCalculator + FE consumers.
 *
 * Tier-based points:
 * - Bronze (0-24%): Required = 10, Optional = 5
 * - Silver (25-49%): Required = 15, Optional = 7
 * - Gold (50-74%): Required = 20, Optional = 10
 * - Champion (75-99%): Required = 25, Optional = 12
 * - Final (100%+): Required = 30, Optional = 15
 *
 * Legendary tasks receive 3x score multiplier.
 */

'use strict';

const TIER_POINTS = {
  Bronze: { required: 10, optional: 5 },
  Silver: { required: 15, optional: 7 },
  Gold: { required: 20, optional: 10 },
  Champion: { required: 25, optional: 12 },
  Final: { required: 30, optional: 15 },
};

const TIER_THRESHOLDS = [
  { name: 'Final', min: 100 },
  { name: 'Champion', min: 75 },
  { name: 'Gold', min: 50 },
  { name: 'Silver', min: 25 },
  { name: 'Bronze', min: 0 },
];

function getTierFromProgress(progress) {
  const value = Number(progress) || 0;
  for (const tier of TIER_THRESHOLDS) {
    if (value >= tier.min) return tier.name;
  }
  return 'Bronze';
}

function getPointsForTier(tier) {
  return TIER_POINTS[tier] || TIER_POINTS.Bronze;
}

function calculateTaskPoints(isOptional, currentProgress, isLegendary = false) {
  const tier = getTierFromProgress(currentProgress);
  const points = getPointsForTier(tier);
  let basePoints = isOptional ? points.optional : points.required;

  if (isLegendary) {
    basePoints *= 3;
  }

  return basePoints;
}

function calculateMonthScore(month) {
  let totalScore = 0;

  if (!month || !month.weeks) return 0;

  for (const week of month.weeks) {
    for (const day of week.days) {
      for (const task of day.tasks) {
        if (task.completed) {
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
  TIER_POINTS,
  TIER_THRESHOLDS,
  getTierFromProgress,
  getPointsForTier,
  calculateTaskPoints,
  calculateMonthScore,
};
