/**
 * Pure cycle walkers + in-place mutators (UB-51, W4 split).
 *
 * All functions here mutate the cycle object that is passed in. There are
 * no API calls, no store accesses, no DOM events — just data shapes from
 * `frontend/types/index.ts`. Keep it that way so the store stays a thin
 * orchestrator and the helpers stay trivially testable.
 *
 * Naming convention: `find*` returns the first match or null; `*ByUuid`
 * takes a cycle root and walks weeks → days → tasks; `removeTask*` and
 * `insert*At` mutate `day.tasks` and return what the caller needs to
 * keep going (the removed/inserted task or the resolved index).
 */

import type { Cycle, Day, Task, Week } from "../types/index";

// ---------- finders (pure, no mutation) ----------

export function findWeekByUuid(cycle: Cycle, uuid: string): Week | null {
  return cycle.weeks.find((w) => w.uuid === uuid) ?? null;
}

export function findDayByUuid(cycle: Cycle, uuid: string): Day | null {
  for (const w of cycle.weeks) {
    const d = w.days.find((day) => day.uuid === uuid);
    if (d) return d;
  }
  return null;
}

export interface TaskLocation {
  task: Task;
  day: Day;
  week: Week;
}

/** Locate a task anywhere in the cycle tree. */
export function findTaskLocation(
  cycle: Cycle | null | undefined,
  uuid: string,
): TaskLocation | null {
  if (!cycle) return null;
  for (const week of cycle.weeks) {
    for (const day of week.days) {
      const t = day.tasks.find((task) => task.uuid === uuid);
      if (t) return { task: t, day, week };
    }
  }
  return null;
}

/** Return the task or null. Convenience wrapper around `findTaskLocation`. */
export function findTaskByUuid(
  cycle: Cycle | null | undefined,
  uuid: string,
): Task | null {
  return findTaskLocation(cycle, uuid)?.task ?? null;
}

export function findTaskIndex(day: Day, uuid: string): number {
  return day.tasks.findIndex((t) => t.uuid === uuid);
}

// ---------- day mutators (pure, mutate their day) ----------

/**
 * Remove a task by uuid from a day. Returns the removed task or null.
 * Idempotent: calling twice is a no-op on the second call.
 */
export function removeTaskFromDay(day: Day, uuid: string): Task | null {
  const idx = findTaskIndex(day, uuid);
  if (idx === -1) return null;
  const [task] = day.tasks.splice(idx, 1);
  return task ?? null;
}

/** Find every day in the cycle that has a task with the given recurrenceId. */
export function findDaysWithRecurrence(
  cycle: Cycle,
  recurrenceId: string,
): Day[] {
  const out: Day[] = [];
  for (const week of cycle.weeks) {
    for (const day of week.days) {
      if (day.tasks.some((t) => t.recurrenceId === recurrenceId)) out.push(day);
    }
  }
  return out;
}

/**
 * Remove every task in `day` whose `recurrenceId` matches `recurrenceId`.
 * Returns the number of tasks removed.
 */
export function removeRecurrenceFromDay(
  day: Day,
  recurrenceId: string,
): number {
  const before = day.tasks.length;
  day.tasks = day.tasks.filter((t) => t.recurrenceId !== recurrenceId);
  return before - day.tasks.length;
}

/**
 * Insert a task into `day.tasks` at `index` (clamped to [0..length]).
 * Returns the index that was actually used. Mutates `day.tasks`.
 */
export function insertTaskAt(
  day: Day,
  task: Task,
  index: number | undefined,
): number {
  const len = day.tasks.length;
  let at = typeof index === "number" ? index : len;
  if (at < 0) at = 0;
  if (at > len) at = len;
  day.tasks.splice(at, 0, task);
  return at;
}

/**
 * Reassign each task's `order` field to its current index in `day.tasks`.
 * The store calls this after move / bulk-add so the optimistic UI stays in
 * sync with the server-truth shape.
 */
export function reassignDayOrder(day: Day): void {
  day.tasks.forEach((t, i) => {
    t.order = i;
  });
}

/**
 * Move a task across days within a cycle.
 *
 * - On success returns `{ insertedAt }` and the affected days
 *   (source + target). Source and target `order` fields are reset.
 * - If the task is not found in the cycle, returns null.
 * - If `targetDayUuid` doesn't exist, the task is put back on its source
 *   day at the end (nothing changed) and null is returned.
 */
export interface MoveResult {
  insertedAt: number;
  sourceDay: Day;
  targetDay: Day;
}

export function moveTaskInCycle(
  cycle: Cycle,
  taskUuid: string,
  targetDayUuid: string,
  targetIndex?: number,
): MoveResult | null {
  const loc = findTaskLocation(cycle, taskUuid);
  if (!loc) return null;
  const moving = removeTaskFromDay(loc.day, taskUuid);
  if (!moving) return null;

  const targetDay = findDayByUuid(cycle, targetDayUuid);
  if (!targetDay) {
    // restore
    loc.day.tasks.push(moving);
    return null;
  }

  const insertedAt = insertTaskAt(targetDay, moving, targetIndex);
  reassignDayOrder(loc.day);
  if (loc.day !== targetDay) reassignDayOrder(targetDay);
  return { insertedAt, sourceDay: loc.day, targetDay };
}
