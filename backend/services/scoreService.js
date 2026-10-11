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
 */

'use strict';

const {
  calculateTaskPoints,
  getTierFromProgress,
} = require('../../shared/scoring');

/**
 * Apply a batch of completion flips to a cycle's score.
 *
 * Each flip is `{ optional, legendary, direction }` where direction
 * is `'complete'` (apply +points) or `'uncomplete'` (subtract -points).
 *
 * Behavior:
 * - Uses `cycle.progress` AS-IS (the caller is responsible for
 *   `calculateProgress(cycle)` first — UB-06).
 * - `complete` → `cycle.score += points`, `pointsEarned += points`.
 * - `uncomplete` → `cycle.score = max(0, cycle.score - points)`,
 *   `pointsEarned -= points`. UB-10: lifetime floor is the profile
 *   repo's job; this function only floors the cycle score.
 * - Legendary multiplier is applied by `calculateTaskPoints`.
 *
 * @param {object} cycle  mutates `cycle.score` in place.
 * @param {Array<{optional:boolean, legendary:boolean, direction:'complete'|'uncomplete'}>} flips
 * @returns {{ pointsEarned: number }}
 */
function scoreCompletionFlips(cycle, flips) {
  let pointsEarned = 0;
  if (!cycle || !Array.isArray(flips) || flips.length === 0) {
    return { pointsEarned };
  }

  const currentProgress = cycle.progress || 0;
  for (const flip of flips) {
    const points = calculateTaskPoints(
      !!flip.optional,
      currentProgress,
      !!flip.legendary
    );
    if (flip.direction === 'complete') {
      pointsEarned += points;
      cycle.score = (cycle.score || 0) + points;
    } else {
      // 'uncomplete' — symmetric reduction with floor 0
      cycle.score = Math.max(0, (cycle.score || 0) - points);
      pointsEarned -= points;
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
  tierFor,
};