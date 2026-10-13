/**
 * Page-level state for the editable month view: current week / day selection,
 * store sync, refresh helper, and the action wrappers that edit tasks
 * (toggle / move / delete). Extracted from `app.vue` so the shell stays a
 * pure composer of components.
 *
 * W4b additions for the responsive shell (B-S2):
 *   - `currentDayUuid` + `currentDay` — phone-only single-day focus.
 *   - `setCurrentDay` — update the focused day within the current week.
 *   - `nextWeek` / `prevWeek` — page navigation between weeks (used by the
 *     phone prev/next buttons; no-op when there is only one week).
 *   - `todayWeekdayName` — so `DayPicker` can pick the default day on
 *     first mount (matches today's weekday if it lives in the current
 *     week, otherwise the first day).
 *
 * Wave B / page-state-sharing (2026-10-13):
 *   `useMonthPageState()` previously created a fresh ref graph each call,
 *   so a child that destructured `useMonthPageState()` itself got a
 *   second, independent copy of `currentWeek` / `currentDayUuid` /
 *   `currentMonth`, and the action callbacks that needed `useTaskModal()`
 *   were silently `undefined` (M-1).
 *   Fix: `app.vue` is the SINGLE owner. It calls `providePageState(...)`
 *   with the merged state (page-state refs + task-modal openers).
 *   Descendants — most importantly `CampaignView.vue` — call
 *   `injectPageState()` to read the same singleton. The original
 *   `useMonthPageState()` factory is preserved (still used by app.vue)
 *   so the watch + computed graph lives there exactly as before.
 */
import { inject, provide, ref, computed, watch, type Ref, type InjectionKey } from "vue";
import { storeToRefs } from "pinia";
import { useMonthStore } from "../stores/monthStore";

const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/**
 * Shape of the shared page state. Mirrors `useMonthPageState()`'s return
 * value plus the modal openers so descendants have a single dependency.
 * Modal-only entries are optional to keep backwards compatibility with
 * any caller that only wants the page-state half (there are none today,
 * but the type stays explicit).
 */
export interface SharedPageState {
  // Page selection
  currentWeek: Ref<any>;
  currentDay: any;
  currentDayUuid: Ref<string | null>;
  weeks: any;
  currentMonth: any;
  weekIndex: any;
  hasPrevWeek: any;
  hasNextWeek: any;
  // Page mutations
  setCurrentWeek: (weekOrUuid: any) => void;
  setCurrentDay: (dayUuid: string) => void;
  nextWeek: () => void;
  prevWeek: () => void;
  refreshDataFromStore: () => void;
  // Task mutations
  toggleTask: (taskUuid: string) => void;
  moveTask: (payload: { taskUuid: string; toDayUuid: string }) => void;
  deleteSingleTask: (taskUuid: string) => void;
  // Modal openers (optional — only present when the owner provided them)
  openCreateTask?: () => void;
  openCreateTaskForDay?: (dayUuid: string) => void;
  openEditTask?: (taskUuid: string) => void;
  closeTaskModal?: () => void;
  taskModalOpen?: Ref<boolean>;
  selectedDayUuid?: Ref<string | null>;
  editingTaskUuid?: Ref<string | null>;
}

export const PAGE_STATE_KEY: InjectionKey<SharedPageState> = Symbol("pp-page-state");

/**
 * Provide the page state. Call exactly ONCE from `app.vue` (or any other
 * top-level owner). Components that need this state call `injectPageState()`
 * rather than calling `useMonthPageState()` themselves.
 */
export function providePageState(state: SharedPageState): void {
  provide(PAGE_STATE_KEY, state);
}

/**
 * Inject the shared page state. Throws a clear error when the
 * provider is missing so a missing `provide` call surfaces immediately
 * (instead of silently rendering undefined callbacks like M-1).
 */
export function injectPageState(): SharedPageState {
  const state = inject(PAGE_STATE_KEY, null as unknown as SharedPageState);
  if (!state) {
    throw new Error(
      "[page-state] injectPageState() called outside a providePageState() owner. " +
        "Add providePageState(...) in app.vue (or the top-level owner).",
    );
  }
  return state;
}

