import { promises as fs } from "fs";
import { join } from "path";
import { defineEventHandler, readBody } from "h3";

const DATA_PATH = join(process.cwd(), "data", "monthData.json");

interface Task {
  uuid: string;
  description: string;
  optional: boolean;
  completed: boolean;
  recurrenceId?: string;
  order?: number;
  icon?: string;
}
interface Day {
  uuid: string;
  name: string;
  subtitle: string;
  tasks: Task[];
}
interface Week {
  uuid: string;
  name: string;
  subtitle: string;
  progress: number;
  conquered?: boolean;
  backgroundImages?: string[];
  days: Day[];
}
interface Month {
  uuid: string;
  name: string;
  subtitle: string;
  progress: number;
  weeks: Week[];
  finished?: boolean;
  createdAt?: string;
  finishedAt?: string;
}
interface DataFileShape {
  month?: Month; // legacy single month
  months?: Month[];
  currentMonthUuid?: string;
}

// Recalculate week and month progress (mirrors client logic)
function recomputeProgress(month: Month) {
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
      week.progress = Math.round((weekCompleted / weekTotalTasks) * 100);
      week.conquered = weekCompleted === weekTotalTasks;
    } else {
      week.progress = 0;
      week.conquered = false;
    }
  }
  // Month progress average of weeks + bonus for optional completed if base 100
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

// Helper to read tasks data & migrate legacy shape
async function readTasks(): Promise<DataFileShape> {
  try {
    const data = await fs.readFile(DATA_PATH, "utf-8");
    const parsed: DataFileShape = JSON.parse(data);
    // Migrate if only legacy month exists
    if (!parsed.months) {
      if (parsed.month) {
        parsed.months = [parsed.month];
        parsed.currentMonthUuid = parsed.month.uuid;
        delete (parsed as any).month; // remove legacy root
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

// Helper to write tasks data
async function writeTasks(data: DataFileShape) {
  await fs.writeFile(DATA_PATH, JSON.stringify(data, null, 2), "utf-8");
}

// Utility to scaffold a fresh month (4 weeks * 7 days)
function createEmptyMonth(name?: string): Month {
  const monthUuid = `m-${Math.random().toString(36).slice(2)}`;
  const weeks: Week[] = [];
  const weekNames = ["Week One", "Week Two", "Week Three", "Week Four"];
  for (let w = 0; w < 4; w++) {
    const weekUuid = `w-${w + 1}-${monthUuid}`;
    const days: Day[] = [];
    for (let d = 0; d < 7; d++) {
      days.push({
        uuid: `w${w + 1}-d${d + 1}-${monthUuid}`,
        name: `Day ${d + 1}`,
        subtitle: "",
        tasks: [],
      });
    }
    weeks.push({
      uuid: weekUuid,
      name: weekNames[w] || `Week ${w + 1}`,
      subtitle: "",
      progress: 0,
      conquered: false,
      backgroundImages: [],
      days,
    });
  }
  return {
    uuid: monthUuid,
    name: name || "New Month",
    subtitle: "",
    progress: 0,
    weeks,
    finished: false,
    createdAt: new Date().toISOString(),
  };
}

export default defineEventHandler(async (event) => {
  if (event.method === "GET") {
    const data = await readTasks();
    // Recompute progress for all months before returning (ensures persistence)
    data.months?.forEach(recomputeProgress);
    await writeTasks(data);
    return { months: data.months, currentMonthUuid: data.currentMonthUuid };
  }

  if (event.method === "POST") {
    const body = await readBody(event);
    const data = await readTasks();

    const { type } = body || {};

    // Create new month
    if (type === "createMonth") {
      const newMonth = createEmptyMonth(body?.name);
      recomputeProgress(newMonth);
      data.months = data.months || [];
      data.months.push(newMonth);
      data.currentMonthUuid = newMonth.uuid;
      await writeTasks(data);
      return {
        success: true,
        month: newMonth,
        months: data.months,
        currentMonthUuid: data.currentMonthUuid,
      };
    }

    // Finish month (set immutable)
    if (type === "finishMonth" && body?.monthUuid) {
      const month = data.months?.find((m) => m.uuid === body.monthUuid);
      if (!month) return { success: false, message: "Month not found" };
      if (!month.finished) {
        month.finished = true;
        month.finishedAt = new Date().toISOString();
        recomputeProgress(month);
        await writeTasks(data);
      }
      return { success: true, month, months: data.months };
    }

    // Switch current month
    if (type === "setCurrentMonth" && body?.monthUuid) {
      const exists = data.months?.some((m) => m.uuid === body.monthUuid);
      if (!exists) return { success: false, message: "Month not found" };
      data.currentMonthUuid = body.monthUuid;
      const month = data.months!.find((m) => m.uuid === body.monthUuid)!;
      recomputeProgress(month);
      await writeTasks(data);
      return { success: true, month, currentMonthUuid: data.currentMonthUuid };
    }

    // Task additions: require monthUuid
    if (type === "addTasks" && Array.isArray(body.additions)) {
      const monthUuid = body.monthUuid || data.currentMonthUuid;
      const month = data.months?.find((m) => m.uuid === monthUuid);
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
            days: [],
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

    // Delete tasks
    if (type === "deleteTasks") {
      const monthUuid = body.monthUuid || data.currentMonthUuid;
      const month = data.months?.find((m) => m.uuid === monthUuid);
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

    // Update tasks (completion state / metadata). Expects updates: [{ uuid, completed?, description?, optional?, icon? }]
    if (type === "updateTasks" && Array.isArray(body.updates)) {
      const monthUuid = body.monthUuid || data.currentMonthUuid;
      const month = data.months?.find((m) => m.uuid === monthUuid);
      if (!month) return { success: false, message: "Month not found" };
      if (month.finished)
        return { success: false, message: "Month is finished" };
      const updates: any[] = body.updates;
      for (const upd of updates) {
        const { uuid, completed, description, optional, icon } = upd || {};
        if (!uuid) continue;
        outer: for (const week of month.weeks) {
          for (const day of week.days) {
            const task = day.tasks.find((t) => t.uuid === uuid);
            if (task) {
              if (typeof completed === "boolean") task.completed = completed;
              if (description !== undefined) task.description = description;
              if (optional !== undefined) task.optional = optional;
              if (icon !== undefined) task.icon = icon;
              break outer;
            }
          }
        }
      }
      recomputeProgress(month);
      await writeTasks(data);
      return { success: true, month, months: data.months };
    }

    // Legacy fallback still supported (adds tasks in minimal shape) but now binds to first month
    if (body?.month && body?.week && body?.task) {
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
          days: [],
        };
        monthObj.weeks.push(weekObj as any);
      }
      // Not fully mapping legacy tasks, just appending to a synthetic day
      let day = weekObj.days[0];
      if (!day) {
        day = {
          uuid: `legacy-w${body.week}-d1`,
          name: "Day 1",
          subtitle: "",
          tasks: [],
        } as Day;
        weekObj.days.push(day);
      }
      day.tasks.push(body.task);
      await writeTasks(data);
      return { success: true };
    }

    return { success: false, message: "Invalid payload" };
  }
});
