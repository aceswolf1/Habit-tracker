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
}