export function useMonthPageState() {
  const monthStore = useMonthStore();
  const storeRefs: any = storeToRefs(monthStore as any);
  const currentMonth = storeRefs.currentMonth;
  const weeks = computed(() => currentMonth.value?.weeks || []);

  const currentWeek = ref<any>(null);
  const currentDayUuid = ref<string | null>(null);

  const currentDay = computed(() => {
    if (!currentWeek.value?.days) return null;
    if (currentDayUuid.value) {
      return (
        currentWeek.value.days.find(
          (d: any) => d.uuid === currentDayUuid.value
        ) || null
      );
    }
    return currentWeek.value.days[0] || null;
  });

  // The name of today's weekday in the locale's English form (matches the
  // day-name strings the backend stores in `week.days[].name`). Computed
  // once per mount; we only need it to seed the initial day picker.
  const todayWeekdayName = computed(() => {
    if (typeof window === "undefined") return null;
    try {
      return new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(
        new Date()
      );
    } catch {
      return WEEKDAY_NAMES[new Date().getDay()];
    }
  });

  function setCurrentWeek(weekOrUuid: any) {
    const uuid = typeof weekOrUuid === "string" ? weekOrUuid : weekOrUuid.uuid;
    const storeWeek = monthStore.getWeekByUuid(uuid);
    if (storeWeek) {
      currentWeek.value = storeWeek;
      // Default the focused day to today's weekday when it lives in this
      // week; otherwise the first day of the week.
      const todayName = todayWeekdayName.value;
      const match = storeWeek.days?.find((d: any) => d.name === todayName);
      currentDayUuid.value = match
        ? match.uuid
        : storeWeek.days?.[0]?.uuid ?? null;
    }
  }

  function setCurrentDay(dayUuid: string) {
    if (!currentWeek.value?.days) return;
    if (currentWeek.value.days.some((d: any) => d.uuid === dayUuid)) {
      currentDayUuid.value = dayUuid;
    }
  }

  function nextWeek() {
    if (!currentWeek.value) return;
    const idx = weeks.value.findIndex(
      (w: any) => w.uuid === currentWeek.value.uuid
    );
    if (idx >= 0 && idx + 1 < weeks.value.length) {
      setCurrentWeek(weeks.value[idx + 1]);
    }
  }

  function prevWeek() {
    if (!currentWeek.value) return;
    const idx = weeks.value.findIndex(
      (w: any) => w.uuid === currentWeek.value.uuid
    );
    if (idx > 0) {
      setCurrentWeek(weeks.value[idx - 1]);
    }
  }

  function refreshDataFromStore() {
    if (import.meta.dev) console.log("Refreshing UI data from store...");
    if (currentWeek.value) {
      const updatedWeek = monthStore.getWeekByUuid(currentWeek.value.uuid);
      if (updatedWeek) {
        currentWeek.value = { ...updatedWeek };
        // Re-resolve the focused day against the new week reference.
        if (currentDayUuid.value) {
          const stillThere = updatedWeek.days?.find(
            (d: any) => d.uuid === currentDayUuid.value
          );
          if (!stillThere) {
            currentDayUuid.value = updatedWeek.days?.[0]?.uuid ?? null;
          }
        }
      }
    }
  }

  // Keep `currentWeek` in lockstep with the active month: when the store's
  // currentMonth changes (or its weeks array mutates in place), mirror the
  // matching week into our local ref so the day grid re-renders.
  watch(
    () => currentMonth.value,
    (newMonth) => {
      if (!newMonth) return;
      if (currentWeek.value) {
        const updatedWeek = newMonth.weeks.find(
          (w: any) => w.uuid === currentWeek.value.uuid
        );
        if (updatedWeek) {
          currentWeek.value = { ...updatedWeek };
        }
      } else if (newMonth.weeks?.length) {
        setCurrentWeek(newMonth.weeks[0]);
      }
    },
    { deep: true }
  );

  function toggleTask(taskUuid: string) {
    monthStore.toggleTaskCompletion(taskUuid);
    refreshDataFromStore();
  }

  function moveTask(payload: { taskUuid: string; toDayUuid: string }) {
    if (monthStore.currentMonth?.finished) return;
    monthStore.moveTask(payload.taskUuid, payload.toDayUuid);
    refreshDataFromStore();
  }

  function deleteSingleTask(taskUuid: string) {
    if (monthStore.currentMonth?.finished) return;
    monthStore.deleteTask(taskUuid, "single");
    refreshDataFromStore();
  }

  const weekIndex = computed(() => {
    if (!currentWeek.value) return -1;
    return weeks.value.findIndex((w: any) => w.uuid === currentWeek.value.uuid);
  });
  const hasPrevWeek = computed(() => weekIndex.value > 0);
  const hasNextWeek = computed(
    () => weekIndex.value >= 0 && weekIndex.value < weeks.value.length - 1
  );

  return {
    currentWeek,
    currentDay,
    currentDayUuid,
    weeks,
    currentMonth,
    weekIndex,
    hasPrevWeek,
    hasNextWeek,
    setCurrentWeek,
    setCurrentDay,
    nextWeek,
    prevWeek,
    refreshDataFromStore,
    toggleTask,
    moveTask,
    deleteSingleTask,
  };
}