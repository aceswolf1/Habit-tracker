/**
 * v2.1: bulk-add helper extracted out of the store to keep
 * `monthStore.ts` ≤ 400 lines.
 *
 * Walks the cycle, builds the `additions[]` payload, runs the dedup
 * check, and emits fresh optimistic task drafts. Pure (no API call):
 * the store still wraps it in `enqueueCycleMutation`.
 */

import type { Cycle } from "../types/index";
import type { Task, TaskTag, TaskTimeOfDay } from "../types/index";
import type { PatchBody } from "../types/index";
import {
  createTaskDraft, generateRecurrenceId, isSameAddPayload,
} from "./taskFactory";
import { findWeekByUuid } from "./cycleMutations";

export interface BulkAddTasksOptions {
  description: string;
  optional?: boolean;
  legendary?: boolean;
  dayUuidsByWeek: Record<string, string[]>;
  persist?: boolean;
  icon?: string;
  gifUrl?: string;
  gifVideoUrl?: string;
  gifStillUrl?: string;
  notes?: string;
  habitId?: string;
  tag?: TaskTag;
  durationMin?: number;
  timeOfDay?: TaskTimeOfDay;
  dueTime?: string;
  recurrenceId?: string;
}

export interface BulkAddTasksResult {
  additions: Extract<PatchBody, { type: "addTasks" }>["additions"];
}

/**
 * Build the `additions[]` payload and eagerly push the optimistic task
 * drafts into `cycle.weeks` so the UI updates immediately. Skips
 * duplicate fingerprints within the same call.
 */
export function bulkAddTasksToCycle(
  cycle: Cycle,
  options: BulkAddTasksOptions,
): BulkAddTasksResult {
  const {
    description,
    optional = false,
    legendary = false,
    dayUuidsByWeek,
    icon,
    gifUrl,
    gifVideoUrl,
    gifStillUrl,
    notes,
    habitId,
    tag,
    durationMin,
    timeOfDay,
    dueTime,
  } = options;

  const recurrenceId = options.recurrenceId || generateRecurrenceId();
  const additions: Extract<PatchBody, { type: "addTasks" }>["additions"] = [];

  Object.entries(dayUuidsByWeek).forEach(([weekUuid, dayUuids]) => {
    const week = findWeekByUuid(cycle, weekUuid);
    if (!week) return;
    Array.from(new Set(dayUuids)).forEach((dayUuid) => {
      const day = week.days.find((d) => d.uuid === dayUuid);
      if (!day) return;
      if (
        day.tasks.some((t) =>
          isSameAddPayload(t, { description, optional, legendary, icon, gifUrl })
        )
      ) {
        return;
      }
      const newTask: Task = createTaskDraft({
        description, optional, legendary,
        icon, gifUrl, gifVideoUrl, gifStillUrl, notes,
        habitId, tag, durationMin, timeOfDay, dueTime,
        recurrenceId,
        order: day.tasks.length,
      });
      day.tasks.push(newTask);
      additions.push({ weekUuid, dayUuid, task: newTask });
    });
  });

  return { additions };
}
