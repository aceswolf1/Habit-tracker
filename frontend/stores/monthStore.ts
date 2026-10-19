/**
 * Pinia store for cycles. Id stays `month` so existing `useMonthStore()`
 * callers compile unchanged. ONLY HTTP-calling consumer of
 * `services/cycleApi.ts`. Pure cycle walking in `utils/cycleMutations.ts`;
 * cloning + progress in `utils/cycleCloning.ts` + `utils/cloneDay.ts`;
 * long API orchestration in `utils/cycleNetwork.ts`. App-level events
 * (`toast`, `pointsEarned`, `taskCompleted`, `strike`, `monthFinished`)
 * flow through `composables/useAppEvents.emitAppEvent`. v2.3 forwards
 * PATCH/finish `rewards` to `rewardsStore` via `utils/rewardsBridge.ts`.
 */
import { defineStore } from "pinia";
import type {
  Cycle, CycleSummary, PatchBody, Profile,
  LevelInfo, Insights,
} from "../types/index";
import { ApiError, patchCycle as apiPatchCycle } from "../services/cycleApi";
import {
  findDayByUuid, findTaskByUuid, findTaskLocation,
  moveTaskInCycle, removeRecurrenceFromDay, removeTaskFromDay,
} from "../utils/cycleMutations";
import { applyProgressToCopy, refreshProgressLocal } from "../utils/cycleCloning";
import { bulkAddTasksToCycle } from "../utils/bulkAddTasks";
import { applyTaskMetaUpdate } from "../utils/taskPayload";
import type { BulkAddTasksPayload, UpdateTaskPayload } from "../utils/taskPayloadTypes";
import { buildCloneAdditions, appendClonedTasksToCycle } from "../utils/cloneDay";
import {
  createMonthAction, fetchInsightsAction, fetchMonthDataAction,
  finishCurrentMonthAction, resetToOriginalAction, setCurrentMonthAction,
  setCycleDatesAction, updateDisplayNameAction, scheduleInsightsRefresh,
} from "../utils/cycleNetwork";
import { emitAppEvent } from "../composables/useAppEvents";
import { levelInfo as computeLevelInfo } from "../utils/sharedLevels";
import { emitLevelUpIfCrossed } from "../utils/levelUp";
import { forwardRewardsEvent } from "../utils/rewardsBridge";

// UB-12: serial PATCH queue keyed by cycleUuid.
const cycleMutationQueues: Record<string, Promise<unknown>> = {};

