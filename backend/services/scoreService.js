/**
 * Pure scoring + tier helpers (W3 layer contract).
 *
 * No I/O. No req/res. No mongoose / model imports.
 * Single source of truth for BE scoring is `shared/scoring` (CJS);
 * `backend/utils/scoreCalculator.js` is a thin re-export of it, so
 * porting the scoring loop out of `backend/routes/cycleRoutes.js`
 * into this service is behavior-preserving.
 *
 * IMPORTANT (UB-06): callers MUST recalculate cycle progress before
 * invoking `scoreCompletionFlips`, so the points use the post-flip
 * tier. `calculateProgress` lives in `shared/progress`.
 *
 * v2.2 (E1–E4): the scoring service now also handles per-task strike
 * combos. `scoreCompletionFlips` reads `flip.basePoints` + `flip.bonus`
 * (the calling layer computes them) and rolls them into `cycle.score`
 * + `pointsEarned`. The bonus is forward-only (E4) and is stored on
 * the task so an un-check reverses it exactly.
 */

'use strict';

const {
  calculateTaskPoints,
  getTierFromProgress,
} = require('../../shared/scoring');
const { comboMultiplier } = require('../../shared/combos');

/**
 * Compute the XP breakdown for a single false→true flip:
 *   base = calculateTaskPoints(optional, cycleProgress, legendary)
 *   bonus = round(base * comboMultiplier(combo)) - base   (>=0)
 *
 * `combo` defaults to 1 when the caller hasn't looked one up yet
 * (e.g. first-ever completion) — bonus collapses to 0.
 */
function scoreForCompletion(combo, optional, cycleProgress, legendary) {
  const base = calculateTaskPoints(!!optional, cycleProgress, !!legendary);
  const mult = comboMultiplier(combo);
  // Round at the XP granularity so a Bronze × 1.25 stays a clean integer.
  const total = Math.round(base * mult);
  const bonus = Math.max(0, total - base);
  return { base, bonus, total };
}

/**
 * Apply a batch of completion flips to a cycle's score.
 *
 * Each flip is either:
 *   - `{ optional, legendary, direction:'complete'|'uncomplete',
 *      basePoints, bonus }` for v2.2 (the caller computes base+bonus
 *      per flip so combo lookups are honored).
 *   - `{ optional, legendary, direction:'complete'|'uncomplete' }`
 *      for legacy/v2.1 callers (no bonus math; bonus=0).
 *
 * Behavior:
 * - Uses `cycle.progress` AS-IS (the caller is responsible for
 *   `calculateProgress(cycle)` first — UB-06).
 * - `complete` → `cycle.score += base + bonus`, `pointsEarned += base + bonus`.
 * - `uncomplete` → `cycle.score = max(0, cycle.score - (base + bonus))`,
 *   `pointsEarned -= (base + bonus)`. UB-10: lifetime floor is the profile
 *   repo's job; this function only floors the cycle score.
 * - Legendary multiplier is applied by `calculateTaskPoints` *or* is
 *   pre-baked into `basePoints` (the v2.2 path).
 *
 * @param {object} cycle  mutates `cycle.score` in place.
 * @param {Array<object>} flips
 * @returns {{ pointsEarned: number }}
 */
function scoreCompletionFlips(cycle, flips) {
  let pointsEarned = 0;
  if (!cycle || !Array.isArray(flips) || flips.length === 0) {
    return { pointsEarned };
  }

  const currentProgress = cycle.progress || 0;
  for (const flip of flips) {
    let base;
    let bonus = 0;
    if (typeof flip.basePoints === 'number') {
      // v2.2 path — caller pre-computed the base (and optional bonus).
      base = flip.basePoints;
      // The patch orchestrator may set either `flip.bonus` (legacy name)
      // or `flip.comboBonus` (the contract field). Prefer comboBonus.
      bonus = (typeof flip.comboBonus === 'number' ? flip.comboBonus
        : (typeof flip.bonus === 'number' ? flip.bonus : 0));
    } else {
      // v2.1 path — compute base from the legacy signature.
      base = calculateTaskPoints(
        !!flip.optional,
        currentProgress,
        !!flip.legendary
      );
      // Pre-v2.2 flips may carry a stored bonus to subtract.
      if (flip.direction === 'uncomplete') {
        bonus = (typeof flip.comboBonus === 'number' ? flip.comboBonus : 0);
      }
    }
    const amount = base + bonus;
    if (flip.direction === 'complete') {
      pointsEarned += amount;
      cycle.score = (cycle.score || 0) + amount;
    } else {
      // 'uncomplete' — symmetric reduction with floor 0
      cycle.score = Math.max(0, (cycle.score || 0) - amount);
      pointsEarned -= amount;
    }
  }

  return { pointsEarned };
}

/**
 * Resolve a tier name from a progress percentage.
 * Delegates to `shared/scoring.getTierFromProgress` so the BE and FE
 * never drift on tier thresholds.
 *
 * @param {number} progress integer 0–110 (per `calculateProgress`)
 * @returns {'Bronze'|'Silver'|'Gold'|'Champion'|'Final'}
 */
function tierFor(progress) {
  return getTierFromProgress(progress);
}

module.exports = {
  scoreCompletionFlips,
  scoreForCompletion,
  tierFor,
};