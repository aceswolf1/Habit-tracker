/**
 * Pure network orchestration for the cycle store (UB-51, W4 split).
 *
 * Each helper takes the Pinia store instance as a parameter and operates
 * on `this`-less. They all flip `isLoading`/`error`, refresh summaries
 * when relevant, and use `applyProgressToCopy` so the store's owned
 * `currentMonth` is replaced by a fresh shape rather than mutated.
 *
 * Move-leaving alone: the `monthStore` actions remain the public entry
 * point. They become thin one-liners that call into here — no signature
 * change for consumers.
 */

import type { FinishResult } from "../types/index";
import {
  createCycle as apiCreateCycle,
  finishCycle as apiFinishCycle,
  getCycle as apiGetCycle,
  getCurrent as apiGetCurrent,
  getProfile as apiGetProfile,
  listCycles as apiListCycles,
} from "../services/cycleApi";
import { applyProgressToCopy } from "./cycleCloning";
import type { useMonthStore } from "../stores/monthStore";

type Store = ReturnType<typeof useMonthStore>;

export async function fetchMonthDataAction(store: Store): Promise<void> {
  store.isLoading = true;
  store.error = null;
  try {
    const list = await apiListCycles();
    store.months = list.summaries;

    try {
      store.profile = await apiGetProfile();
    } catch (err) {
      store.profile = null;
      // eslint-disable-next-line no-console
      console.error("Profile fetch failed", err);
    }

    let currentCycle: Awaited<ReturnType<typeof apiGetCycle>> | null = null;
    const firstUnfinished = store.months.find((m) => !m.finished);
    const candidateUuid = firstUnfinished?.uuid || store.months[0]?.uuid;
    if (candidateUuid) {
      try {
        currentCycle = await apiGetCycle(candidateUuid);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("Cycle fetch failed", err);
      }
    }
    if (!currentCycle) {
      // Auto-create via /current (contract §3).
      try {
        currentCycle = await apiGetCurrent();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("Auto-create current failed", err);
      }
      // Refresh summaries so the new cycle shows up in the selector.
      try {
        const refresh = await apiListCycles();
        store.months = refresh.summaries;
      } catch {
        /* keep prior summaries */
      }
    }
    if (currentCycle) {
      store.currentMonth = applyProgressToCopy(currentCycle);
      store.currentMonthUuid = currentCycle.uuid;
    }
  } catch (err) {
    store.error =
      err instanceof Error ? err.message : "Unknown error occurred";
  } finally {
    store.isLoading = false;
  }
}

/**
 * Switch to a different cycle by loading its full payload via `getCycle`
 * (contract §3 GET /:id). Summaries are refreshed in the background so
 * the month switcher updates.
 */
export async function setCurrentMonthAction(
  store: Store,
  uuid: string,
): Promise<void> {
  store.isLoading = true;
  store.error = null;
  try {
    const cycle = await apiGetCycle(uuid);
    store.currentMonth = applyProgressToCopy(cycle);
    store.currentMonthUuid = uuid;
    apiListCycles()
      .then((res) => {
        store.months = res.summaries;
      })
      .catch(() => {
        /* selector keep current */
      });
  } catch (err) {
    store.error = err instanceof Error ? err.message : "Unknown error";
    // eslint-disable-next-line no-console
    console.error("Month not found with uuid:", uuid, err);
  } finally {
    store.isLoading = false;
  }
}

export async function createMonthAction(
  store: Store,
  name?: string,
): Promise<void> {
  store.isLoading = true;
  store.error = null;
  try {
    const cycle = await apiCreateCycle(name);
    store.currentMonth = applyProgressToCopy(cycle);
    store.currentMonthUuid = cycle.uuid;
    const refresh = await apiListCycles();
    store.months = refresh.summaries;
  } catch (err) {
    store.error =
      err instanceof Error ? err.message : "Unknown error occurred";
  } finally {
    store.isLoading = false;
  }
}

export async function finishCurrentMonthAction(
  store: Store,
): Promise<FinishResult | undefined> {
  if (!store.currentMonth || store.currentMonth.finished) return undefined;
  store.isLoading = true;
  try {
    const result = await apiFinishCycle(store.currentMonth.uuid);
    store.currentMonth = applyProgressToCopy(result.cycle);
    try {
      const refresh = await apiListCycles();
      store.months = refresh.summaries;
    } catch {
      /* keep prior summaries */
    }
    return result;
  } catch (err) {
    store.error =
      err instanceof Error ? err.message : "Failed to finish month";
    // eslint-disable-next-line no-console
    console.error("Error finishing month:", err);
    return undefined;
  } finally {
    store.isLoading = false;
  }
}

/** Reset by refetching everything — used by the settings drawer. */
export async function resetToOriginalAction(store: Store): Promise<void> {
  await fetchMonthDataAction(store);
}
