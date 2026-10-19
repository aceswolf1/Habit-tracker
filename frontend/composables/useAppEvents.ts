/**
 * Typed application event bus (UB-54, W4 contract).
 *
 * Replaces the previous `window.dispatchEvent(new CustomEvent(...))` bus
 * (`appToast` / `pointsEarned` / `taskCompleted`) with a module-level
 * handler map so listeners don't leak across SSR boundaries and so dispatch
 * / consume sites stay in lockstep at compile time.
 *
 * Contract (see `development/remediation-w4/orchestration-ctx/decisions/w4-contract.md`):
 *   - Module-level handler map; never touches `window`.
 *   - SSR-safe: callers wire `onAppEvent` inside `onMounted` and store the
 *     returned unsubscribe fn to invoke in `onBeforeUnmount`.
 *   - After W4a no `new CustomEvent(...)` or
 *     `window.addEventListener('appToast'|'pointsEarned'|'taskCompleted')`
 *     remains in `frontend/`.
 */

export type ToastType = 'success' | 'error' | 'info' | 'warning';

/**
 * Payload shapes mirror the detail payloads of the previous CustomEvents:
 *   - toast    ← CustomEvent('appToast', { detail })
 *   - pointsEarned ← monthStore.applyPointsEarned dispatch
 *   - taskCompleted ← monthStore.toggleTaskCompletion dispatch
 */
export type AppEvents = {
  toast: {
    type: ToastType;
    title: string;
    message: string;
  };
  pointsEarned: {
    points: number;
    taskUuid?: string;
    tier?: string | null;
    isLegendary: boolean;
  };
  taskCompleted: {
    taskUuid: string;
    taskType: 'optional' | 'required';
    tier: string | null;
    isLegendary: boolean;
  };
  /** v2.1: lifetime XP crossed a level boundary; UI shows the burst/toast
   *  and may play a sound cue. Fires at most once per crossing. */
  levelUp: {
    level: number;
    title: string;
  };
  /** v2.2: a false→true PATCH completed a habit that just hit a strike
   * (combo ≥ 2). FloatingPoints listens and flashes 'TRIPLE STRIKE +5'. */
  strike: {
    taskUuid: string;
    combo: number;
    /** Display name (e.g. 'DOUBLE STRIKE'). `null` when combo < 2 (should
     * never fire, but defensive). */
    name: string | null;
    bonus: number;
  };
  /** v2.2: a month was just finished via `finishCurrentMonth`. The
   * certificate modal (W2) subscribes to this from `ModalsHost` and
   * opens itself. */
  monthFinished: {
    cycleUuid: string;
  };
  /** v2.3: a PATCH/finish just earned at least one chest. The header
   *  badge (W2) listens and bumps the unclaimed-count animation. */
  chestEarned: {
    count: number;
  };
  /** v2.3: a PATCH/finish just unlocked an achievement. The toasts
   *  (W2) and the Trophy Vault (W3) listen; name is empty in the
   *  initial dispatch because the rewards store refetch fills it in. */
  achievementUnlocked: {
    id: string;
    /** Catalog display name (`FIRST BLOOD`, …); empty string in the
     *  initial dispatch because the rewards store hasn't refreshed yet. */
    name: string;
    credits: number;
  };
  /** v2.3: open the certificate modal for a specific cycleUuid.
   *  Used by the Trophy Vault "Certificates" gallery (W3) to reuse
   *  the same `MonthCertificate` already mounted in `ModalsHost`. */
  openCertificate: {
    cycleUuid: string;
  };
  /** v2.3: open W2's `ChestModal` (OPEN CHESTS button on the Vault). */
  openChests: Record<string, never>;
};

export type AppEventName = keyof AppEvents;

/** Handler signature for a single event. */
export type AppEventHandler<K extends AppEventName> = (
  payload: AppEvents[K]
) => void;

/** Module-level handler map. One entry-list per event name. */
const handlers: { [K in AppEventName]: Set<AppEventHandler<K>> } = {
  toast: new Set(),
  pointsEarned: new Set(),
  taskCompleted: new Set(),
  levelUp: new Set(),
  strike: new Set(),
  monthFinished: new Set(),
  chestEarned: new Set(),
  achievementUnlocked: new Set(),
  openCertificate: new Set(),
  openChests: new Set(),
};

/**
 * Emit an application event. Synchronous; all handlers are invoked in the
 * order they were registered. Returns nothing — `void` per contract.
 */
export function emitAppEvent<K extends AppEventName>(
  name: K,
  payload: AppEvents[K]
): void {
  // Snapshot the handler set so unsubscribe during dispatch doesn't break iteration.
  const snapshot = Array.from(handlers[name] as Set<AppEventHandler<K>>);
  for (const handler of snapshot) {
    try {
      handler(payload);
    } catch (err) {
      // Don't let one broken listener kill the rest of the bus.
      // eslint-disable-next-line no-console
      console.error(`[useAppEvents] handler for "${String(name)}" threw`, err);
    }
  }
}

/**
 * Subscribe to an application event. Returns an unsubscribe fn — wire it
 * into `onBeforeUnmount` (or call manually) to avoid leaks. SSR-safe: the
 * handler map is module-level but handlers only run on the client when
 * dispatchers fire.
 */
export function onAppEvent<K extends AppEventName>(
  name: K,
  handler: AppEventHandler<K>
): () => void {
  const set = handlers[name] as Set<AppEventHandler<K>>;
  set.add(handler);
  return () => {
    set.delete(handler);
  };
}

/**
 * Test/debug helper. Not used in production code; kept here so future
 * test runners can reset state between cases without importing internals.
 */
export function _resetAppEventHandlers(): void {
  handlers.toast.clear();
  handlers.pointsEarned.clear();
  handlers.taskCompleted.clear();
  handlers.levelUp.clear();
  handlers.strike.clear();
  handlers.monthFinished.clear();
  handlers.chestEarned.clear();
  handlers.achievementUnlocked.clear();
  handlers.openCertificate.clear();
  handlers.openChests.clear();
}