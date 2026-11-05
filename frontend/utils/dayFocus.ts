/**
 * Which week + day the campaign opens on, and how that choice is remembered.
 *
 * Saved per month in localStorage as `{ [cycleUuid]: { weekUuid, dayUuid, savedOn } }`.
 * Rules (`resolveDayFocus`):
 *   1. Dated month that contains today: the saved day if it was picked TODAY
 *      (a reload keeps your place), otherwise today.
 *   2. Otherwise: the saved day, if it still exists in this month.
 *   3. Otherwise: week 1, today's weekday.
 * Pure: no window / store access, so `scripts/check-day-focus.mjs` can run it.
 */

export const DAY_FOCUS_KEY = "dayFocus";
export const MAX_REMEMBERED = 12;

export interface DayFocus { weekUuid: string; dayUuid: string }
export interface SavedDayFocus extends DayFocus { savedOn: string }
export type DayFocusMap = Record<string, SavedDayFocus>;

/** "Today" as seen by the caller (built from shared/dates.js). */
export interface TodayContext {
  todayIso: string;
  /** `findToday(month)` — null when the month is undated or doesn't cover today. */
  today: { weekIndex: number; dayIndex: number } | null;
  /** Mon = 0 … Sun = 6. */
  weekdayIndex: number;
}

interface FocusMonth {
  uuid: string;
  weeks: ReadonlyArray<{ uuid: string; days: ReadonlyArray<{ uuid: string }> }>;
}

function savedEntry(map: unknown, cycleUuid: string): SavedDayFocus | null {
  if (!map || typeof map !== "object") return null;
  const e = (map as Record<string, unknown>)[cycleUuid] as Partial<SavedDayFocus> | undefined;
  if (!e || typeof e.weekUuid !== "string" || typeof e.dayUuid !== "string") return null;
  return { weekUuid: e.weekUuid, dayUuid: e.dayUuid, savedOn: typeof e.savedOn === "string" ? e.savedOn : "" };
}

function existsIn(month: FocusMonth, f: DayFocus): boolean {
  const week = month.weeks.find((w) => w.uuid === f.weekUuid);
  return !!week?.days.some((d) => d.uuid === f.dayUuid);
}

function at(month: FocusMonth, weekIndex: number, dayIndex: number): DayFocus | null {
  const week = month.weeks[weekIndex];
  const day = week?.days[dayIndex] ?? week?.days[0];
  return week && day ? { weekUuid: week.uuid, dayUuid: day.uuid } : null;
}

export function resolveDayFocus(
  month: FocusMonth | null | undefined,
  saved: unknown,
  ctx: TodayContext,
): DayFocus | null {
  if (!month?.weeks?.length) return null;
  const entry = savedEntry(saved, month.uuid);
  const valid = entry && existsIn(month, entry) ? entry : null;
  const pick = (f: SavedDayFocus): DayFocus => ({ weekUuid: f.weekUuid, dayUuid: f.dayUuid });
  if (ctx.today) {
    if (valid && valid.savedOn === ctx.todayIso) return pick(valid);
    const today = at(month, ctx.today.weekIndex, ctx.today.dayIndex);
    if (today) return today;
  }
  if (valid) return pick(valid);
  return at(month, 0, ctx.weekdayIndex);
}

/** Returns a NEW map with this month's choice stamped; keeps the newest MAX_REMEMBERED. */
export function rememberDayFocus(
  map: unknown,
  cycleUuid: string,
  weekUuid: string,
  dayUuid: string,
  todayIso: string,
): DayFocusMap {
  const base = map && typeof map === "object" ? (map as DayFocusMap) : {};
  const others = Object.entries(base).filter(([k]) => k !== cycleUuid);
  const kept = others.slice(Math.max(0, others.length - (MAX_REMEMBERED - 1)));
  return Object.fromEntries([...kept, [cycleUuid, { weekUuid, dayUuid, savedOn: todayIso }]]);
}
