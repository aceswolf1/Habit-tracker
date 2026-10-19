/**
 * Rewards math (v2.3) — chests, rarity rolls, level rewards.
 *
 * Contract (development/v2-features/orchestration-ctx/decisions/contract-v2.3.md
 * §1) — single source of truth for the BE and FE.
 *
 *   - `CHEST_CREDITS`: rarity → credits awarded on claim.
 *   - `chestOdds(level)`: probability buckets per chest level.
 *   - `rollRarity(level, rand=Math.random)`: pick a rarity using `rand`
 *     (injectable for tests).
 *   - `nextRewardInfo(lifetimeXp)`: what the player is saving toward.
 *
 * Credits (D5) live only in this file — never on XP, tier or lifetime score.
 */

'use strict';

const { levelInfo } = require('./levels');

/** Rarity → credits awarded on a successful claim (F2). */
const CHEST_CREDITS = {
  common: 10,
  rare: 25,
  epic: 50,
  legendary: 100,
};

const RARITIES = ['common', 'rare', 'epic', 'legendary'];

/**
 * Rarity odds per chest level (F2). Sums to 1.0 at every level band.
 *
 *   <10:     .60/.25/.12/.03
 *   10..19:  .45/.30/.18/.07
 *   20+:     .30/.35/.25/.10
 */
function chestOdds(level) {
  const lv = Math.max(1, Math.floor(Number(level) || 1));
  if (lv < 10) {
    return { common: 0.60, rare: 0.25, epic: 0.12, legendary: 0.03 };
  }
  if (lv < 20) {
    return { common: 0.45, rare: 0.30, epic: 0.18, legendary: 0.07 };
  }
  return { common: 0.30, rare: 0.35, epic: 0.25, legendary: 0.10 };
}

/**
 * Roll a rarity for a chest at the given level. `rand` returns a number
 * in `[0, 1)` (default: `Math.random`). Probabilities come from `chestOdds`.
 *
 * Returns one of `'common' | 'rare' | 'epic' | 'legendary'`.
 */
function rollRarity(level, rand) {
  const r = typeof rand === 'function' ? rand : Math.random;
  const raw = r();
  // Defensive: a misbehaving `rand` (NaN, <0, ≥1) collapses to common so
  // we never crash on a downstream bug and never silently skew the
  // distribution by clamping to a wrap-around bucket.
  const sample = (Number.isFinite(raw) && raw >= 0 && raw < 1) ? raw : 0;
  const odds = chestOdds(level);
  let acc = 0;
  for (const rarity of RARITIES) {
    acc += odds[rarity];
    if (sample < acc) return rarity;
  }
  return 'common';
}

/**
 * What the player is saving toward. The `nextRewardInfo` is the
 * public-facing header copy; it points one level past the player's current
 * level plus the remaining XP to that band.
 *
 *   { level: 3, xpRemaining: 100 }   ← the player is on level 2 and needs
 *   another 100 XP for the next chest.
 *
 * For an ARCHON (top band, no next level) `level: null` and `xpRemaining: null`.
 * Callers should display `—` or "MAX BAND" then.
 */
function nextRewardInfo(lifetimeXp) {
  const info = levelInfo(lifetimeXp);
  if (info.xpForNext === null) {
    // Archon — nothing to save toward.
    return { level: null, xpRemaining: null };
  }
  return {
    level: info.level + 1,
    xpRemaining: Math.max(0, info.xpForNext - info.xpIntoLevel),
  };
}

module.exports = {
  CHEST_CREDITS,
  chestOdds,
  rollRarity,
  nextRewardInfo,
  _RARITIES: RARITIES,
};
