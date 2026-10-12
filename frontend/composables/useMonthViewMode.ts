/**
 * Finished-month view mode toggle: `'stats'` shows MonthStatistics,
 * `'details'` shows ReadOnlyMonthView. Defaults to `'stats'` so first
 * arrival on a locked month shows the statistics summary.
 */
import { ref } from "vue";

export type ViewMode = "stats" | "details";

export function useMonthViewMode() {
  const viewMode = ref<ViewMode>("stats");

  function toggleView() {
    viewMode.value = viewMode.value === "stats" ? "details" : "stats";
  }

  return { viewMode, toggleView };
}