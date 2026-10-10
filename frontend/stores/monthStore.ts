/**
 * Pinia store for cycles. Id stays `month` so existing `useMonthStore()`
 * callers in components compile unchanged. The ONLY HTTP-calling consumer
 * of `services/cycleApi.ts`; progress math is delegated to
 * `utils/sharedProgress.ts`.
 */

import { defineStore } from "pinia";
import type {
  Cycle,
  CycleSummary,
  FinishResult,
  PatchBody,
  Profile,
  Task,
} from "../types/index";
import {
  ApiError,
  createCycle as apiCreateCycle,
  finishCycle as apiFinishCycle,
  getCycle as apiGetCycle,
  getCurrent as apiGetCurrent,
  getProfile as apiGetProfile,
  listCycles as apiListCycles,
  patchCycle as apiPatchCycle,
} from "../services/cycleApi";
import { calculateProgress } from "../utils/sharedProgress";

// UB-12: serial PATCH queue keyed by cycleUuid.
const cycleMutationQueues: Record<string, Promise<unknown>> = {};

export const useMonthStore = defineStore("month", {
  state: () => ({
    months: [] as CycleSummary[],
    currentMonth: null as Cycle | null,
    currentMonthUuid: null as string | null,
    profile: null as Profile | null,
    isLoading: false,
    error: null as string | null,
  }),

  getters: {
    getMonth: (state): Cycle | null => state.currentMonth,
    getMonths: (state): CycleSummary[] => state.months,
    isFinished: (state): boolean => !!state.currentMonth?.finished,
    getProgress: (state): number =>
      state.currentMonth ? state.currentMonth.progress : 0,
    /** Backwards-compatible lifetimeScore accessor; components read this via storeToRefs. */
    lifetimeScore: (state): number => state.profile?.lifetimeScore ?? 0,

    getWeeks: (state) => (state.currentMonth ? state.currentMonth.weeks : []),

    getWeekByUuid: (state) => (uuid: string) => {
      return state.currentMonth
        ? state.currentMonth.weeks.find((week) => week.uuid === uuid)
        : undefined;
    },

    isWeekConquered: (state) => (uuid: string) => {
      const week = state.currentMonth
        ? state.currentMonth.weeks.find((week) => week.uuid === uuid)
        : undefined;
      return week ? week.conquered || false : false;
    },

    getDayByUuid: (state) => (uuid: string) => {
      if (!state.currentMonth) return null;
      for (const week of state.currentMonth.weeks) {
        const day = week.days.find((day) => day.uuid === uuid);
        if (day) return day;
      }
      return null;
    },

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
    notifyPersistError(operation: string) {
      if (typeof window === "undefined") return;
      window.dispatchEvent(
        new CustomEvent("appToast", {
          detail: {
            type: "error",
            title: "SAVE FAILED",
            message: `Could not save ${operation}. Restored latest data.`,
          },
        })
      );
    },

    async recoverFromPersistFailure(operation: string) {
      try {
        await this.fetchMonthData();
      } catch (recoveryError) {
        console.error(`Recovery after ${operation} failed`, recoveryError);
      }
      this.notifyPersistError(operation);
    },

    /**
     * UB-10 FE: apply pointsEarned when !== 0; keep lifetimeScore >= 0.
     * Floating UI may still show a negative delta via the pointsEarned event.
     */
    applyPointsEarned(
      pointsEarned: number | undefined | null,
      detail: {
        taskUuid?: string;
        tier?: string | null;
        isLegendary?: boolean;
      } = {}
    ) {
      if (pointsEarned == null || pointsEarned === 0) return;
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("pointsEarned", {
            detail: {
              points: pointsEarned,
              taskUuid: detail.taskUuid,
              tier: detail.tier,
              isLegendary: detail.isLegendary || false,
            },
          })
        );
      }
      const current = this.profile?.lifetimeScore ?? 0;
      const next = Math.max(0, current + pointsEarned);
      this.profile = {
        ...(this.profile ?? { uuid: "", lifetimeScore: 0 }),
        lifetimeScore: next,
      };
    },

    /**
     * Apply the SHARED `calculateProgress` to a deep copy of `cycle` and
     * return the copy. Refresh paths (fetch / setCurrentMonth / finish / PATCH
     * success) use this so we never mutate state directly in place.
     */
    applyProgressToCopy(cycle: Cycle): Cycle {
      const copy =
        typeof structuredClone === "function"
          ? (structuredClone(cycle) as Cycle)
          : (JSON.parse(JSON.stringify(cycle)) as Cycle);
      calculateProgress(copy);
      return copy;
    },

    /**
     * Optimistic-action helper. Mutates `currentMonth` in place after a local
     * task change, but uses the SHARED progress module for the math so we
     * don't carry a parallel formula in the store.
     */
    refreshProgressLocal() {
      if (this.currentMonth) calculateProgress(this.currentMonth);
    },

    /**
     * UB-12: serial PATCH queue per cycleUuid. On failure routes through
     * recoverFromPersistFailure (refetch + appToast). Stale-guard drops
     * the response if the user switched cycles mid-flight.
     */
    enqueueCycleMutation(
      cycleUuid: string,
      operation: string,
      body: PatchBody,
      onSuccess?: (res: { cycle: Cycle; pointsEarned: number; isLegendary: boolean; currentTier: string }) => void
    ) {
      const run = async () => {
        try {
          const result = await apiPatchCycle(cycleUuid, body);
          if (this.currentMonth?.uuid !== cycleUuid) return result;
          this.currentMonth = this.applyProgressToCopy(result.cycle);
          if (onSuccess) onSuccess(result);
          return result;
        } catch (err) {
          if (err instanceof ApiError) {
            console.error(`Persist ${operation} failed:`, err.code, err.message);
          } else {
            console.error(`Persist ${operation} failed`, err);
          }
          await this.recoverFromPersistFailure(operation);
          return null;
        }
      };
      const prev = cycleMutationQueues[cycleUuid] || Promise.resolve();
      const next = prev.then(run, run);
      // Keep the chain unbroken even if an inner mutation recovers/rejects.
      cycleMutationQueues[cycleUuid] = next.then(
        () => undefined,
        () => undefined
      );
      return next;
    },

    toggleTaskCompletion(taskUuid: string) {
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
            task.completed = newStatus;
            taskToggled = true;
            this.refreshProgressLocal();

            // Emit particle burst event if completing (not uncompleting).
            if (newStatus) {
              window.dispatchEvent(
                new CustomEvent("taskCompleted", {
                  detail: {
                    taskUuid: taskUuid,
                    taskType: task.optional ? "optional" : "required",
                    tier: null,
                    isLegendary: task.legendary || false,
                  },
                })
              );
            }

            this.enqueueCycleMutation(
              this.currentMonth!.uuid,
              "task toggle",
              {
                type: "updateTasks",
                updates: [{ uuid: task.uuid, completed: task.completed }],
              },
              (res) => {
                this.applyPointsEarned(res.pointsEarned, {
                  taskUuid,
                  tier: res.currentTier,
                  isLegendary: res.isLegendary,
                });
              }
            );
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

    bulkAddTasks(options: {
      description: string;
      optional?: boolean;
      legendary?: boolean;
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
        options.recurrenceId ||
        `rec-${Math.random().toString(36).slice(2)}`;
      const {
        description,
        optional = false,
        legendary = false,
        dayUuidsByWeek,
        persist = true,
        icon,
        gifUrl,
      } = options;
      const additions: Extract<PatchBody, { type: "addTasks" }>["additions"] = [];
      Object.entries(dayUuidsByWeek).forEach(([weekUuid, dayUuids]) => {
        const week = this.currentMonth!.weeks.find((w) => w.uuid === weekUuid);
        if (!week) return;
        Array.from(new Set(dayUuids)).forEach((dayUuid) => {
          const day = week.days.find((d) => d.uuid === dayUuid);
          if (!day) return;
          // Prevent duplicate insertion within the same submit run.
          if (
            day.tasks.some(
              (t) =>
                t.description === description &&
                t.optional === optional &&
                t.legendary === legendary &&
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
            legendary,
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
      this.refreshProgressLocal();
      if (persist && additions.length) {
        this.enqueueCycleMutation(
          this.currentMonth!.uuid,
          "adding habits",
          { type: "addTasks", additions }
        );
      }
    },

    updateTask(
      taskUuid: string,
      payload: Partial<
        Pick<
          Task,
          | "description"
          | "optional"
          | "legendary"
          | "icon"
          | "gifUrl"
        >
      >
    ) {
      if (this.currentMonth?.finished) return;
      const task = this.getTaskByUuid(taskUuid) as Task | null;
      if (!task) return;
      if (payload.description !== undefined) task.description = payload.description;
      if (payload.optional !== undefined) task.optional = payload.optional;
      if (payload.legendary !== undefined) task.legendary = payload.legendary;
      if (payload.icon !== undefined) task.icon = payload.icon;
      if (payload.gifUrl !== undefined) task.gifUrl = payload.gifUrl;
      this.refreshProgressLocal();

      this.enqueueCycleMutation(this.currentMonth!.uuid, "habit update", {
        type: "updateTasks",
        updates: [{ uuid: taskUuid, ...payload }],
      });
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
              this.refreshProgressLocal();
              this.enqueueCycleMutation(
                this.currentMonth!.uuid,
                "habit delete",
                { type: "deleteTasks", taskUuids: [taskUuid] }
              );
              return;
            }
          } else if (scope === "recurrence" && recurrenceId) {
            const before = day.tasks.length;
            day.tasks = day.tasks.filter(
              (t) => t.recurrenceId !== recurrenceId
            );
            // continue removing in remaining days
            void before;
          }
        }
      }
      if (scope === "recurrence") this.refreshProgressLocal();
      if (scope === "recurrence" && recurrenceId) {
        this.enqueueCycleMutation(
          this.currentMonth!.uuid,
          "recurring habit delete",
          { type: "deleteTasks", recurrenceId }
        );
      }
    },

    moveTask(taskUuid: string, targetDayUuid: string, targetIndex?: number) {
      if (!this.currentMonth || this.currentMonth.finished) return;
      let movingTask: Task | null = null;
      let sourceDay: { tasks: Task[] } | null = null;
      for (const week of this.currentMonth.weeks) {
        for (const day of week.days) {
          const idx = day.tasks.findIndex((t) => t.uuid === taskUuid);
          if (idx !== -1) {
            movingTask = day.tasks[idx];
            sourceDay = day;
            day.tasks.splice(idx, 1);
            break;
          }
        }
        if (movingTask) break;
      }
      if (!movingTask || !sourceDay) return;

      let targetDay: { tasks: Task[] } | null = null;
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
        (sourceDay as { tasks: Task[] }).tasks.push(movingTask);
        return;
      }
      const td = targetDay as { tasks: Task[] };
      let insertAt =
        typeof targetIndex === "number" ? targetIndex : td.tasks.length;
      if (insertAt < 0) insertAt = 0;
      if (insertAt > td.tasks.length) insertAt = td.tasks.length;
      td.tasks.splice(insertAt, 0, movingTask);
      // Reassign `order` fields for an optimistic UI.
      [sourceDay, targetDay].forEach((d) => {
        if (!d) return;
        d.tasks.forEach((t, i) => {
          t.order = i;
        });
      });
      this.refreshProgressLocal();

      this.enqueueCycleMutation(this.currentMonth!.uuid, "habit move", {
        type: "moveTasks",
        taskUuid,
        targetDayUuid,
        targetIndex: insertAt,
      });
    },

    /** Legacy local-only `addTask` was removed in W2b — `bulkAddTasks` is the only
     * supported create path (and the only one known to TaskModal). */

    async fetchMonthData() {
      this.isLoading = true;
      this.error = null;
      try {
        const list = await apiListCycles();
        this.months = list.summaries;

        try {
          this.profile = await apiGetProfile();
        } catch (err) {
          if (err instanceof ApiError) {
            console.error("Profile fetch failed:", err.code, err.message);
          } else {
            console.error("Profile fetch failed", err);
          }
          this.profile = null;
        }

        let currentCycle: Cycle | null = null;
        const firstUnfinished = this.months.find((m) => !m.finished);
        const candidateUuid = firstUnfinished?.uuid || this.months[0]?.uuid;
        if (candidateUuid) {
          try {
            currentCycle = await apiGetCycle(candidateUuid);
          } catch (err) {
            console.error("Cycle fetch failed", err);
          }
        }
        if (!currentCycle) {
          // Auto-create via /current (contract §3).
          try {
            currentCycle = await apiGetCurrent();
          } catch (err) {
            console.error("Auto-create current failed", err);
          }
          // Refresh summaries so the new cycle shows up in the selector.
          try {
            const refresh = await apiListCycles();
            this.months = refresh.summaries;
          } catch {
            /* keep prior summaries */
          }
        }
        if (currentCycle) {
          this.currentMonth = this.applyProgressToCopy(currentCycle);
          this.currentMonthUuid = currentCycle.uuid;
        }
      } catch (err) {
        this.error =
          err instanceof Error ? err.message : "Unknown error occurred";
      } finally {
        this.isLoading = false;
      }
    },

    /**
     * Switch to a different cycle by loading its full payload via `getCycle`
     * (contract §3 GET /:id). Summaries are refreshed in the background so
     * the month switcher updates.
     */
    async setCurrentMonth(uuid: string) {
      this.isLoading = true;
      this.error = null;
      try {
        const cycle = await apiGetCycle(uuid);
        this.currentMonth = this.applyProgressToCopy(cycle);
        this.currentMonthUuid = uuid;
        apiListCycles()
          .then((res) => {
            this.months = res.summaries;
          })
          .catch(() => {
            /* selector keep current */
          });
      } catch (err) {
        if (err instanceof ApiError) {
          console.error("Month not found with uuid:", uuid, err.code, err.message);
        } else {
          console.error("Month not found with uuid:", uuid, err);
        }
        this.error = err instanceof Error ? err.message : "Unknown error";
      } finally {
        this.isLoading = false;
      }
    },

    async createMonth(name?: string) {
      this.isLoading = true;
      this.error = null;
      try {
        const cycle = await apiCreateCycle(name);
        this.currentMonth = this.applyProgressToCopy(cycle);
        this.currentMonthUuid = cycle.uuid;
        const refresh = await apiListCycles();
        this.months = refresh.summaries;
      } catch (err) {
        this.error =
          err instanceof Error ? err.message : "Unknown error occurred";
      } finally {
        this.isLoading = false;
      }
    },

    async finishCurrentMonth(): Promise<FinishResult | undefined> {
      if (!this.currentMonth || this.currentMonth.finished) return undefined;
      this.isLoading = true;
      try {
        const result = await apiFinishCycle(this.currentMonth.uuid);
        this.currentMonth = this.applyProgressToCopy(result.cycle);
        try {
          const refresh = await apiListCycles();
          this.months = refresh.summaries;
        } catch {
          /* keep prior summaries */
        }
        return result;
      } catch (err) {
        console.error("Error finishing month:", err);
        this.error =
          err instanceof Error ? err.message : "Failed to finish month";
        return undefined;
      } finally {
        this.isLoading = false;
      }
    },

    async resetToOriginal() {
      await this.fetchMonthData();
    },
  },
});
