/**
 * Campaign statistics — pure helpers used by `components/campaign/*`
 * and the cockpit (W3). All functions are referentially transparent;
 * XP is approximate (uses the current month progress tier, which is
 * what the user sees on screen).
 *
 * Contract §4 (ui-contract-v2.md) — these signatures are authoritative
 * and used by W3. Do not rename or reshape them without a contract
 * update + COMM-REQUEST to team-lead.
 */
import { calculateDayProgress } from "../utils/sharedProgress";
import { calculateTaskPoints } from "../utils/sharedScoring";
import type { Day, Task, Week } from "../types/index";

export interface DayStats {
  total: number;
  done: number;
  requiredTotal: number;
  requiredDone: number;
  percent: number;
  xpEarned: number;
  xpPending: number;
}

/** XP a single task would award at the current month tier. */
export function getTaskXp(task: Task, monthProgress: number): number {
  return calculateTaskPoints(
    !!task.optional,
    monthProgress,
    !!task.legendary,
  );
}

/** Day summary: counts, percent (required-only, 0–100), earned + pending XP. */
export function getDayStats(day: Day, monthProgress: number): DayStats {
  const tasks = Array.isArray(day?.tasks) ? day.tasks : [];
  const total = tasks.length;
  const done = tasks.filter((t) => t.completed).length;
  const required = tasks.filter((t) => !t.optional);
  const requiredTotal = required.length;
  const requiredDone = required.filter((t) => t.completed).length;
  // Required-only day progress (matches `calculateDayProgress` / backend).
  const percent = calculateDayProgress(day);

  let xpEarned = 0;
  let xpPending = 0;
  for (const task of tasks) {
    const xp = getTaskXp(task, monthProgress);
    if (task.completed) xpEarned += xp;
    else xpPending += xp;
  }
  return {
    total,
    done,
    requiredTotal,
    requiredDone,
    percent,
    xpEarned,
    xpPending,
  };
}

/** 7-entry array of XP earned per day in `week`. Missing days → 0. */
export function getWeekDayXp(week: Week, monthProgress: number): number[] {
  const out: number[] = [0, 0, 0, 0, 0, 0, 0];
  if (!week || !Array.isArray(week.days)) return out;
  week.days.forEach((day, idx) => {
    if (idx < 0 || idx >= 7) return;
    const stats = getDayStats(day, monthProgress);
    out[idx] = stats.xpEarned;
  });
  return out;
}

/**
 * Human-friendly recurrence label for a task.
 *
 *   - tasks with no `recurrenceId` (single, non-repeating) → `null`
 *   - tasks whose recurrence covers 1 day                     → `null`
 *   - tasks that cover all 7 days of the same week           → "ALL DAYS"
 *   - tasks that cover every weekday (Mon–Fri)               → "MON-FRI"
 *   - tasks that cover the full weekend                      → "WEEKEND"
 *   - otherwise a deduped, weekday-sorted short list joined by ","
 *
 * The function deliberately uses the days this task appears on within
 * `week` rather than counting all `recurrenceId` siblings across the
 * whole cycle — a single-week label is what the row needs to show.
 *
 * NOTE: the small label helpers below are duplicated in
 * `frontend/scripts/check-campaign-stats.mjs` for the standalone check
 * script (no Vite, no shared module loader). Keep both copies in sync.
 */
export function getReplicatedLabel(task: Task, week: Week): string | null {
  if (!task || !task.recurrenceId || !week || !Array.isArray(week.days)) return null;

  const dayShorts: string[] = [];
  for (const day of week.days) {
    if (!day) continue;
    const has = day.tasks.some(
      (t) => t && t.recurrenceId === task.recurrenceId,
    );
    if (has) dayShorts.push(dayShort(day.name));
  }
  if (dayShorts.length <= 1) return null;
  if (dayShorts.length === 7) return "ALL DAYS";

  const joined = uniqueOrdered(dayShorts);
  // Weekday patterns
  const weekdayKey = joined.join(",");
  if (weekdayKey === "MON,TUE,WED,THU,FRI") return "MON-FRI";
  if (weekdayKey === "SAT,SUN") return "WEEKEND";

  return joined.join(", ");
}

// ----- label helpers (duplicated in scripts/check-campaign-stats.mjs) -----

export function dayShort(name: string | undefined | null): string {
  const s = (name || "?").trim();
  if (!s) return "?";
  return s.substring(0, 3).toUpperCase();
}

function uniqueOrdered(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const it of items) {
    if (seen.has(it)) continue;
    seen.add(it);
    out.push(it);
  }
  return out;
}
