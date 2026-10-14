/**
 * v2.1: helpers for applying task patches on the FE side.
 *
 * `applyTaskMetaUpdate` mirrors the FIX-01 + v2.1 update semantics
 * (`!== undefined` = write; `null` = clear; `undefined` = leave alone)
 * over the union of V2 + v2.1 task fields. Lives outside the store so
 * the store stays under the 400-line cap.
 */

import type { Task } from "../types/index";

/**
 * `payload` follows the same FIX-01 semantics as `updateTasks` on the
 * backend:
 *
 *   - `payload.field !== undefined` → copy the value onto `task` (clear
 *     when `null`, replace when a string).
 *   - `payload.field === undefined` → leave the existing value untouched.
 *
 * Returns `true` when ANY field was written (useful for the optimistic
 * guard).
 */
export function applyTaskMetaUpdate(
  task: Task,
  payload: {
    description?: string;
    optional?: boolean;
    legendary?: boolean;
    icon?: string | null;
    gifUrl?: string | null;
    gifVideoUrl?: string | null;
    gifStillUrl?: string | null;
    notes?: string | null;
    habitId?: string;
    tag?: string | null;
    durationMin?: number | null;
    timeOfDay?: string | null;
    dueTime?: string | null;
  }
): boolean {
  let changed = false;
  if (payload.description !== undefined) { task.description = payload.description; changed = true; }
  if (payload.optional !== undefined)    { task.optional = payload.optional;       changed = true; }
  if (payload.legendary !== undefined)   { task.legendary = payload.legendary;     changed = true; }
  if (payload.icon !== undefined)        { task.icon = payload.icon as Task["icon"]; changed = true; }
  if (payload.gifUrl !== undefined)      { task.gifUrl = payload.gifUrl as Task["gifUrl"]; changed = true; }
  if (payload.gifVideoUrl !== undefined) { task.gifVideoUrl = payload.gifVideoUrl as Task["gifVideoUrl"]; changed = true; }
  if (payload.gifStillUrl !== undefined) { task.gifStillUrl = payload.gifStillUrl as Task["gifStillUrl"]; changed = true; }
  if (payload.notes !== undefined)       { task.notes = payload.notes as Task["notes"]; changed = true; }
  if (payload.habitId !== undefined)     { task.habitId = payload.habitId;         changed = true; }
  if (payload.tag !== undefined)         { task.tag = (payload.tag ?? undefined) as Task["tag"]; changed = true; }
  if (payload.durationMin !== undefined) { task.durationMin = (payload.durationMin ?? undefined) as Task["durationMin"]; changed = true; }
  if (payload.timeOfDay !== undefined)   { task.timeOfDay = (payload.timeOfDay ?? undefined) as Task["timeOfDay"]; changed = true; }
  if (payload.dueTime !== undefined)     { task.dueTime = (payload.dueTime ?? undefined) as Task["dueTime"]; changed = true; }
  return changed;
}
