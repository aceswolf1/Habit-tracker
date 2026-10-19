/**
 * v2.3 — tiny hook so `monthStore` can forward PATCH/finish `rewards`
 * to the rewards store without growing itself past the 400-line cap.
 *
 * Lifecycle:
 *   - All three mutating call sites (toggle / bulk-add / finish) call
 *     `forwardRewardsEvent(res.rewards)` from inside their `onSuccess`
 *     closures (see `cycleNetwork.ts`).
 *   - The hook defers `useRewardsStore()` to function-call time so the
 *     Pinia setup phase doesn't try to resolve both stores at once.
 */
import type { PatchRewardEvent } from "../types/index";
import { useRewardsStore } from "../stores/rewardsStore";

/**
 * Forward a PATCH/finish `rewards` block to the rewards store. Safe to
 * call with `undefined` (no-op). The store emits `chestEarned` /
 * `achievementUnlocked` toasts and refetches with a 1 s debounce.
 */
export function forwardRewardsEvent(rewards?: PatchRewardEvent | null): void {
  if (!rewards) return;
  try {
    const store = useRewardsStore();
    store.applyRewardEvent(rewards);
  } catch {
    // Defensive: never let a rewards-side wiring issue break the cycle.
  }
}
