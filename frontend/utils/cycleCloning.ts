/**
 * Pure cycle cloning + progress math helpers (UB-51, W4 split).
 *
 * The store uses these in `applyProgressToCopy`/`refreshProgressLocal`
 * to keep any optimistic mutation off the actual store state and to avoid
 * a parallel implementation of `calculateProgress`.
 */

import { calculateProgress } from "./sharedProgress";
import type { Cycle } from "../types/index";

/** Deep-clone a cycle (or any plain JSON-shaped object). */
export function deepCloneCycle<T>(cycle: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(cycle);
  }
  return JSON.parse(JSON.stringify(cycle));
}

/**
 * Apply the shared `calculateProgress` to a deep copy of `cycle` and
 * return the copy. Refresh paths (fetch / setCurrentMonth / finish /
 * PATCH success) use this so the store never mutates its owned state
 * in place for these code paths.
 */
export function applyProgressToCopy(cycle: Cycle): Cycle {
  const copy = deepCloneCycle(cycle);
  calculateProgress(copy);
  return copy;
}

/** Run shared progress math on the cycle in place. */
export function refreshProgressLocal(cycle: Cycle | null | undefined): void {
  if (cycle) calculateProgress(cycle);
}
