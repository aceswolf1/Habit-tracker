import { promises } from 'fs';
import { join } from 'path';
import { d as defineEventHandler, r as readBody } from '../../nitro/nitro.mjs';
import 'node:http';
import 'node:https';
import 'node:events';
import 'node:buffer';
import 'node:fs';
import 'node:path';
import 'node:crypto';
import 'node:url';

const DATA_PATH = join(process.cwd(), "data", "monthData.json");
function recomputeProgress(month) {
  if (!month) return;
  for (const week of month.weeks) {
    let weekTotalTasks = 0;
    let weekCompleted = 0;
    for (const day of week.days) {
      const required = day.tasks.filter((t) => !t.optional);
      weekTotalTasks += required.length;
      weekCompleted += required.filter((t) => t.completed).length;
    }
    if (weekTotalTasks > 0) {
      week.progress = Math.round(weekCompleted / weekTotalTasks * 100);
      week.conquered = weekCompleted === weekTotalTasks;
    } else {
      week.progress = 0;
      week.conquered = false;
    }
  }
  const weekCount = month.weeks.length;
  if (!weekCount) {
    month.progress = 0;
    return;
  }
  const totalWeekProgress = month.weeks.reduce(
    (sum, w) => sum + (w.progress || 0),
    0
  );
  const base = Math.round(totalWeekProgress / weekCount);
  let bonus = 0;
  if (base === 100) {
    let optionalCompleted = 0;
    for (const w of month.weeks) {
      for (const d of w.days) {
        optionalCompleted += d.tasks.filter(
          (t) => t.optional && t.completed
        ).length;
      }
    }
    bonus = Math.min(10, optionalCompleted * 2);
  }
  month.progress = Math.min(110, base + bonus);
}
async function readTasks() {
  try {
    const data = await promises.readFile(DATA_PATH, "utf-8");
    const parsed = JSON.parse(data);
    if (!parsed.months) {
      if (parsed.month) {
        parsed.months = [parsed.month];
        parsed.currentMonthUuid = parsed.month.uuid;
        delete parsed.month;
      } else {
        parsed.months = [];
      }
    }
    if (!parsed.currentMonthUuid && parsed.months.length) {
      parsed.currentMonthUuid = parsed.months[0].uuid;
    }
    return parsed;
  } catch (err) {
    return { months: [] };
  }
}
async function writeTasks(data) {
  await promises.writeFile(DATA_PATH, JSON.stringify(data, null, 2), "utf-8");
}
function createEmptyMonth(name) {
  const monthUuid = `m-${Math.random().toString(36).slice(2)}`;
  const weeks = [];
  const weekNames = ["Week One", "Week Two", "Week Three", "Week Four"];
  for (let w = 0; w < 4; w++) {
    const weekUuid = `w-${w + 1}-${monthUuid}`;
    const days = [];
    for (let d = 0; d < 7; d++) {
      days.push({
        uuid: `w${w + 1}-d${d + 1}-${monthUuid}`,
        name: `Day ${d + 1}`,
        subtitle: "",
        tasks: []
      });
    }
    weeks.push({
      uuid: weekUuid,
      name: weekNames[w] || `Week ${w + 1}`,
      subtitle: "",
      progress: 0,
      conquered: false,
      backgroundImages: [],
      days
    });
  }
  return {
    uuid: monthUuid,
    name: name || "New Month",
    subtitle: "",
    progress: 0,
    weeks,
    finished: false,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}
const tasks = defineEventHandler(async (event) => {
  var _a, _b, _c, _d, _e, _f;
  if (event.method === "GET") {
    const data = await readTasks();
    (_a = data.months) == null ? void 0 : _a.forEach(recomputeProgress);
    await writeTasks(data);
    return { months: data.months, currentMonthUuid: data.currentMonthUuid };
  }
  if (event.method === "POST") {
    const body = await readBody(event);
    const data = await readTasks();
    const { type } = body || {};
    if (type === "createMonth") {
      const newMonth = createEmptyMonth(body == null ? void 0 : body.name);
      recomputeProgress(newMonth);
      data.months = data.months || [];
      data.months.push(newMonth);
      data.currentMonthUuid = newMonth.uuid;
      await writeTasks(data);
      return {
        success: true,
        month: newMonth,
        months: data.months,
        currentMonthUuid: data.currentMonthUuid
      };
    }
    if (type === "finishMonth" && (body == null ? void 0 : body.monthUuid)) {
      const month = (_b = data.months) == null ? void 0 : _b.find((m) => m.uuid === body.monthUuid);
      if (!month) return { success: false, message: "Month not found" };
      if (!month.finished) {
        month.finished = true;
        month.finishedAt = (/* @__PURE__ */ new Date()).toISOString();
        recomputeProgress(month);
        await writeTasks(data);
      }
      return { success: true, month, months: data.months };
    }
    if (type === "setCurrentMonth" && (body == null ? void 0 : body.monthUuid)) {
      const exists = (_c = data.months) == null ? void 0 : _c.some((m) => m.uuid === body.monthUuid);
      if (!exists) return { success: false, message: "Month not found" };
      data.currentMonthUuid = body.monthUuid;
      const month = data.months.find((m) => m.uuid === body.monthUuid);
      recomputeProgress(month);
      await writeTasks(data);
      return { success: true, month, currentMonthUuid: data.currentMonthUuid };
    }
    if (type === "addTasks" && Array.isArray(body.additions)) {
      const monthUuid = body.monthUuid || data.currentMonthUuid;
      const month = (_d = data.months) == null ? void 0 : _d.find((m) => m.uuid === monthUuid);
      if (!month) return { success: false, message: "Month not found" };
      if (month.finished)
        return { success: false, message: "Month is finished" };
      for (const addition of body.additions) {
        const { weekUuid, dayUuid, task } = addition || {};
        if (!weekUuid || !dayUuid || !task) continue;
        let week = month.weeks.find((w) => w.uuid === weekUuid);
        if (!week) {
          week = {
            uuid: weekUuid,
            name: "Week",
            subtitle: "",
            progress: 0,
            conquered: false,
            backgroundImages: [],
            days: []
          };
          month.weeks.push(week);
        }
        let day = week.days.find((d) => d.uuid === dayUuid);
        if (!day) {
          day = { uuid: dayUuid, name: "Day", subtitle: "", tasks: [] };
          week.days.push(day);
        }
        if (!day.tasks.find((t) => t.uuid === task.uuid)) day.tasks.push(task);
      }
      recomputeProgress(month);
      await writeTasks(data);
      return { success: true, month, months: data.months };
    }
    if (type === "deleteTasks") {
      const monthUuid = body.monthUuid || data.currentMonthUuid;
      const month = (_e = data.months) == null ? void 0 : _e.find((m) => m.uuid === monthUuid);
      if (!month) return { success: false, message: "Month not found" };
      if (month.finished)
        return { success: false, message: "Month is finished" };
      const { taskUuids, recurrenceId } = body;
      for (const week of month.weeks) {
        for (const day of week.days) {
          if (Array.isArray(taskUuids) && taskUuids.length) {
            day.tasks = day.tasks.filter((t) => !taskUuids.includes(t.uuid));
          } else if (recurrenceId) {
            day.tasks = day.tasks.filter(
              (t) => t.recurrenceId !== recurrenceId
            );
          }
        }
      }
      recomputeProgress(month);
      await writeTasks(data);
      return { success: true, month, months: data.months };
    }
    if (type === "updateTasks" && Array.isArray(body.updates)) {
      const monthUuid = body.monthUuid || data.currentMonthUuid;
      const month = (_f = data.months) == null ? void 0 : _f.find((m) => m.uuid === monthUuid);
      if (!month) return { success: false, message: "Month not found" };
      if (month.finished)
        return { success: false, message: "Month is finished" };
      const updates = body.updates;
      for (const upd of updates) {
        const { uuid, completed, description, optional, icon } = upd || {};
        if (!uuid) continue;
        outer: for (const week of month.weeks) {
          for (const day of week.days) {
            const task = day.tasks.find((t) => t.uuid === uuid);
            if (task) {
              if (typeof completed === "boolean") task.completed = completed;
              if (description !== void 0) task.description = description;
              if (optional !== void 0) task.optional = optional;
              if (icon !== void 0) task.icon = icon;
              break outer;
            }
          }
        }
      }
      recomputeProgress(month);
      await writeTasks(data);
      return { success: true, month, months: data.months };
    }
    if ((body == null ? void 0 : body.month) && (body == null ? void 0 : body.week) && (body == null ? void 0 : body.task)) {
      if (!data.months || !data.months.length) {
        data.months = [createEmptyMonth(body.month)];
        data.currentMonthUuid = data.months[0].uuid;
      }
      const monthObj = data.months[0];
      let weekObj = monthObj.weeks.find(
        (w) => w.uuid === `legacy-week-${body.week}`
      );
      if (!weekObj) {
        weekObj = {
          uuid: `legacy-week-${body.week}`,
          name: `Week ${body.week}`,
          subtitle: "",
          progress: 0,
          conquered: false,
          days: []
        };
        monthObj.weeks.push(weekObj);
      }
      let day = weekObj.days[0];
      if (!day) {
        day = {
          uuid: `legacy-w${body.week}-d1`,
          name: "Day 1",
          subtitle: "",
          tasks: []
        };
        weekObj.days.push(day);
      }
      day.tasks.push(body.task);
      await writeTasks(data);
      return { success: true };
    }
    return { success: false, message: "Invalid payload" };
  }
});

export { tasks as default };
//# sourceMappingURL=tasks.mjs.map
