/**
 * Achievement catalog + evaluator (v2.3).
 *
 * Contract (development/v2-features/orchestration-ctx/decisions/contract-v2.3.md
 * §1) — 16 achievements keyed off history. Strike-based ones count from
 * v2.2 data (that's when combos started being stored).
 *
 *   ACHIEVEMENTS              the catalog (id → { name, description, size,
 *                              metric, target })
 *   evaluateAchievements(s)   turns a `stats` object into a list of
 *                              [{ id, unlocked, progress, current, target }]
 *                              rows the FE can render (locked or unlocked).
 *
 * F4: each unlocked achievement grants credits ONCE (small=10, medium=25,
 * large=50). XP, tiers and lifetime score never move.
 */

'use strict';

const { TIER_THRESHOLDS } = require('./scoring');

/** Catalog. The order in the list is the display order in the Vault. */
const ACHIEVEMENTS = [
  { id: 'first-blood',   name: 'FIRST BLOOD',    description: 'Complete your first habit.',                     size: 'small',  metric: 'completions',         target: 1 },
  { id: 'grinder-10',    name: 'GRINDER',        description: 'Complete 10 habits.',                           size: 'small',  metric: 'completions',         target: 10 },
  { id: 'grinder-100',   name: 'CENTURION',      description: 'Complete 100 habits.',                          size: 'medium', metric: 'completions',         target: 100 },
  { id: 'grinder-500',   name: 'MACHINE',        description: 'Complete 500 habits.',                          size: 'large',  metric: 'completions',         target: 500 },
  { id: 'month-1',       name: 'CYCLE CLEARED',  description: 'Finish one month.',                             size: 'small',  metric: 'finishedMonths',      target: 1 },
  { id: 'month-3',       name: 'VETERAN',        description: 'Finish three months.',                          size: 'medium', metric: 'finishedMonths',      target: 3 },
  { id: 'month-12',      name: 'YEAR OF STEEL',  description: 'Finish twelve months.',                         size: 'large',  metric: 'finishedMonths',      target: 12 },
  { id: 'tier-silver',   name: 'SILVER LINING',  description: 'Reach Silver tier in any month.',               size: 'small',  metric: 'bestTierReached',     target: 1 },
  { id: 'tier-gold',     name: 'GOLD RUSH',      description: 'Reach Gold tier in any month.',                 size: 'medium', metric: 'bestTierReached',     target: 2 },
  { id: 'tier-champion', name: 'CHAMPION',       description: 'Reach Champion tier in any month.',             size: 'medium', metric: 'bestTierReached',     target: 3 },
  { id: 'tier-final',    name: 'FINAL FORM',     description: 'Reach Final tier in any month.',                size: 'large',  metric: 'bestTierReached',     target: 4 },
  { id: 'perfect-3',     name: 'CLEAN SWEEP',    description: 'Three perfect days in a row (history).',       size: 'small',  metric: 'longestPerfectStreak',target: 3 },
  { id: 'perfect-7',     name: 'FLAWLESS WEEK',  description: 'Seven perfect days in a row.',                  size: 'medium', metric: 'longestPerfectStreak',target: 7 },
  { id: 'strike-2',      name: 'DOUBLE TAP',     description: 'Land a 2-day strike combo.',                    size: 'small',  metric: 'bestCombo',           target: 2 },
  { id: 'strike-5',      name: 'PENTA STRIKE',   description: 'Land a 5-strike combo.',                        size: 'large',  metric: 'bestCombo',           target: 5 },
  { id: 'level-10',      name: 'RUNNER',         description: 'Reach level 10 (RUNNER).',                      size: 'medium', metric: 'level',               target: 10 },
];

/** F4: size → credit reward when an achievement unlocks. */
const ACHIEVEMENT_CREDITS = {
  small: 10,
  medium: 25,
  large: 50,
};

/**
 * Resolve `bestTierReached` (Bronze=0 .. Final=4) from a max progress
 * number. Used when stats are supplied without a tier flag already set.
 */
function indexOfTier(progress) {
  // TIER_THRESHOLDS is sorted descending by `min`; first hit wins.
  const v = Math.max(0, Number(progress) || 0);
  for (let i = 0; i < TIER_THRESHOLDS.length; i++) {
    if (v >= TIER_THRESHOLDS[i].min) return TIER_THRESHOLDS.length - 1 - i;
  }
  return 0;
}

/**
 * Walk the catalog against `stats` and produce a row per achievement.
 *
 * Input `stats` shape:
 *   {
 *     completions: number,
 *     finishedMonths: number,
 *     bestTierReached: number,         // 0..4 (Bronze..Final)
 *     longestPerfectStreak: number,
 *     bestCombo: number,
 *     level: number,
 *     legendaryCompletions: number,
 *   }
 *
 * Output: array in catalog order; each row carries `unlocked`, `progress`
 * (0..1), `current`, `target`, plus the catalog fields. Helpers can join
 * this against the `unlockedAt` table on the profile.
 */
function evaluateAchievements(stats) {
  const s = stats || {};
  const rows = [];
  for (const a of ACHIEVEMENTS) {
    const current = readMetric(s, a.metric);
    const target = a.target;
    const progress = target > 0 ? Math.min(1, Math.max(0, current / target)) : 1;
    const unlocked = current >= target;
    rows.push({
      id: a.id,
      name: a.name,
      description: a.description,
      size: a.size,
      credits: ACHIEVEMENT_CREDITS[a.size] || 0,
      metric: a.metric,
      target,
      current,
      progress,
      unlocked,
    });
  }
  return rows;
}

function readMetric(stats, metric) {
  const n = Number(stats[metric]);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

module.exports = {
  ACHIEVEMENTS,
  ACHIEVEMENT_CREDITS,
  evaluateAchievements,
  // exposed for tests
  indexOfTier,
};
