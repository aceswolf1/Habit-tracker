/**
 * Pure recurrence / bulk-add helpers (UB-51, W4 split).
 *
 * `buildDaySelection` was lifted out of TaskModal.vue verbatim. It expands
 * the modal's UI state (single / multiple / all days + optional repeat
 * across weeks) into the `dayUuidsByWeek` map that `monthStore.bulkAddTasks`
 * expects on the wire.
 */

import type { Week } from "../types/index";

export type WeekScope = "single" | "multiple" | "all";

export interface DayChip {
  uuid: string;
  short: string;
}

export interface BuildDaySelectionInput {
  weekUuid: string;
  weekScope: WeekScope;
  /** Day UUIDs the user clicked on for the base week. */
  selectedDayUuids: string[];
  /** Other week UUIDs the user wants to repeat in. */
  selectedWeekUuids: string[];
  /** The resolved base week (with `.days`), or null when the modal isn't yet bound. */
  baseWeek: Week | null | undefined;
  /** All weeks in the cycle, used to look up the matching index for repeat. */
  weeks: readonly Week[];
}

/**
 * Expand the modal's UI state into the same-day/other-weeks map that
 * `bulkAddTasks` consumes.
 *
 * Algorithm (preserved verbatim from the original TaskModal implementation):
 *   - "all"  → every day in the base week.
 *   - "single" → only the first selected day of the base week.
 *   - "multiple" → all selected days, deduped.
 *   - repeatAcrossWeeks: for each other selected week, replicate the same
 *     base-day INDICES onto that week's same-position days. Days outside the
 *     base week's count are dropped.
 */
export function buildDaySelection(input: BuildDaySelectionInput): Record<string, string[]> {
  const { weekUuid, weekScope, selectedDayUuids, selectedWeekUuids, baseWeek, weeks } = input;
  if (!weekUuid) return {};
  let baseDays: string[];
  if (weekScope === "all") {
    baseDays = baseWeek ? baseWeek.days.map((d) => d.uuid) : [];
  } else if (weekScope === "single") {
    baseDays = selectedDayUuids.slice(0, 1);
  } else {
    baseDays = [...selectedDayUuids];
  }
  const uniqueBaseDays = Array.from(new Set(baseDays)).filter(Boolean);
  const map: Record<string, string[]> = { [weekUuid]: uniqueBaseDays };
  selectedWeekUuids.forEach((w) => {
    const week = weeks.find((ww) => ww.uuid === w);
    if (!week) return;
    const dayList = week.days;
    const indices = baseDays.map(
      (did) => baseWeek?.days.findIndex((d) => d.uuid === did) ?? -1,
    );
    const targetDayUuids = indices
      .filter((i) => i >= 0)
      .map((i) => dayList[i].uuid);
    map[w] = Array.from(new Set(targetDayUuids)).filter(Boolean);
  });
  return map;
}
