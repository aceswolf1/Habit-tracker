/**
 * v2.1: detect a lifetime-XP level crossing and dispatch the
 * `levelUp` app event exactly once per crossing.
 *
 * `computeLevel(xp)` reads `shared/levels.levelInfo(xp)` and returns the
 * same `{level, title, xpIntoLevel, xpForNext, progress}` shape; we only
 * care about the `level` integer. We compare the level before and after
 * a PATCH `applyPointsEarned` and emit when the level rises.
 *
 * Lives in `utils/` so the store stays under the 400-line cap.
 */
import { emitAppEvent } from "../composables/useAppEvents";
import { levelInfo } from "./sharedLevels";

/**
 * `applyPointsEarned` calls this with the lifetime score BEFORE applying
 * `delta`. If the post-apply level is strictly greater, we emit
 * `levelUp` with the new level + title.
 *
 * `nextLifetimeScore` is the integer we'll have AFTER `applyPointsEarned`
 * (i.e. `Math.max(0, prev + delta)`). It can be passed straight from
 * the store's response if the caller prefers to compute it locally.
 */
export function emitLevelUpIfCrossed(
  previousLifetimeScore: number,
  nextLifetimeScore: number,
): void {
  const prev = levelInfo(previousLifetimeScore || 0).level;
  const next = levelInfo(nextLifetimeScore || 0).level;
  if (next <= prev) return;
  // `levelInfo.next` is the level we just entered.
  const fresh = levelInfo(nextLifetimeScore || 0);
  emitAppEvent("levelUp", { level: fresh.level, title: fresh.title });
}
