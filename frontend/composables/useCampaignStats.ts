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
// TimeOfDay is re-exported by `utils/sharedTaskMeta.ts`; we don't
// re-export it here to avoid Nuxt's "Duplicated imports" warning.

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
  const base = calculateTaskPoints(
    !!task.optional,
    monthProgress,
    !!task.legendary,
  );
  // v2.2: a completed task also earned its stored strike bonus.
  const bonus = task.completed ? task.comboBonus || 0 : 0;
  return base + bonus;
}

/**
 * v2.1 (contract §5): format `durationMin` as the display rule:
 *   < 60 min  → `MM:00` (e.g. 5 → `05:00`)
 *   ≥ 60 min  → `H:MM:00` (60 → `1:00:00`, 90 → `1:30:00`)
 * Returns `null` for missing / invalid input so callers can `v-if`
 * on the result without coercing.
 */
export function formatDurationLabel(durationMin: unknown): string | null {
  if (durationMin === null || durationMin === undefined) return null;
  const n = Number(durationMin);
  if (!Number.isFinite(n) || n <= 0) return null;
  const minutes = Math.round(n);
  if (minutes < 60) {
    return `${String(minutes).padStart(2, "0")}:00`;
  }
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${String(m).padStart(2, "0")}:00`;
}

/**
 * v2.1 (contract §5): compute the "DUE IN …" / "OVERDUE" line for a
 * task on today's day. Returns `null` when nothing should be shown
 * (no dueTime, day is not today, task already completed). Pure: takes
 * `now` so callers can drive a 60-second tick from a single Date.
 */
export function getDueTimeLine(
  task: Task,
  options: { isToday: boolean; now?: Date } | null,
  hhmm: string | null,
): { text: string; tone: "amber" | "danger" } | null {
  if (!options || !options.isToday) return null;
  if (!hhmm) return null;
  if (task.completed) return null;
  const now = options.now ?? new Date();
  const parsed = parseHHMM(hhmm);
  if (!parsed) return null;
  const due = new Date(now);
  due.setHours(parsed.h, parsed.m, 0, 0);
  const diffMs = due.getTime() - now.getTime();
  const absMin = Math.round(Math.abs(diffMs) / 60000);
  if (diffMs >= 0) {
    return { text: `DUE IN ${humanizeDuration(absMin)}`, tone: "amber" };
  }
  return { text: "OVERDUE", tone: "danger" };
}

/**
 * v2.1: pretty-print the minutes between two times, e.g.
 * `humanizeDuration(160) === "2H 40M"`. Same display rule the contract
 * shows for "DUE IN 2H 40M" examples.
 */
export function humanizeDuration(min: number): string {
  const m = Math.max(0, Math.round(min));
  if (m < 60) return `${m}M`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (rem === 0) return `${h}H`;
  return `${h}H ${rem}M`;
}

function parseHHMM(s: string): { h: number; m: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return { h, m: min };
}

/**
 * v2.1 (contract §5): uppercase label for the task's `timeOfDay`
 * (`morning` → `MORNING`, `afternoon` → `AFTERNOON`, etc.).
 * Returns `null` when no `timeOfDay` is set.
 */
export function timeOfDayLabel(tod: unknown): string | null {
  if (!tod) return null;
  return String(tod).toUpperCase();
}

/**
 * v2.1 (contract §5): which PpBadge `kind` to render for a given
 * task tag. Returns `null` for the un-tagged case (caller skips the
 * badge).
 */
export function tagBadgeKind(tag: unknown): "common" | "rare" | "essential" | "defense" | null {
  if (!tag) return null;
  switch (tag) {
    case "common":
    case "rare":
    case "essential":
    case "defense":
      return tag;
    default:
      return null;
  }
}

export function tagBadgeLabel(tag: unknown): string | null {
  const k = tagBadgeKind(tag);
  return k ? k.toUpperCase() : null;
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
