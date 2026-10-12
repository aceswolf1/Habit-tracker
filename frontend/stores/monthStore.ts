/**
 * Pinia store for cycles. Id stays `month` so existing `useMonthStore()`
 * callers in components compile unchanged. The ONLY HTTP-calling consumer
 * of `services/cycleApi.ts`. Pure cycle walking + Task construction lives
 * in `utils/cycleMutations.ts` + `utils/taskFactory.ts`; cloning + progress
 * math lives in `utils/cycleCloning.ts`; long API orchestration lives in
 * `utils/cycleNetwork.ts`. App-level events (`toast`, `pointsEarned`,
 * `taskCompleted`) flow through `composables/useAppEvents.emitAppEvent`.
 *
 * W4 contract: public action names + signatures, getter names, and the
 * state shape are unchanged. Components compile without edits.
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
  patchCycle as apiPatchCycle,
} from "../services/cycleApi";
import {
  findDayByUuid,
  findTaskByUuid,
  findTaskLocation,
  findWeekByUuid,
  moveTaskInCycle,
  removeRecurrenceFromDay,
  removeTaskFromDay,
} from "../utils/cycleMutations";
import {
  createTaskDraft,
  generateRecurrenceId,
  isSameAddPayload,
} from "../utils/taskFactory";
import {
  applyProgressToCopy,
  refreshProgressLocal,
} from "../utils/cycleCloning";
import {
  createMonthAction,
  fetchMonthDataAction,
  finishCurrentMonthAction,
  resetToOriginalAction,
  setCurrentMonthAction,
} from "../utils/cycleNetwork";
import { emitAppEvent } from "../composables/useAppEvents";

// UB-12: serial PATCH queue keyed by cycleUuid.
const cycleMutationQueues: Record<string, Promise<unknown>> = {};

// W4 (UB-54): persistence-failure toast payload. Kept module-local because
// the title is the only place "SAVE FAILED" appears in user-visible strings.
function persistErrorToast(operation: string) {
  return {
    type: "error" as const,
    title: "SAVE FAILED",
    message: `Could not save ${operation}. Restored latest data.`,
  };
}

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
    getWeekByUuid: (state) => (uuid: string) =>
      state.currentMonth ? findWeekByUuid(state.currentMonth, uuid) ?? undefined : undefined,
    isWeekConquered: (state) => (uuid: string) => {
      const week = state.currentMonth ? findWeekByUuid(state.currentMonth, uuid) : null;
      return week ? week.conquered || false : false;
    },
    getDayByUuid: (state) => (uuid: string) =>
      state.currentMonth ? findDayByUuid(state.currentMonth, uuid) : null,
    getTaskByUuid: (state) => (uuid: string) =>
      state.currentMonth ? findTaskByUuid(state.currentMonth, uuid) : null,
  },

  actions: {
    notifyPersistError(operation: string) {
      emitAppEvent("toast", persistErrorToast(operation));
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
      detail: { taskUuid?: string; tier?: string | null; isLegendary?: boolean } = {}
    ) {
      if (pointsEarned == null || pointsEarned === 0) return;
      emitAppEvent("pointsEarned", {
        points: pointsEarned,
        taskUuid: detail.taskUuid,
        tier: detail.tier,
        isLegendary: detail.isLegendary || false,
      });
      const next = Math.max(0, (this.profile?.lifetimeScore ?? 0) + pointsEarned);
      this.profile = {
        ...(this.profile ?? { uuid: "", lifetimeScore: 0 }),
        lifetimeScore: next,
      };
    },

    /**
     * Optimistic-action helper. Mutates `currentMonth` in place using the
     * shared progress math so we don't carry a parallel formula in the store.
     */
    refreshProgressLocal() {
      refreshProgressLocal(this.currentMonth);
    },

    /**
     * UB-12: serial PATCH queue per cycleUuid. On failure routes through
     * `recoverFromPersistFailure` (refetch + toast). Stale-guard drops
     * the response if the user switched cycles mid-flight.
     */
    enqueueCycleMutation(
      cycleUuid: string,
      operation: string,
      body: PatchBody,
      onSuccess?: (res: {
        cycle: Cycle;
        pointsEarned: number;
        isLegendary: boolean;
        currentTier: string;
      }) => void
    ) {
      const run = async () => {
        try {
          const result = await apiPatchCycle(cycleUuid, body);
          if (this.currentMonth?.uuid !== cycleUuid) return result;
          this.currentMonth = applyProgressToCopy(result.cycle);
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
      if (!this.currentMonth || this.currentMonth.finished) return;
      const loc = findTaskLocation(this.currentMonth, taskUuid);
      if (!loc) {
        console.error(`Task with UUID ${taskUuid} not found!`);
        return;
      }
      const newStatus = !loc.task.completed;
      loc.task.completed = newStatus;
      refreshProgressLocal(this.currentMonth);

      // Emit particle burst event if completing (not uncompleting).
      if (newStatus) {
        emitAppEvent("taskCompleted", {
          taskUuid,
          taskType: loc.task.optional ? "optional" : "required",
          tier: null,
          isLegendary: loc.task.legendary || false,
        });
      }

      this.enqueueCycleMutation(
        this.currentMonth.uuid,
        "task toggle",
        { type: "updateTasks", updates: [{ uuid: taskUuid, completed: newStatus }] },
        (res) =>
          this.applyPointsEarned(res.pointsEarned, {
            taskUuid,
            tier: res.currentTier,
            isLegendary: res.isLegendary,
          })
      );
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
      const {
        description,
        optional = false,
        legendary = false,
        dayUuidsByWeek,
        persist = true,
        icon,
        gifUrl,
      } = options;
      const recurrenceId = options.recurrenceId || generateRecurrenceId();
      const additions: Extract<PatchBody, { type: "addTasks" }>["additions"] = [];
      Object.entries(dayUuidsByWeek).forEach(([weekUuid, dayUuids]) => {
        const week = findWeekByUuid(this.currentMonth!, weekUuid);
        if (!week) return;
        Array.from(new Set(dayUuids)).forEach((dayUuid) => {
          const day = week.days.find((d) => d.uuid === dayUuid);
          if (!day) return;
          // Prevent duplicate insertion within the same submit run.
          if (
            day.tasks.some((t) =>
              isSameAddPayload(t, { description, optional, legendary, icon, gifUrl })
            )
          ) {
            return;
          }
          const newTask = createTaskDraft({
            description,
            optional,
            legendary,
            icon,
            gifUrl,
            recurrenceId,
            order: day.tasks.length,
          });
          day.tasks.push(newTask);
          additions.push({ weekUuid, dayUuid, task: newTask });
        });
      });
      refreshProgressLocal(this.currentMonth);
      if (persist && additions.length) {
        this.enqueueCycleMutation(this.currentMonth.uuid, "adding habits", {
          type: "addTasks",
          additions,
        });
      }
    },

    updateTask(
      taskUuid: string,
      // FIX-01: `icon` / `gifUrl` accept `null` to clear the field
      // server-side; `undefined` keeps the existing value.
      payload: {
        description?: string;
        optional?: boolean;
        legendary?: boolean;
        icon?: string | null;
        gifUrl?: string | null;
      }
    ) {
      if (this.currentMonth?.finished) return;
      const task = findTaskByUuid(this.currentMonth, taskUuid);
      if (!task) return;
      if (payload.description !== undefined) task.description = payload.description;
      if (payload.optional !== undefined) task.optional = payload.optional;
      if (payload.legendary !== undefined) task.legendary = payload.legendary;
      // `!== undefined` covers null + string (set/clear); strict undefined = no-op.
      if (payload.icon !== undefined) task.icon = payload.icon as Task["icon"];
      if (payload.gifUrl !== undefined) task.gifUrl = payload.gifUrl as Task["gifUrl"];
      refreshProgressLocal(this.currentMonth);

      this.enqueueCycleMutation(this.currentMonth.uuid, "habit update", {
        type: "updateTasks",
        updates: [{ uuid: taskUuid, ...payload }],
      });
    },

    deleteTask(taskUuid: string, scope: "single" | "recurrence" = "single") {
      if (!this.currentMonth || this.currentMonth.finished) return;
      if (scope === "single") {
        for (const week of this.currentMonth.weeks) {
          for (const day of week.days) {
            if (removeTaskFromDay(day, taskUuid)) {
              refreshProgressLocal(this.currentMonth);
              this.enqueueCycleMutation(this.currentMonth.uuid, "habit delete", {
                type: "deleteTasks",
                taskUuids: [taskUuid],
              });
              return;
            }
          }
        }
        return;
      }
      // scope === "recurrence"
      const recurrenceId = findTaskByUuid(this.currentMonth, taskUuid)?.recurrenceId;
      if (!recurrenceId) return;
      for (const week of this.currentMonth.weeks) {
        for (const day of week.days) {
          removeRecurrenceFromDay(day, recurrenceId);
        }
      }
      refreshProgressLocal(this.currentMonth);
      this.enqueueCycleMutation(this.currentMonth.uuid, "recurring habit delete", {
        type: "deleteTasks",
        recurrenceId,
      });
    },

    moveTask(taskUuid: string, targetDayUuid: string, targetIndex?: number) {
      if (!this.currentMonth || this.currentMonth.finished) return;
      const moved = moveTaskInCycle(
        this.currentMonth,
        taskUuid,
        targetDayUuid,
        targetIndex
      );
      if (!moved) return;
      refreshProgressLocal(this.currentMonth);
      // `moved.insertedAt` reflects any clamping the helper applied.
      this.enqueueCycleMutation(this.currentMonth.uuid, "habit move", {
        type: "moveTasks",
        taskUuid,
        targetDayUuid,
        targetIndex: moved.insertedAt,
      });
    },

    /** Legacy local-only `addTask` was removed in W2b — `bulkAddTasks` is the only
     * supported create path (and the only one known to TaskModal). */

    // ----- thin pass-throughs to the network helpers (`utils/cycleNetwork.ts`) -----

    async fetchMonthData() {
      await fetchMonthDataAction(this);
    },

    async setCurrentMonth(uuid: string) {
      await setCurrentMonthAction(this, uuid);
    },

    async createMonth(name?: string) {
      await createMonthAction(this, name);
    },

    async finishCurrentMonth(): Promise<FinishResult | undefined> {
      return finishCurrentMonthAction(this);
    },

    async resetToOriginal() {
      await resetToOriginalAction(this);
    },
  },
});
