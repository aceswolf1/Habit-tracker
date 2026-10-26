// Checks composables/useDayOrdering.ts (sort, group, move neighbours).
// Run: node frontend/scripts/check-day-ordering.mjs   (Node ≥ 23.6 strips TS types)
import assert from "node:assert";
import {
  sortDayTasks, groupByFirstLabel, neighbourIndex, UNLABELED, DAY_SORTS,
} from "../composables/useDayOrdering.ts";

const t = (uuid, extra = {}) => ({ uuid, description: uuid, optional: false, completed: false, ...extra });
const tasks = [
  t("c", { timeOfDay: "night", dueTime: "22:00", labels: ["WORK"], completed: true }),
  t("a", { timeOfDay: "morning", dueTime: "07:30", labels: ["HEALTH", "WORK"] }),
  t("b"),
  t("d", { timeOfDay: "afternoon", dueTime: "13:00", labels: ["HEALTH"] }),
];
const ids = (list) => list.map((x) => x.uuid).join("");

assert.strictEqual(ids(sortDayTasks(tasks, "manual")), "cabd", "manual keeps saved order");
assert.strictEqual(ids(sortDayTasks(tasks, "timeOfDay")), "adcb", "morning→night, none last");
assert.strictEqual(ids(sortDayTasks(tasks, "dueTime")), "adcb", "earliest due first, none last");
assert.strictEqual(ids(sortDayTasks(tasks, "pending")), "abdc", "pending first, stable");
assert.strictEqual(ids(sortDayTasks(tasks, "label")), "adcb", "by first label, unlabeled last");
assert.strictEqual(ids(sortDayTasks(tasks, "name")), "abcd", "by name");
assert.strictEqual(ids(tasks), "cabd", "input not mutated");

const groups = groupByFirstLabel(tasks);
assert.deepStrictEqual(groups.map((g) => g.label), ["HEALTH", "WORK", UNLABELED]);
assert.strictEqual(ids(groups[0].tasks), "ad", "first label decides the group");

assert.strictEqual(neighbourIndex(tasks, "a", -1), 0);
assert.strictEqual(neighbourIndex(tasks, "c", -1), null, "top can't move up");
assert.strictEqual(neighbourIndex(tasks, "d", 1), null, "bottom can't move down");
assert.strictEqual(neighbourIndex(tasks, "a", 1), 2);
assert.strictEqual(DAY_SORTS.length, 6);
console.log("All day-ordering rules pass.");
