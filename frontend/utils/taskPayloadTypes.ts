/**
 * v2.1: shared payload interfaces for `monthStore.bulkAddTasks` and
 * `monthStore.updateTask`. Extracted out of the store so the store stays
 * under the 400-line cap (the option dictionaries were the single biggest
 * contributor).
 */

import type { TaskTag, TaskTimeOfDay } from "../types/index";

export interface BulkAddTasksPayload {
  description: string;
  optional?: boolean;
  legendary?: boolean;
  dayUuidsByWeek: Record<string, string[]>;
  repeatWeeks?: string[];
  baseWeekUuid: string;
  recurrenceId?: string;
  persist?: boolean;
  icon?: string;
  gifUrl?: string;
  gifVideoUrl?: string;
  gifStillUrl?: string;
  notes?: string;
  /** v2.1 (D3): shared cluster id. */
  habitId?: string;
  /** v2.1 (D4): one of TASK_TAGS. */
  tag?: TaskTag;
  /** v2.1: integer minutes 1..1440. */
  durationMin?: number;
  /** v2.1: one of TASK_TIMES_OF_DAY. */
  timeOfDay?: TaskTimeOfDay;
  /** v2.1: HH:MM 24-hour string. */
  dueTime?: string;
  /** Custom labels. */
  labels?: string[];
}

export interface UpdateTaskPayload {
  description?: string;
  optional?: boolean;
  legendary?: boolean;
  icon?: string | null;
  gifUrl?: string | null;
  gifVideoUrl?: string | null;
  gifStillUrl?: string | null;
  notes?: string | null;
  /** v2.1: string only — never cleared (D3). */
  habitId?: string;
  /** v2.1: pass null to clear. */
  tag?: TaskTag | null;
  durationMin?: number | null;
  timeOfDay?: TaskTimeOfDay | null;
  dueTime?: string | null;
  /** Replaces the label list; null clears. */
  labels?: string[] | null;
}
