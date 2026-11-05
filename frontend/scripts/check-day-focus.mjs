// Checks utils/dayFocus.ts — which week/day the campaign opens on.
// Run: node frontend/scripts/check-day-focus.mjs   (Node ≥ 23.6 strips TS types)
import assert from "node:assert";
import { createRequire } from "node:module";
import { resolveDayFocus as resolve, rememberDayFocus as remember, MAX_REMEMBERED } from "../utils/dayFocus.ts";

const { findToday, todayIso } = createRequire(import.meta.url)("../../shared/dates.js");
// Same "today" context the app builds (composables/useDayFocus.ts).
const ctxFor = (m, now) => ({
  todayIso: todayIso(now), today: findToday(m, now), weekdayIndex: (now.getDay() + 6) % 7,
});
const resolveDayFocus = (m, saved, now) => resolve(m, saved, ctxFor(m, now));
const rememberDayFocus = (map, c, w, d, now) => remember(map, c, w, d, todayIso(now));

const month = (startDate = null, uuid = "m1") => ({
  uuid, startDate,
  weeks: [0, 1, 2, 3].map((w) => ({
    uuid: `w${w}`,
    days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
      .map((name, d) => ({ uuid: `d${w}${d}`, name })),
  })),
});
const WED = new Date(2026, 10, 4, 10); // Wed 2026-11-04 local
const saved = (weekUuid, dayUuid, savedOn = "2026-11-04") => ({ m1: { weekUuid, dayUuid, savedOn } });

// Undated month: saved selection wins, any day.
assert.deepStrictEqual(resolveDayFocus(month(), saved("w2", "d22", "2026-10-01"), WED), { weekUuid: "w2", dayUuid: "d22" });
// Undated, nothing saved: week 1 + today's weekday.
assert.deepStrictEqual(resolveDayFocus(month(), {}, WED), { weekUuid: "w0", dayUuid: "d02" });
// Saved uuids that no longer exist → fall back.
assert.deepStrictEqual(resolveDayFocus(month(), saved("w9", "d99"), WED), { weekUuid: "w0", dayUuid: "d02" });
// Day not in saved week → fall back.
assert.deepStrictEqual(resolveDayFocus(month(), saved("w1", "d22"), WED), { weekUuid: "w0", dayUuid: "d02" });
// Other month's entry ignored.
assert.deepStrictEqual(resolveDayFocus(month(null, "m2"), saved("w2", "d22"), WED), { weekUuid: "w0", dayUuid: "d02" });

// Dated month starting Mon 2026-10-19 → today (11-04) = week 3 (idx 2), Wed (idx 2).
const dated = month("2026-10-19");
// Saved today → restore it (reload keeps your place).
assert.deepStrictEqual(resolveDayFocus(dated, saved("w0", "d04"), WED), { weekUuid: "w0", dayUuid: "d04" });
// Saved on an earlier date → jump to today.
assert.deepStrictEqual(resolveDayFocus(dated, saved("w0", "d04", "2026-11-03"), WED), { weekUuid: "w2", dayUuid: "d22" });
// Nothing saved → today.
assert.deepStrictEqual(resolveDayFocus(dated, {}, WED), { weekUuid: "w2", dayUuid: "d22" });
// Dated but today outside the month → saved, else week 1.
const old = month("2026-01-05");
assert.deepStrictEqual(resolveDayFocus(old, saved("w3", "d36", "2026-02-01"), WED), { weekUuid: "w3", dayUuid: "d36" });
assert.deepStrictEqual(resolveDayFocus(old, {}, WED), { weekUuid: "w0", dayUuid: "d02" });
// Empty / missing month.
assert.strictEqual(resolveDayFocus(null, {}, WED), null);
assert.strictEqual(resolveDayFocus({ uuid: "x", weeks: [] }, {}, WED), null);

// rememberDayFocus: returns a new map, stamps date, caps entries, keeps newest.
const before = { m1: { weekUuid: "w0", dayUuid: "d00", savedOn: "2026-11-01" } };
const after = rememberDayFocus(before, "m1", "w1", "d13", WED);
assert.deepStrictEqual(after.m1, { weekUuid: "w1", dayUuid: "d13", savedOn: "2026-11-04" });
assert.strictEqual(before.m1.dayUuid, "d00", "input not mutated");
let many = {};
for (let i = 0; i < MAX_REMEMBERED + 5; i++) many = rememberDayFocus(many, `c${i}`, "w0", "d00", WED);
assert.strictEqual(Object.keys(many).length, MAX_REMEMBERED);
assert.ok(many[`c${MAX_REMEMBERED + 4}`], "newest kept");
assert.ok(!many.c0, "oldest dropped");
// Garbage input tolerated.
assert.deepStrictEqual(resolveDayFocus(month(), "nope", WED), { weekUuid: "w0", dayUuid: "d02" });
assert.deepStrictEqual(resolveDayFocus(month(), { m1: { weekUuid: 3 } }, WED), { weekUuid: "w0", dayUuid: "d02" });
console.log("All day-focus rules pass.");
