/**
 * V2 A9 — Pure helpers for "clone one day's tasks into N target days".
 *
 * Lives in `utils/` (not the Pinia store) so the store can stay under
 * the 400-line cap and so the helpers are easy to unit-test in isolation.
 *
 * The dedup rule is what the contract calls out: a candidate source task
 * is considered a duplicate of an existing target task when their
 * `description`, `optional`, `legendary`, `icon`, and `gifUrl` all match.
 * `gifVideoUrl` / `gifStillUrl` / `notes` are intentionally ignored for
 * the dedup test (the FE will overwrite them with the source's values
 * during a clone, so they're not a differentiator).
 *
 * Cloned tasks get:
 *   - a fresh `uuid` (server may reassign; that's the existing convention),
 *   - `completed: false` (matches recurrence behavior),
 *   - no `recurrenceId` (clone != recurrence; this is a one-shot copy),
 *   - the source's `description`, `optional`, `legendary`, `icon`,
 *     `gifUrl`, `gifVideoUrl`, `gifStillUrl`, and `notes`.
 */

import type { Day, Task, Week } from "../types/index";

/** A "key" string the dedup test compares against. */
export function taskFingerprint(task: Pick<Task, "description" | "optional" | "legendary" | "icon" | "gifUrl">): string {
  return [
    task.description,
    task.optional ? "1" : "0",
    task.legendary ? "1" : "0",
    task.icon || "",
    task.gifUrl || "",
  ].join("\u0001");
}

/** Build a fresh task object cloned from a source. UUID is fresh; completed is reset. */
export function cloneTaskFromSource(source: Task): Task {
  return {
    uuid: `t-${Math.random().toString(36).slice(2)}`,
    description: source.description,
    optional: source.optional,
    legendary: source.legendary || false,
    completed: false,
    order: 0, // will be re-assigned by the day.append loop
    icon: source.icon,
    gifUrl: source.gifUrl,
    gifVideoUrl: source.gifVideoUrl,
    gifStillUrl: source.gifStillUrl,
    notes: source.notes,
    // v2.1: carry habitId + task meta across the clone (D3 keeps the
    // habit, the row/display surfaces stay identical).
    habitId: source.habitId,
    tag: source.tag,
    durationMin: source.durationMin,
    timeOfDay: source.timeOfDay,
    dueTime: source.dueTime,
    // recurrenceId intentionally NOT copied — clone != recurrence.
  };
}

/** Look up a Day in the cycle tree by uuid. Returns null when not found. */
export function findDayInWeeks(weeks: readonly Week[], dayUuid: string): Day | null {
  for (const w of weeks) {
    const d = w.days.find((x) => x.uuid === dayUuid);
    if (d) return d;
  }
  return null;
}

export interface BuildCloneAdditionsInput {
  /** All weeks in the current cycle. */
  weeks: readonly Week[];
  /** The day whose tasks are being copied. */
  sourceDayUuid: string;
  /** Day UUIDs the user toggled on in the clone panel. */
  targetDayUuids: readonly string[];
}

export interface BuildCloneAdditionsResult {
  /** One PATCH addTasks entry per non-duplicate target insertion. */
  additions: Array<{ weekUuid: string; dayUuid: string; task: Task }>;
  /** The number of source tasks × target days that were *skipped* because a dup already existed. */
  skippedDuplicates: number;
}

/**
 * Decide what the store should send to the backend for a clone run.
 * Pure: does not mutate the cycle tree. The store still appends the
 * resulting tasks optimistically + sends a single PATCH `addTasks`.
 *
 * Dedup rules:
 *   - skip when the target already has a task whose fingerprint matches the source
 *   - skip when the target IS the source day (the user can't clone onto itself,
 *     but defensively no-op anyway)
 *   - dedup is symmetric: if the same target day appears twice in
 *     `targetDayUuids`, the second pass sees the first pass's additions
 *     and skips them too.
 */
export function buildCloneAdditions(input: BuildCloneAdditionsInput): BuildCloneAdditionsResult {
  const additions: Array<{ weekUuid: string; dayUuid: string; task: Task }> = [];
  let skippedDuplicates = 0;
  const sourceDay = findDayInWeeks(input.weeks, input.sourceDayUuid);
  if (!sourceDay || sourceDay.tasks.length === 0) {
    return { additions, skippedDuplicates };
  }
  // Track fingerprints already added per target so that passing the
  // same target uuid twice (or running twice in a row) doesn't double-insert.
  const perTarget = new Map<string, Set<string>>();
  // Dedup the target list itself so we don't iterate the same day twice.
  const seenTarget = new Set<string>();
  for (const targetUuid of input.targetDayUuids) {
    if (targetUuid === input.sourceDayUuid) continue;
    if (seenTarget.has(targetUuid)) continue;
    seenTarget.add(targetUuid);
    const target = findDayInWeeks(input.weeks, targetUuid);
    if (!target) continue;
    const existingFingerprints = new Set(target.tasks.map(taskFingerprint));
    const inFlight = perTarget.get(targetUuid) ?? new Set<string>();
    perTarget.set(targetUuid, inFlight);
    for (const sourceTask of sourceDay.tasks) {
      const fp = taskFingerprint(sourceTask);
      if (existingFingerprints.has(fp) || inFlight.has(fp)) {
        skippedDuplicates += 1;
        continue;
      }
      const cloned = cloneTaskFromSource(sourceTask);
      cloned.order = target.tasks.length + additions.filter((a) => a.dayUuid === targetUuid).length;
      additions.push({
        weekUuid: "", // re-derived from the day lookup below
        dayUuid: targetUuid,
        task: cloned,
      });
      inFlight.add(fp);
    }
  }
  for (const a of additions) {
    for (const w of input.weeks) {
      if (w.days.some((d) => d.uuid === a.dayUuid)) {
        a.weekUuid = w.uuid;
        break;
      }
    }
  }
  return { additions, skippedDuplicates };
}

/**
 * Total number of tasks the clone would add — used for the toast title
 * BEFORE the call so the UI can pre-render "CLONED 8 TASKS" even if the
 * PATCH is still in flight. Counts every deduped insertion (no skips).
 */
export function expectedCloneCount(input: {
  weeks: readonly Week[];
  sourceDayUuid: string;
  targetDayUuids: readonly string[];
}): number {
  const sourceDay = findDayInWeeks(input.weeks, input.sourceDayUuid);
  if (!sourceDay) return 0;
  return sourceDay.tasks.length * input.targetDayUuids.filter((u) => u !== input.sourceDayUuid).length;
}

/**
 * Optimistically append `additions` into the matching target days of the
 * cycle tree. Pure side-effect: mutates the passed `weeks` (the same
 * shape `currentMonth.weeks` exposes). The store calls this so the UI
 * updates before the PATCH round-trips.
 */
export function appendClonedTasksToCycle(
  weeks: Week[],
  additions: ReadonlyArray<{ weekUuid: string; dayUuid: string; task: Task }>,
): void {
  for (const a of additions) {
    const week = weeks.find((w) => w.uuid === a.weekUuid);
    const day = week?.days.find((d) => d.uuid === a.dayUuid);
    if (day) day.tasks.push(a.task);
  }
}
