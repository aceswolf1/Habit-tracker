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

import type { FinishResult, Insights, Profile } from "../types/index";
import {
  createCycle as apiCreateCycle,
  finishCycle as apiFinishCycle,
  getCycle as apiGetCycle,
  getCurrent as apiGetCurrent,
  getProfile as apiGetProfile,
  getInsights as apiGetInsights,
  listCycles as apiListCycles,
  patchCycle as apiPatchCycle,
  updateProfile as apiUpdateProfile,
} from "../services/cycleApi";
import { applyProgressToCopy } from "./cycleCloning";
import { emitAppEvent } from "../composables/useAppEvents";
import { forwardRewardsEvent } from "./rewardsBridge";
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
    // v2.2: best-effort insights fetch. Failures are non-fatal — the
    // combat log / telemetry pages show an empty state when absent.
    await fetchInsightsAction(store);
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
  startDate?: string,
): Promise<void> {
  store.isLoading = true;
  store.error = null;
  try {
    const cycle = await apiCreateCycle(name, startDate);
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
): Promise<void> {
  if (!store.currentMonth || store.currentMonth.finished) return;
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
    // v2.2: emit `monthFinished` so the certificate modal (W2) can
    // open itself. `finishCurrentMonthAction` no longer returns the
    // FinishResult — callers wanting it should use the API directly or
    // await this and read `store.currentMonth` for the updated cycle.
    emitAppEvent("monthFinished", { cycleUuid: result.cycle.uuid });
    // v2.3: forward the finish `rewards` block (chests / achievements
    // unlocked by history + the just-finished month). The bridge emits
    // the toast events and debounces a refetch so names + IDs land.
    forwardRewardsEvent(result.rewards);
    void result;
  } catch (err) {
    store.error =
      err instanceof Error ? err.message : "Failed to finish month";
    // eslint-disable-next-line no-console
    console.error("Error finishing month:", err);
  } finally {
    store.isLoading = false;
  }
}

/**
 * v2.2: refresh the read-only insights payload from
 * `GET /api/cycles/insights`. Failures are swallowed (insights is
 * advisory; combat log / perfect streak UI should never break the page).
 */
export async function fetchInsightsAction(store: Store): Promise<Insights | null> {
  try {
    const insights = await apiGetInsights();
    store.insights = insights;
    return insights;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Insights fetch failed", err);
    return null;
  }
}

// v2.2: debounce timer shared by the toggle path. Coalesces multiple
// rapid toggles into a single insights fetch.
let insightsRefreshTimer: ReturnType<typeof setTimeout> | null = null;
const INSIGHTS_DEBOUNCE_MS = 1000;

/**
 * v2.2: schedule a debounced insights refresh. Multiple calls within
 * `INSIGHTS_DEBOUNCE_MS` collapse to one fetch.
 */
export function scheduleInsightsRefresh(store: Store): void {
  if (insightsRefreshTimer) clearTimeout(insightsRefreshTimer);
  insightsRefreshTimer = setTimeout(() => {
    insightsRefreshTimer = null;
    void fetchInsightsAction(store);
  }, INSIGHTS_DEBOUNCE_MS);
}

/** Reset by refetching everything — used by the settings drawer. */
export async function resetToOriginalAction(store: Store): Promise<void> {
  await fetchMonthDataAction(store);
}

/**
 * v2.1: set or clear the CURRENT cycle's `startDate` (a Monday
 * 'YYYY-MM-DD' or `null`). Patches via `updateCycle`, refreshes the
 * summaries list, and replaces `currentMonth` with the patched cycle.
 *
 * The backend rejects non-Mondays with 400 `VALIDATION_ERROR` and
 * throws 409 `CYCLE_FINISHED` when the cycle is finished; the API
 * client surfaces both as a thrown ApiError (caught by the store
 * action's error path).
 */
export async function setCycleDatesAction(
  store: Store,
  startDate: string | null,
): Promise<void> {
  if (!store.currentMonth) return;
  const prevUuid = store.currentMonth.uuid;
  const result = await apiPatchCycle(store.currentMonth.uuid, {
    type: "updateCycle",
    startDate,
  });
  // Stale guard — user could have switched cycles mid-flight.
  if (store.currentMonth?.uuid !== prevUuid) return;
  store.currentMonth = result.cycle;
  // Refresh summaries so the sidebar reflects the new startDate.
  try {
    const refresh = await apiListCycles();
    store.months = refresh.summaries;
  } catch {
    /* keep prior list */
  }
}

/**
 * v2.1: PATCH the player `displayName` (or clear it with `null`).
 * Trims + clamps to 24 chars server-side; mirrors the same here so
 * the UI feels snappy. The local `profile` state is replaced by the
 * response so consumers always see the canonical shape.
 */
export async function updateDisplayNameAction(
  store: Store,
  name: string | null,
): Promise<Profile | undefined> {
  const trimmed = typeof name === "string" ? name.trim() : "";
  const payload = trimmed.length === 0 ? null : trimmed.slice(0, 24);
  const profile = await apiUpdateProfile({ displayName: payload });
  store.profile = {
    ...(store.profile ?? { uuid: profile.uuid, lifetimeScore: 0 }),
    ...profile,
  };
  return profile;
}
