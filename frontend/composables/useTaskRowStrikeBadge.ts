/**
 * useTaskRowStrikeBadge.ts (v2.2 W2).
 *
 * Pure shared computation for the "STRIKE READY ×N" pill and the
 * completed-task "DOUBLE / TRIPLE STRIKE" badge. Extracted from
 * TaskRow.vue + TaskTile.vue so both surfaces stay ≤ 400 lines and
 * the rule lives in exactly one place.
 *
 * Rules (contract v2.2 §5):
 *   - Completed task with `combo >= 2` → `comboName(combo)` (or null).
 *   - Pending task whose habit was last completed within
 *     `COMBO_GAP_DAYS = 2` calendar days → `STRIKE READY ×N` where
 *     `N = currentCombo + 1`, gated to ≥ 2 (the contract's gate).
 *   - Tooltip = `Last completed YYYY-MM-DD. Complete now to continue
 *     the chain.` (used as the badge's `title`).
 */

import { computed, type ComputedRef, type Ref } from "vue";
import type { InsightsHabit, Task } from "../types/index";
import { habitKey } from "../utils/sharedHabits";
import { comboName, daysBetween } from "../utils/sharedCombos";
import { todayIso } from "../utils/sharedDates";

export interface TaskRowStrikeBadge {
  /** "DOUBLE STRIKE" / "TRIPLE STRIKE" / etc. — present only for
   * completed tasks with combo >= 2. */
  comboLabel: ComputedRef<string | null>;
  /** "STRIKE READY ×N" — present only for pending tasks where the habit
   * was last completed within the combo gap AND currentCombo + 1 >= 2. */
  strikeReadyLabel: ComputedRef<string | null>;
  /** Tooltip for the STRIKE READY pill. */
  strikeReadyTitle: ComputedRef<string>;
}

export function useTaskRowStrikeBadge(
  task: ComputedRef<Task> | Ref<Task>,
  insightHabits: ComputedRef<InsightsHabit[] | null | undefined> | Ref<InsightsHabit[] | null | undefined>,
): TaskRowStrikeBadge {
  const comboLabel = computed<string | null>(() => {
    const t = task.value;
    if (!t || !t.completed) return null;
    const c = Number(t.combo || 0);
    if (c < 2) return null;
    return comboName(c);
  });

  const resolveHabit = () => {
    const habits = insightHabits.value;
    if (!Array.isArray(habits) || habits.length === 0) return null;
    const t = task.value;
    if (!t) return null;
    const key = habitKey(t);
    return habits.find((h) => h && h.habitKey === key) || null;
  };

  const strikeReadyLabel = computed<string | null>(() => {
    const t = task.value;
    if (!t || t.completed) return null;
    const habit = resolveHabit();
    if (!habit || !habit.lastCompletedOn) return null;
    const today = todayIso();
    if (!today) return null;
    const diff = daysBetween(habit.lastCompletedOn, today);
    if (typeof diff !== "number" || Number.isNaN(diff)) return null;
    if (diff < 0 || diff > 2) return null;
    const next = (habit.currentCombo || 0) + 1;
    if (next < 2) return null;
    return `STRIKE READY ×${next}`;
  });

  const strikeReadyTitle = computed<string>(() => {
    const habit = resolveHabit();
    if (!habit || !habit.lastCompletedOn) return "";
    return `Last completed ${habit.lastCompletedOn}. Complete now to continue the chain.`;
  });

  return { comboLabel, strikeReadyLabel, strikeReadyTitle };
}