// W4 (UB-54): persistence-failure toast payload. The only "SAVE FAILED" in strings.
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
    // v2.2: read-only insights payload. `null` until the first
    // `fetchInsights()` resolves.
    insights: null as Insights | null,
  }),

  getters: {
    getMonth: (state): Cycle | null => state.currentMonth,
    getMonths: (state): CycleSummary[] => state.months,
    isFinished: (state): boolean => !!state.currentMonth?.finished,
    getProgress: (state): number =>
      state.currentMonth ? state.currentMonth.progress : 0,
    /** Backwards-compatible lifetimeScore accessor; components read this via storeToRefs. */
    lifetimeScore: (state): number => state.profile?.lifetimeScore ?? 0,
    /** v2.1: profile `displayName` (or `null` when unset). */
    displayName: (state): string | null => {
      const dn = state.profile?.displayName;
      return typeof dn === "string" && dn.length > 0 ? dn : null;
    },
    /** v2.1: lifetime-XP level curve. */
    levelInfo(): LevelInfo {
      return computeLevelInfo(this.lifetimeScore ?? 0);
    },
    /** v2.1: cycle start date (Monday 'YYYY-MM-DD') or `null` when undated. */
    cycleStartDate(): string | null {
      return this.currentMonth?.startDate ?? null;
    },
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
      try { await this.fetchMonthData(); }
      catch (recoveryError) {
        console.error(`Recovery after ${operation} failed`, recoveryError);
      }
      this.notifyPersistError(operation);
    },

    /**
     * UB-10 FE: apply pointsEarned when !== 0; keep lifetimeScore >= 0.
     * Floating UI may show a negative delta via the pointsEarned event.
     * v2.1: when the post-apply level rises, emit `levelUp` exactly once.
     */
    applyPointsEarned(pointsEarned: number | undefined | null,
      detail: { taskUuid?: string; tier?: string | null; isLegendary?: boolean } = {}) {
      if (pointsEarned == null || pointsEarned === 0) return;
      emitAppEvent("pointsEarned", {
        points: pointsEarned,
        taskUuid: detail.taskUuid,
        tier: detail.tier,
        isLegendary: detail.isLegendary || false,
      });
      const prev = this.profile?.lifetimeScore ?? 0;
      const next = Math.max(0, prev + pointsEarned);
      this.profile = {
        ...(this.profile ?? { uuid: "", lifetimeScore: 0 }),
        lifetimeScore: next,
      };
      emitLevelUpIfCrossed(prev, next);
    },

    /** Optimistic-action helper. Mutates `currentMonth` in place using the
     * shared progress math so we don't carry a parallel formula. */
    refreshProgressLocal(): void {
      refreshProgressLocal(this.currentMonth);
    },

    /**
     * UB-12: serial PATCH queue per cycleUuid. On failure routes through
     * `recoverFromPersistFailure`. Stale-guard drops the response when the
     * user switched cycles mid-flight.
     */
    enqueueCycleMutation(cycleUuid: string, operation: string, body: PatchBody,
      onSuccess?: (res: {
        cycle: Cycle; pointsEarned: number; isLegendary: boolean; currentTier: string;
        combo?: { taskUuid: string; combo: number; name: string | null; bonus: number };
      }) => void) {
      const run = async () => {
        try {
          const result = await apiPatchCycle(cycleUuid, body);
          if (this.currentMonth?.uuid !== cycleUuid) return result;
          this.currentMonth = applyProgressToCopy(result.cycle);
          // v2.3: forward rewards to the rewards store so the toast + vault
          // + chest badge animate. Done BEFORE `onSuccess` so handlers
          // that read `rewardsStore.rewards` see the latest state.
          forwardRewardsEvent(result.rewards);
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
        (res) => {
          this.applyPointsEarned(res.pointsEarned, {
            taskUuid,
            tier: res.currentTier,
            isLegendary: res.isLegendary,
          });
          // v2.2: emit `strike` for FloatingPoints, then refresh insights.
          if (res.combo && res.combo.combo >= 2 && res.combo.taskUuid === taskUuid) {
            emitAppEvent("strike", {
              taskUuid: res.combo.taskUuid,
              combo: res.combo.combo,
              name: res.combo.name,
              bonus: res.combo.bonus,
            });
          }
          this.scheduleInsightsRefresh();
        }
      );
    },

    bulkAddTasks(options: BulkAddTasksPayload) {
      if (!this.currentMonth || this.currentMonth.finished) return;
      const persist = options.persist !== false;
      const { additions } = bulkAddTasksToCycle(this.currentMonth, {
        description: options.description,
        optional: options.optional,
        legendary: options.legendary,
        dayUuidsByWeek: options.dayUuidsByWeek,
        icon: options.icon,
        gifUrl: options.gifUrl,
        gifVideoUrl: options.gifVideoUrl,
        gifStillUrl: options.gifStillUrl,
        notes: options.notes,
        habitId: options.habitId,
        tag: options.tag,
        durationMin: options.durationMin,
        timeOfDay: options.timeOfDay,
        dueTime: options.dueTime,
        recurrenceId: options.recurrenceId,
      });
      refreshProgressLocal(this.currentMonth);
      if (persist && additions.length) {
        this.enqueueCycleMutation(this.currentMonth.uuid, "adding habits", {
          type: "addTasks",
          additions,
        });
      }
    },

    updateTask(taskUuid: string, payload: UpdateTaskPayload) {
      if (this.currentMonth?.finished) return;
      const task = findTaskByUuid(this.currentMonth, taskUuid);
      if (!task) return;
      applyTaskMetaUpdate(task, payload as Parameters<typeof applyTaskMetaUpdate>[1]);
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
      this.enqueueCycleMutation(this.currentMonth.uuid, "habit move", {
        type: "moveTasks",
        taskUuid,
        targetDayUuid,
        targetIndex: moved.insertedAt,
      });
    },

    /** V2 A9 — Clone every task from `sourceDayUuid` into each day in
     * `targetDayUuids` via a single PATCH `addTasks`. Finished month = no-op. */
    cloneDayTasks(sourceDayUuid: string, targetDayUuids: string[]): number {
      if (!this.currentMonth || this.currentMonth.finished) return 0;
      if (!sourceDayUuid || !targetDayUuids?.length) return 0;
      const { additions } = buildCloneAdditions({
        weeks: this.currentMonth.weeks, sourceDayUuid, targetDayUuids,
      });
      if (additions.length === 0) return 0;
      appendClonedTasksToCycle(this.currentMonth.weeks, additions);
      refreshProgressLocal(this.currentMonth);
      this.enqueueCycleMutation(this.currentMonth.uuid, "cloning day", {
        type: "addTasks", additions,
      });
      const added = additions.length;
      emitAppEvent("toast", {
        type: "success",
        title: "DAY CLONED",
        message: `Synced ${added} ${added === 1 ? "task" : "tasks"} across selected days.`,
      });
      return added;
    },

    // ----- thin pass-throughs to the network helpers (`utils/cycleNetwork.ts`) -----

    async fetchMonthData() {
      await fetchMonthDataAction(this);
    },

    async setCurrentMonth(uuid: string) {
      await setCurrentMonthAction(this, uuid);
    },

    /** v2.1: create a (possibly dated) month. `startDate` MUST be a Monday
     * 'YYYY-MM-DD' or undefined; the backend rejects anything else with
     * 400 `VALIDATION_ERROR`. */
    async createMonth(name?: string, startDate?: string) {
      await createMonthAction(this, name, startDate);
    },

    /** v2.1: set or clear the start date on the CURRENT cycle. */
    async setCycleDates(startDate: string | null) {
      try {
        await setCycleDatesAction(this, startDate);
      } catch (err) {
        if (err instanceof ApiError) {
          console.error("setCycleDates failed:", err.code, err.message);
        } else {
          console.error("setCycleDates failed", err);
        }
      }
    },

    /** v2.1: PATCH the player `displayName` (or clear it with `null`). */
    async updateDisplayName(name: string | null): Promise<Profile | undefined> {
      try {
        return await updateDisplayNameAction(this, name);
      } catch (err) {
        if (err instanceof ApiError) {
          console.error("updateDisplayName failed:", err.code, err.message);
        } else {
          console.error("updateDisplayName failed", err);
        }
        return undefined;
      }
    },

    async finishCurrentMonth(): Promise<void> {
      await finishCurrentMonthAction(this);
      // v2.2: insights depend on finished-month streaks; refresh now.
      await fetchInsightsAction(this);
    },

    /** v2.2: refresh the read-only insights payload (failures swallowed). */
    async fetchInsights(): Promise<void> {
      await fetchInsightsAction(this);
    },
    /** v2.2: debounce-coalesced insights refresh (used by the toggle path). */
    scheduleInsightsRefresh() { scheduleInsightsRefresh(this); },

    async resetToOriginal() { await resetToOriginalAction(this); },
  },
});
