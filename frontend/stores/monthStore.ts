import { defineStore } from "pinia";

// Simple utility for debugging
const logState = (message: string, data: any) => {
  console.log(`%c${message}`, "background: #333; color: #bada55", data);
};
//import { Month } from "../types/index";

interface Task {
  uuid: string;
  description: string;
  optional: boolean;
  completed: boolean;
  recurrenceId?: string; // link tasks in a recurrence pattern
  order?: number; // ordering within a day
  icon?: string; // emoji/icon representation
  gifUrl?: string; // GIF URL from Klipy API
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
  days: Day[];
}

interface Month {
  uuid: string;
  name: string;
  subtitle: string;
  progress: number;
  score?: number;
  weeks: Week[];
  finished?: boolean;
  createdAt?: string;
  finishedAt?: string;
}

export const useMonthStore = defineStore("month", {
  state: () => ({
    // Create a deep copy of the month data from the JSON file
    months: [] as Month[],
    currentMonth: null as Month | null,
    currentMonthUuid: null as string | null,
    lifetimeScore: 0,
    isLoading: false,
    error: null as string | null,
  }),

  getters: {
    // Get the current month data
    getMonth: (state) => state.currentMonth,
    getMonths: (state) => state.months,
    isFinished: (state) => !!state.currentMonth?.finished,

    // Get the current month progress
    getProgress: (state) =>
      state.currentMonth ? state.currentMonth.progress : 0,

    // Get all weeks from the current month
    getWeeks: (state) => (state.currentMonth ? state.currentMonth.weeks : []),

    // Get a specific week by uuid
    getWeekByUuid: (state) => (uuid: string) => {
      return state.currentMonth
        ? state.currentMonth.weeks.find((week) => week.uuid === uuid)
        : undefined;
    },

    // Check if a specific week is conquered
    isWeekConquered: (state) => (uuid: string) => {
      const week = state.currentMonth
        ? state.currentMonth.weeks.find((week) => week.uuid === uuid)
        : undefined;
      return week ? week.conquered || false : false;
    },

    // Get a specific day by uuid
    getDayByUuid: (state) => (uuid: string) => {
      if (!state.currentMonth) return null;
      for (const week of state.currentMonth.weeks) {
        const day = week.days.find((day) => day.uuid === uuid);
        if (day) return day;
      }
      return null;
    },

    // Get a specific task by uuid
    getTaskByUuid: (state) => (uuid: string) => {
      if (!state.currentMonth) return null;
      for (const week of state.currentMonth.weeks) {
        for (const day of week.days) {
          const task = day.tasks.find((task) => task.uuid === uuid);
          if (task) return task;
        }
      }
      return null;
    },
  },

  actions: {
    // Toggle the completion status of a task
    toggleTaskCompletion(taskUuid: string) {
      console.log("Toggle task completion for UUID:", taskUuid);

      let taskFound = false;
      let taskToggled = false;

      if (!this.currentMonth || this.currentMonth.finished) return;
      for (const week of this.currentMonth.weeks) {
        for (const day of week.days) {
          const taskIndex = day.tasks.findIndex(
            (task) => task.uuid === taskUuid
          );
          if (taskIndex !== -1) {
            taskFound = true;
            const task = day.tasks[taskIndex];
            const newStatus = !task.completed;
            console.log(
              `Found task "${task.description}" in ${day.name} of ${week.name}`
            );
            console.log(
              `Toggling completion from ${task.completed} to ${newStatus}`
            );
            // Toggle the task completion status
            task.completed = newStatus;
            taskToggled = true;
            // Recalculate all progress values
            this.updateProgressValues();
            // Persist completion state to backend so it survives later mutations
            fetch(`http://localhost:4000/api/cycles/${this.currentMonth!.uuid}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                type: "updateTasks",
                updates: [{ uuid: task.uuid, completed: task.completed }],
              }),
            })
              .then((r) => r.json())
              .then((res) => {
                if (res?.month) {
                  this.currentMonth = res.month;
                  this.updateProgressValues();
                }
                // Emit event for floating points animation
                if (res?.pointsEarned && res.pointsEarned !== 0) {
                  window.dispatchEvent(new CustomEvent('pointsEarned', {
                    detail: {
                      points: res.pointsEarned,
                      taskUuid: taskUuid,
                      tier: res.currentTier
                    }
                  }));
                }
                // Update lifetime score
                if (res?.pointsEarned && res.pointsEarned > 0) {
                  this.lifetimeScore += res.pointsEarned;
                }
              })
              .catch((err) => console.error("Persist toggle failed", err));
            return;
          }
        }
      }

      if (!taskFound) {
        console.error(`Task with UUID ${taskUuid} not found!`);
      } else if (!taskToggled) {
        console.error(`Task with UUID ${taskUuid} found but not toggled!`);
      }
    },

    // Update progress values for days, weeks, and month
    updateProgressValues() {
      // First, log the current state for debugging
      console.log("Updating progress values...");

      // Update day progress values
      if (!this.currentMonth) return;
      for (const week of this.currentMonth.weeks) {
        for (const day of week.days) {
          const totalTasks = day.tasks.length;
          const completedTasks = day.tasks.filter(
            (task) => task.completed
          ).length;
          // For each day, calculate progress (excluding optional uncompleted tasks)
          if (totalTasks > 0) {
            // We don't have day.progress in the model yet, but we could add it
            console.log(
              `Day ${day.name} tasks: ${completedTasks}/${totalTasks} completed`
            );
          }
        }
        // Calculate week progress based on completed tasks in all days
        let weekTotalTasks = 0;
        let weekCompletedTasks = 0;
        for (const day of week.days) {
          const requiredTasks = day.tasks.filter((task) => !task.optional);
          weekTotalTasks += requiredTasks.length;
          weekCompletedTasks += requiredTasks.filter(
            (task) => task.completed
          ).length;
        }
        if (weekTotalTasks > 0) {
          // Calculate the week progress percentage
          const weekProgress = Math.round(
            (weekCompletedTasks / weekTotalTasks) * 100
          );
          // Update the week progress
          week.progress = weekProgress;
          // Determine if the week is conquered (all required tasks completed)
          week.conquered = weekCompletedTasks === weekTotalTasks;
          console.log(
            `Week ${week.name}: ${weekCompletedTasks}/${weekTotalTasks} required tasks completed (${weekProgress}%)`
          );
          console.log(`Week ${week.name} conquered: ${week.conquered}`);
        }
      }

      // Calculate month progress as the average of week.progress values so each
      // week contributes equally (prevents a single early week from hitting 100%).
      if (!this.currentMonth) return;
      const weekCount = this.currentMonth.weeks.length;
      if (weekCount === 0) {
        this.currentMonth.progress = 0;
        return;
      }
      const totalWeekProgress = this.currentMonth.weeks.reduce(
        (sum, w) => sum + (w.progress || 0),
        0
      );
      const baseMonthProgress = Math.round(totalWeekProgress / weekCount);

      // Optional bonus logic (mirrors day bonus): once all required tasks across
      // the month are complete (i.e., baseMonthProgress === 100) allow bonus up
      // to +10% based on completed optional tasks (2% per optional task).
      let bonus = 0;
      if (baseMonthProgress === 100) {
        let optionalCompleted = 0;
        for (const week of this.currentMonth.weeks) {
          for (const day of week.days) {
            optionalCompleted += day.tasks.filter(
              (t) => t.optional && t.completed
            ).length;
          }
        }
        bonus = Math.min(10, optionalCompleted * 2); // 2% per optional, cap 10
      }
      const finalProgress = Math.min(110, baseMonthProgress + bonus);
      this.currentMonth.progress = finalProgress;
      console.log(
        `Month progress (avg of weeks): base=${baseMonthProgress}%, bonus=${bonus}%, final=${finalProgress}%`
      );
    },

    // Add a new task to a specific day
    addTask(
      dayUuid: string,
      description: string,
      optional: boolean = false,
      icon?: string,
      gifUrl?: string
    ) {
      if (!this.currentMonth || this.currentMonth.finished) return;
      for (const week of this.currentMonth.weeks) {
        const dayIndex = week.days.findIndex((day) => day.uuid === dayUuid);
        if (dayIndex !== -1) {
          // Generate a new UUID for the task
          const newUuid =
            "t-" +
            Math.random().toString(36).substring(2, 15) +
            Math.random().toString(36).substring(2, 15);
          week.days[dayIndex].tasks.push({
            uuid: newUuid,
            description,
            optional,
            completed: false,
            icon,
            gifUrl,
          });
          this.updateProgressValues();
          return;
        }
      }
    },

    // Remove a task
    removeTask(taskUuid: string) {
      if (!this.currentMonth || this.currentMonth.finished) return;
      for (const week of this.currentMonth.weeks) {
        for (const day of week.days) {
          const taskIndex = day.tasks.findIndex(
            (task) => task.uuid === taskUuid
          );
          if (taskIndex !== -1) {
            day.tasks.splice(taskIndex, 1);
            this.updateProgressValues();
            return;
          }
        }
      }
    },

    // Update a task's description
    updateTaskDescription(taskUuid: string, newDescription: string) {
      const task = this.getTaskByUuid(taskUuid);
      if (task) {
        task.description = newDescription;
      }
    },

    // Load months data from backend API
    async fetchMonthData() {
      try {
        this.isLoading = true;
        this.error = null;
        const res = await fetch("http://localhost:4000/api/cycles/current");
        if (!res.ok) throw new Error("Failed to fetch month data");
        const cycle = await res.json();

        // Set current month from the active cycle
        this.currentMonth = cycle;
        this.currentMonthUuid = cycle?.uuid || null;

        // Also fetch all cycles for the month selector
        const allRes = await fetch("http://localhost:4000/api/cycles");
        if (allRes.ok) {
          this.months = await allRes.json();
        }

        // Fetch lifetime score
        const profileRes = await fetch("http://localhost:4000/api/cycles/profile");
        if (profileRes.ok) {
          const profile = await profileRes.json();
          this.lifetimeScore = profile.lifetimeScore || 0;
        }

        // Server does not compute progress fields; recompute locally to avoid stale/reset values.
        if (this.currentMonth) this.updateProgressValues();
        this.isLoading = false;
      } catch (error) {
        this.error =
          error instanceof Error ? error.message : "Unknown error occurred";
        this.isLoading = false;
      }
    },

    async setCurrentMonth(uuid: string) {
      try {
        this.isLoading = true;
        const res = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "setCurrentMonth", monthUuid: uuid }),
        });
        const data = await res.json();
        if (data?.success) {
          await this.fetchMonthData();
        }
      } finally {
        this.isLoading = false;
      }
    },

    async createMonth(name?: string) {
      try {
        this.isLoading = true;
        const res = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "createMonth", name }),
        });
        const data = await res.json();
        if (data?.success) {
          await this.fetchMonthData();
        }
      } finally {
        this.isLoading = false;
      }
    },

    async finishCurrentMonth() {
      if (!this.currentMonth || this.currentMonth.finished) return;
      try {
        this.isLoading = true;
        const res = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "finishMonth",
            monthUuid: this.currentMonth.uuid,
          }),
        });
        const data = await res.json();
        if (data?.success) {
          await this.fetchMonthData();
        }
      } finally {
        this.isLoading = false;
      }
    },

    // Add a new task to a specific day via backend API
    async addTaskToBackend(month: string, week: number, task: any) {
      try {
        this.isLoading = true;
        this.error = null;
        const res = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ month, week, task }),
        });
        if (!res.ok) throw new Error("Failed to add task");
        await this.fetchMonthData();
        this.isLoading = false;
      } catch (error) {
        this.error =
          error instanceof Error ? error.message : "Unknown error occurred";
        this.isLoading = false;
      }
    },

    // Reset the current month data by refetching from backend
    async resetToOriginal() {
      await this.fetchMonthData();
    },
    bulkAddTasks(options: {
      description: string;
      optional?: boolean;
      dayUuidsByWeek: Record<string, string[]>;
      repeatWeeks?: string[];
      baseWeekUuid: string;
      recurrenceId?: string;
      persist?: boolean;
      icon?: string;
      gifUrl?: string;
    }) {
      if (!this.currentMonth || this.currentMonth.finished) return;
      const recurrenceId =
        options.recurrenceId || `rec-${Math.random().toString(36).slice(2)}`;
      const {
        description,
        optional = false,
        dayUuidsByWeek,
        persist = true,
        icon,
        gifUrl,
      } = options;
      const additions: any[] = [];
      Object.entries(dayUuidsByWeek).forEach(([weekUuid, dayUuids]) => {
        const week = this.currentMonth!.weeks.find((w) => w.uuid === weekUuid);
        if (!week) return;
        // Deduplicate day list just in case
        Array.from(new Set(dayUuids)).forEach((dayUuid) => {
          const day = week.days.find((d) => d.uuid === dayUuid);
          if (!day) return;
          // Prevent duplicate same-description task insertion within same submit run
          if (
            day.tasks.some(
              (t) =>
                t.description === description &&
                t.optional === optional &&
                (icon ? t.icon === icon : true) &&
                (gifUrl ? t.gifUrl === gifUrl : true)
            )
          ) {
            return;
          }
          const newTask: Task = {
            uuid: `t-${Math.random().toString(36).slice(2)}`,
            description,
            optional,
            completed: false,
            recurrenceId,
            order: day.tasks.length,
            icon,
            gifUrl,
          };
          day.tasks.push(newTask);
          additions.push({ weekUuid, dayUuid, task: newTask });
        });
      });
      this.updateProgressValues();
      if (persist && additions.length) {
        fetch(`http://localhost:4000/api/cycles/${this.currentMonth!.uuid}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "addTasks",
            additions,
          }),
        })
          .then((r) => r.json())
          .then((res) => {
            if (res?.month) {
              this.currentMonth = res.month;
              // Recompute progress after merging server changes.
              this.updateProgressValues();
            }
          })
          .catch((err) => console.error("Persist addTasks failed", err));
      }
    },
    updateTask(
      taskUuid: string,
      payload: Partial<Pick<Task, "description" | "optional" | "icon" | "gifUrl">>
    ) {
      if (this.currentMonth?.finished) return;
      const task = this.getTaskByUuid(taskUuid) as Task | null;
      if (!task) return;
      if (payload.description !== undefined)
        task.description = payload.description;
      if (payload.optional !== undefined) task.optional = payload.optional;
      if (payload.icon !== undefined) task.icon = payload.icon;
      if (payload.gifUrl !== undefined) task.gifUrl = payload.gifUrl;
      this.updateProgressValues();
    },
    deleteTask(taskUuid: string, scope: "single" | "recurrence" = "single") {
      if (!this.currentMonth || this.currentMonth.finished) return;
      let recurrenceId: string | undefined;
      if (scope === "recurrence") {
        const t = this.getTaskByUuid(taskUuid) as Task | null;
        recurrenceId = t?.recurrenceId;
      }
      for (const week of this.currentMonth.weeks) {
        for (const day of week.days) {
          if (scope === "single") {
            const idx = day.tasks.findIndex((t) => t.uuid === taskUuid);
            if (idx !== -1) {
              day.tasks.splice(idx, 1);
              this.updateProgressValues();
              // persist single deletion
              fetch(`http://localhost:4000/api/cycles/${this.currentMonth!.uuid}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  type: "deleteTasks",
                  taskUuids: [taskUuid],
                }),
              })
                .then((r) => r.json())
                .then((res) => {
                  if (res?.month) {
                    this.currentMonth = res.month;
                    this.updateProgressValues();
                  }
                })
                .catch((err) =>
                  console.error("Persist deleteTask failed", err)
                );
              return;
            }
          } else if (scope === "recurrence" && recurrenceId) {
            const before = day.tasks.length;
            day.tasks = day.tasks.filter(
              (t) => t.recurrenceId !== recurrenceId
            );
            if (day.tasks.length !== before) {
              // continue removing in all days
            }
          }
        }
      }
      if (scope === "recurrence") this.updateProgressValues();
      if (scope === "recurrence" && recurrenceId) {
        fetch(`http://localhost:4000/api/cycles/${this.currentMonth!.uuid}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "deleteTasks",
            recurrenceId,
          }),
        })
          .then((r) => r.json())
          .then((res) => {
            if (res?.month) {
              this.currentMonth = res.month;
              this.updateProgressValues();
            }
          })
          .catch((err) =>
            console.error("Persist delete recurrence failed", err)
          );
      }
    },
    moveTask(taskUuid: string, targetDayUuid: string, targetIndex?: number) {
      if (!this.currentMonth || this.currentMonth.finished) return;
      let movingTask: any = null;
      let sourceDay: any = null;
      let sourceWeek: any = null;
      // Locate and remove task from its current day
      for (const week of this.currentMonth.weeks) {
        for (const day of week.days) {
          const idx = day.tasks.findIndex((t) => t.uuid === taskUuid);
          if (idx !== -1) {
            movingTask = day.tasks[idx];
            sourceDay = day;
            sourceWeek = week;
            day.tasks.splice(idx, 1);
            break;
          }
        }
        if (movingTask) break;
      }
      if (!movingTask) return;
      // Find target day
      let targetDay: any = null;
      for (const week of this.currentMonth.weeks) {
        for (const day of week.days) {
          if (day.uuid === targetDayUuid) {
            targetDay = day;
            break;
          }
        }
        if (targetDay) break;
      }
      if (!targetDay) {
        // put back into source if no target found
        sourceDay.tasks.push(movingTask);
        return;
      }
      // Clamp index
      let insertAt =
        typeof targetIndex === "number" ? targetIndex : targetDay.tasks.length;
      if (insertAt < 0) insertAt = 0;
      if (insertAt > targetDay.tasks.length) insertAt = targetDay.tasks.length;
      targetDay.tasks.splice(insertAt, 0, movingTask);
      // Reassign order fields inside affected days (optional)
      [sourceDay, targetDay].forEach((d) => {
        if (!d) return;
        d.tasks.forEach((t: any, i: number) => (t.order = i));
      });
      this.updateProgressValues();
    },
  },
});
