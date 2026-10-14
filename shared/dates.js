/**
 * Date helpers for v2.1 (month start dates + day dates + TODAY).
 *
 * Strict ISO date strings (`YYYY-MM-DD`) only. All conversions go through
 * UTC noon so the local weekday never shifts when a non-UTC backend / FE
 * pair crosses a DST boundary.
 *
 * Owner: W1 (backend engineering). Re-exported on the FE side by
 * `frontend/utils/sharedDates.ts` and consumed by W2/W3 view code.
 */
'use strict';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * True when `s` is shaped like `YYYY-MM-DD` AND parses to a real Date.
 * Examples: `2026-10-13` → true, `2026-13-01` → false,
 * `2026-02-30` → false (Feb 30 doesn't exist).
 */
function isIsoDate(s) {
  if (typeof s !== 'string' || !ISO_DATE.test(s)) return false;
  // Parse at UTC noon so weekday math uses the actual calendar day.
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  // Round-trip guard: a Feb 30th Date silently rolls into March.
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

/**
 * True if the *local* calendar date is a Monday. We construct the date at
 * UTC noon so any timezone offset the host might apply doesn't shift the
 * weekday by one (e.g. parsing `2026-10-12` at UTC 00:00 + PST becomes
 * the *previous* Sunday evening).
 */
function isMonday(isoDate) {
  if (!isIsoDate(isoDate)) return false;
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  // 1 = Monday, 0 = Sunday, 6 = Saturday — JavaScript locale.
  return dt.getUTCDay() === 1;
}

/**
 * 'YYYY-MM-DD' of the Monday of the week containing `date` (local).
 * Honours the host's local timezone — important so a user picking
 * "this Monday" sees the same Monday the rest of the app does.
 */
function mondayOf(date) {
  const when = date instanceof Date ? new Date(date.getTime()) : new Date();
  // 1 = Monday; anything else is offset to the previous Monday.
  const day = when.getDay();
  const offsetToMonday = day === 0 ? -6 : 1 - day; // Sun: go back 6
  when.setDate(when.getDate() + offsetToMonday);
  return formatLocalIsoDate(when);
}

/**
 * Compute the ISO date for the day at (`weekIndex`, `dayIndex`).
 * Returns `null` when `startDate` is missing or invalid (legacy months).
 *
 * - `weekIndex` zero-based: 0,1,2,3
 * - `dayIndex`   zero-based: 0..6 (Mon..Sun)
 *
 * Math happens at UTC noon so DST shifts can't push the result back
 * by a day.
 */
function dayDate(startDate, weekIndex, dayIndex) {
  if (!isIsoDate(startDate)) return null;
  if (!Number.isInteger(weekIndex) || weekIndex < 0) return null;
  if (!Number.isInteger(dayIndex) || dayIndex < 0 || dayIndex > 6) return null;
  const [y, m, d] = startDate.split('-').map(Number);
  const base = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  base.setUTCDate(base.getUTCDate() + weekIndex * 7 + dayIndex);
  // formatLocalIsoDate then re-shape as YYYY-MM-DD (it already pads locally;
  // we want the UTC equivalent so dayDate is timezone-stable).
  const yy = base.getUTCFullYear();
  const mm = String(base.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(base.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/** Day-of-month integer from an ISO date. `2026-10-17` → 17. */
function dayOfMonth(isoDate) {
  if (!isIsoDate(isoDate)) return NaN;
  return Number(isoDate.slice(8, 10));
}

/** Local 'YYYY-MM-DD' for the host clock now (`now` injectable for tests). */
function todayIso(now) {
  const when = now instanceof Date ? now : new Date();
  return formatLocalIsoDate(when);
}

/**
 * Locate "today" inside a cycle. Returns `{weekIndex, dayIndex}` when
 * the cycle has a startDate AND today (local) falls within its 28-day
 * window. Returns `null` otherwise — undated months have no TODAY, and
 * any cycle that doesn't cover today's calendar day has none either.
 *
 * `now` is injectable for tests (the smoke + fixtures need it).
 */
function findToday(cycle, now) {
  if (!cycle || !cycle.startDate) return null;
  if (!isIsoDate(cycle.startDate)) return null;
  const startIso = cycle.startDate;
  const today = todayIso(now);
  const startIdx = isoToUtcNoon(startIso);
  const todayIdx = isoToUtcNoon(today);
  if (todayIdx < startIdx) return null;
  const dayOffset = Math.floor((todayIdx - startIdx) / 86_400_000);
  if (dayOffset < 0 || dayOffset > 27) return null;
  return { weekIndex: Math.floor(dayOffset / 7), dayIndex: dayOffset % 7 };
}

// ---- internal helpers -----------------------------------------------------

function formatLocalIsoDate(d) {
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/** UTC noon ms epoch for an ISO date. Throws on invalid input. */
function isoToUtcNoon(iso) {
  if (!isIsoDate(iso)) throw new Error(`isoToUtcNoon: invalid ${iso}`);
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d, 12, 0, 0);
}

module.exports = {
  isIsoDate,
  isMonday,
  mondayOf,
  dayDate,
  dayOfMonth,
  todayIso,
  findToday,
};
