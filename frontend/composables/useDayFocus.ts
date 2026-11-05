/**
 * Browser side of `utils/dayFocus.ts`: reads / writes the remembered
 * week + day per month in localStorage and builds the "today" context
 * from the shared date helpers. Client-only; every call is a no-op (or
 * returns null) on the server or when storage is unavailable.
 */
import {
  DAY_FOCUS_KEY, rememberDayFocus, resolveDayFocus, type DayFocus,
} from "../utils/dayFocus";
import { findToday, todayIso } from "../utils/sharedDates";

function readMap(): unknown {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DAY_FOCUS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null; // corrupt JSON or storage blocked → behave as "nothing saved"
  }
}

export function loadDayFocus(month: any): DayFocus | null {
  if (typeof window === "undefined" || !month) return null;
  const now = new Date();
  return resolveDayFocus(month, readMap(), {
    todayIso: todayIso(now),
    today: findToday(month, now),
    weekdayIndex: (now.getDay() + 6) % 7,
  });
}

export function saveDayFocus(cycleUuid: string, weekUuid: string, dayUuid: string): void {
  if (typeof window === "undefined") return;
  try {
    const next = rememberDayFocus(readMap(), cycleUuid, weekUuid, dayUuid, todayIso(new Date()));
    window.localStorage.setItem(DAY_FOCUS_KEY, JSON.stringify(next));
  } catch (err) {
    if (import.meta.dev) console.warn("[dayFocus] could not save", err);
  }
}
