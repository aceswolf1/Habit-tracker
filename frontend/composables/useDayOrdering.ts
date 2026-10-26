/**
 * Day Spotlight ordering + label grouping (pure helpers, no Vue state).
 *
 * - `manual` keeps the day's saved order (the `tasks` array order, which
 *   `moveTasks` rewrites when you drag or use Move up/down).
 * - Every other sort is a stable view-only ordering; nothing is saved.
 * - Grouping puts each task under its FIRST label; unlabeled tasks go last.
 */
import type { Task } from "../types/index";

export const DAY_SORTS = ["manual", "timeOfDay", "dueTime", "pending", "label", "name"] as const;
export type DaySort = (typeof DAY_SORTS)[number];

export const DAY_SORT_LABELS: Record<DaySort, string> = {
  manual: "My order",
  timeOfDay: "Time of day",
  dueTime: "Due time",
  pending: "Pending first",
  label: "Label",
  name: "Name",
};

export const UNLABELED = "UNLABELED";

const TIME_RANK: Record<string, number> = { morning: 0, afternoon: 1, evening: 2, night: 3 };
const LAST = Number.MAX_SAFE_INTEGER;

function firstLabel(task: Task): string | null {
  return task.labels && task.labels.length ? task.labels[0] : null;
}

function rank(task: Task, sort: DaySort): number | string {
  switch (sort) {
    case "timeOfDay": return task.timeOfDay ? TIME_RANK[task.timeOfDay] ?? LAST : LAST;
    case "dueTime":   return task.dueTime ? Number(task.dueTime.replace(":", "")) : LAST;
    case "pending":   return task.completed ? 1 : 0;
    case "label":     return firstLabel(task) ?? "￿"; // unlabeled last
    case "name":      return (task.description || "").toLowerCase();
    default:          return 0;
  }
}

/** Sorted copy of `tasks`. Stable: ties keep the saved (manual) order. */
export function sortDayTasks(tasks: Task[], sort: DaySort): Task[] {
  const indexed = tasks.map((task, i) => ({ task, i }));
  if (sort === "manual") return tasks.slice();
  indexed.sort((a, b) => {
    const ra = rank(a.task, sort);
    const rb = rank(b.task, sort);
    if (ra < rb) return -1;
    if (ra > rb) return 1;
    return a.i - b.i;
  });
  return indexed.map((x) => x.task);
}

export interface LabelGroup {
  label: string;
  tasks: Task[];
}

/** Group (already sorted) tasks by first label, alphabetically; UNLABELED last. */
export function groupByFirstLabel(tasks: Task[]): LabelGroup[] {
  const map = new Map<string, Task[]>();
  for (const task of tasks) {
    const key = firstLabel(task) ?? UNLABELED;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(task);
  }
  return [...map.entries()]
    .sort(([a], [b]) => (a === UNLABELED ? 1 : b === UNLABELED ? -1 : a.localeCompare(b)))
    .map(([label, list]) => ({ label, tasks: list }));
}

/** Index to move a task to for Move up (-1) / Move down (+1), or null at the edge. */
export function neighbourIndex(tasks: Task[], uuid: string, delta: -1 | 1): number | null {
  const i = tasks.findIndex((t) => t.uuid === uuid);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= tasks.length) return null;
  return j;
}
