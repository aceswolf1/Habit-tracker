<!--
  TaskModal.vue (W4 split, UB-55).
  Thin orchestrator. The visual picker (Emoji + GIF) lives in
  `components/task/TaskModalVisualPicker.vue`, and the week/day/recurrence
  selectors live in `components/task/TaskModalDayScope.vue`. Form state,
  submit, and the create/edit decision stay here. App-level error toasts
  go through `useAppEvents.emitAppEvent('toast', …)` (UB-54).
-->
<template>
  <Transition name="modal-bounce">
    <div v-if="open" class="fixed inset-0 flex items-center justify-center z-50">
      <div class="absolute inset-0 bg-black/70 backdrop-blur-sm" @click="close"></div>
      <div
        class="task-modal-sheet relative bg-pixel-dark border-4 border-black p-6 w-full max-w-lg shadow-pixel transform transition-all"
      >
        <h2 class="font-press text-white text-base mb-6 text-center border-b-4 border-black pb-4">
          {{ isEdit ? "EDIT QUEST" : "NEW QUEST" }}
        </h2>

        <form @submit.prevent="submit">
          <!-- Description -->
          <label
            class="block mb-5 text-white font-press text-xs tracking-wide"
            >DESCRIPTION
            <input
              v-model.trim="form.description"
              class="mt-2 w-full bg-gray-800 text-white p-3 border-2 border-black font-mono text-sm focus:outline-none focus:border-blue-500 transition-colors"
              placeholder="Enter quest details..."
              required
              autoFocus
            />
          </label>

          <!-- Visual type + emoji/gif picker subcomponent -->
          <TaskModalVisualPicker
            v-model:visualType="form.visualType"
            v-model:icon="form.icon"
            v-model:gifUrl="form.gifUrl"
            :description="form.description"
          />

          <!-- Optional Flag -->
          <label
            class="flex items-center gap-3 mb-5 text-white font-press text-xs cursor-pointer group"
          >
            <div class="relative">
              <input type="checkbox" v-model="form.optional" class="peer sr-only" />
              <div class="w-5 h-5 border-2 border-white bg-gray-800 peer-checked:bg-blue-500 transition-colors"></div>
              <div class="absolute inset-0 flex items-center justify-center text-white opacity-0 peer-checked:opacity-100 pointer-events-none">✓</div>
            </div>
            <span class="group-hover:text-blue-400 transition-colors">OPTIONAL SIDE QUEST</span>
          </label>

          <!-- Legendary Flag -->
          <label
            class="flex items-center gap-3 mb-5 text-white font-press text-xs cursor-pointer group"
          >
            <div class="relative">
              <input type="checkbox" v-model="form.legendary" class="peer sr-only" />
              <div class="w-5 h-5 border-2 border-purple-500 bg-gray-800 peer-checked:bg-purple-600 transition-colors"></div>
              <div class="absolute inset-0 flex items-center justify-center text-white opacity-0 peer-checked:opacity-100 pointer-events-none">⭐</div>
            </div>
            <span class="group-hover:text-purple-400 transition-colors">LEGENDARY QUEST (3X SCORE)</span>
          </label>

          <!-- Day/week/recurrence selector subcomponent -->
          <TaskModalDayScope
            v-model:weekScope="form.weekScope"
            v-model:repeatAcrossWeeks="form.repeatAcrossWeeks"
            v-model:selectedDayUuids="selectedDayUuids"
            v-model:selectedWeekUuids="selectedWeekUuids"
            v-model:editScope="editScope"
            :weekUuid="weekUuid"
            :showDaySelector="showDaySelector"
            :isEdit="isEdit"
            :hasRecurrence="hasRecurrence"
          />

          <!-- Edit-mode-only Move-to control (B-T2) -->
          <TaskModalMoveTo
            :isEdit="isEdit"
            :finished="isCycleFinished"
            :currentWeekUuid="weekUuid"
            :initialDayUuid="currentDayUuid"
            @move="onMoveTo"
          />

          <!-- Actions -->
          <div class="flex justify-between mt-8 pt-4 border-t-4 border-black">
            <button
              type="button"
              @click="close"
              class="font-press text-xs px-4 py-3 bg-gray-600 border-2 border-black text-white hover:bg-gray-500 hover:scale-105 transition-all shadow-[4px_4px_0_rgba(0,0,0,0.5)] active:shadow-none active:translate-x-[2px] active:translate-y-[2px]"
            >
              CANCEL
            </button>
            <div class="flex gap-3">
              <button
                v-if="isEdit"
                type="button"
                @click="emitDelete"
                class="font-press text-xs px-4 py-3 bg-red-600 border-2 border-black text-white hover:bg-red-500 hover:scale-105 transition-all shadow-[4px_4px_0_rgba(0,0,0,0.5)] active:shadow-none active:translate-x-[2px] active:translate-y-[2px]"
              >
                DELETE
              </button>
              <button
                type="submit"
                class="font-press text-xs px-4 py-3 bg-blue-600 border-2 border-black text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-500 hover:scale-105 transition-all shadow-[4px_4px_0_rgba(0,0,0,0.5)] active:shadow-none active:translate-x-[2px] active:translate-y-[2px]"
                :disabled="isSubmitting"
              >
                {{ isEdit ? "SAVE QUEST" : "START QUEST" }}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { useMonthStore } from "../stores/monthStore";
import { emitAppEvent } from "../composables/useAppEvents";
import { buildDaySelection, type WeekScope } from "../utils/cycleRecurrence";
import TaskModalVisualPicker from "./task/TaskModalVisualPicker.vue";
import TaskModalDayScope from "./task/TaskModalDayScope.vue";
import TaskModalMoveTo from "./task/TaskModalMoveTo.vue";

const props = defineProps<{
  open: boolean;
  weekUuid: string | null;
  editTaskUuid?: string | null;
  prefillDayUuid?: string | null;
}>();
const emit = defineEmits(["close", "created", "updated", "deleted"]);

const store = useMonthStore();

// UB-40: surface synchronous task-mutation failures via `emitAppEvent('toast', …)`
// (same envelope as `monthStore.notifyPersistError`) and keep the modal open so
// the user can retry or adjust instead of silently losing the form.
function notifyError(title: string, message: string) {
  emitAppEvent("toast", { type: "error", title, message });
}

// Base form state
const form = reactive({
  description: "",
  optional: false,
  legendary: false,
  weekScope: "single" as WeekScope,
  repeatAcrossWeeks: false,
  icon: "" as string,
  visualType: "emoji" as "emoji" | "gif",
  gifUrl: "" as string,
});

const isSubmitting = ref(false);

const selectedDayUuids = ref<string[]>([]);
const selectedWeekUuids = ref<string[]>([]); // weeks beyond base week
const editScope = ref<"single" | "recurrence">("single");

const isEdit = computed(() => !!props.editTaskUuid);
const editingTask = computed(() =>
  props.editTaskUuid ? store.getTaskByUuid(props.editTaskUuid) : null,
);
const hasRecurrence = computed(
  () => !!(editingTask.value as any)?.recurrenceId,
);

const baseWeek = computed(() =>
  store.currentMonth?.weeks.find((w) => w.uuid === props.weekUuid),
);

/** Currently-edited task lives on this day (B-T2: Move-to preselect). */
const currentDayUuid = computed<string | null>(() => {
  if (!isEdit.value || !editingTask.value || !store.currentMonth) return null;
  for (const week of store.currentMonth.weeks) {
    for (const day of week.days) {
      if (day.tasks.some((t) => t.uuid === editingTask.value!.uuid)) {
        return day.uuid;
      }
    }
  }
  return null;
});

/** Cycle-finished flag drives the W4b "hide Move-to on finished months" rule. */
const isCycleFinished = computed(() => !!store.currentMonth?.finished);

const showDaySelector = computed(() => {
  if (form.weekScope === "all") return false;
  if (props.prefillDayUuid && form.weekScope === "single") return false;
  return true;
});

watch(
  () => form.weekScope,
  (newScope) => {
    if (newScope === "single" && selectedDayUuids.value.length > 1) {
      // If switching to single, keep only the first selected day
      selectedDayUuids.value = [selectedDayUuids.value[0]];
    }
  },
);

watch(
  () => props.open,
  (o) => {
    if (o) {
      isSubmitting.value = false;
      if (isEdit.value && editingTask.value) {
        form.description = (editingTask.value as any).description;
        form.optional = (editingTask.value as any).optional;
        form.legendary = (editingTask.value as any).legendary || false;
        form.icon = (editingTask.value as any).icon || "";
        form.gifUrl = (editingTask.value as any).gifUrl || "";
        form.visualType = (editingTask.value as any).gifUrl ? "gif" : "emoji";
      } else {
        resetForm();
        if (props.prefillDayUuid) {
          form.weekScope = "single";
          selectedDayUuids.value = [props.prefillDayUuid];
        }
      }
    }
  },
);

function resetForm() {
  form.description = "";
  form.optional = false;
  form.legendary = false;
  form.weekScope = "single";
  form.repeatAcrossWeeks = false;
  form.icon = "";
  form.visualType = "emoji";
  form.gifUrl = "";
  selectedDayUuids.value = [];
  selectedWeekUuids.value = [];
  editScope.value = "single";
  isSubmitting.value = false;
}

function submit() {
  if (isSubmitting.value) return; // guard double clicks / enter
  if (!form.description) return;
  if (!props.weekUuid) return;

  // Auto-select first day if 'single' scope and no day selected (collect from store)
  if (form.weekScope === "single" && selectedDayUuids.value.length === 0 && baseWeek.value && baseWeek.value.days.length > 0) {
    selectedDayUuids.value = [baseWeek.value.days[0].uuid];
  }

  let valid = false;
  if (form.weekScope === "all") {
    valid = !!(baseWeek.value && baseWeek.value.days.length > 0);
  } else if (form.weekScope === "multiple") {
    valid = selectedDayUuids.value.length > 0;
  } else {
    valid = selectedDayUuids.value.length > 0;
  }
  if (!valid) return;

  isSubmitting.value = true;

  try {
    if (!isEdit.value) {
      const dayUuidsByWeek = buildDaySelection({
        weekUuid: props.weekUuid,
        weekScope: form.weekScope,
        selectedDayUuids: selectedDayUuids.value,
        selectedWeekUuids: selectedWeekUuids.value,
        baseWeek: baseWeek.value,
        weeks: store.currentMonth?.weeks ?? [],
      });
      store.bulkAddTasks({
        description: form.description,
        optional: form.optional,
        legendary: form.legendary,
        dayUuidsByWeek,
        baseWeekUuid: props.weekUuid,
        icon: form.icon || undefined,
        gifUrl: form.gifUrl || undefined,
      });
      emit("created");
    } else if (editingTask.value) {
      // FIX-01: in edit mode, an empty visual field means "clear it
      // server-side" → send `null`. `undefined` would mean "leave it",
      // which is wrong when the user has just toggled visualType.
      const iconPayload = form.icon ? form.icon : null;
      const gifUrlPayload = form.gifUrl ? form.gifUrl : null;
      store.updateTask((editingTask.value as any).uuid, {
        description: form.description,
        optional: form.optional,
        legendary: form.legendary,
        icon: iconPayload,
        gifUrl: gifUrlPayload,
      });
      emit("updated");
    }
    close();
  } catch (e) {
    console.error(e);
    // Keep modal open and surface the failure to the user via appToast
    notifyError(
      isEdit.value ? "UPDATE FAILED" : "CREATE FAILED",
      isEdit.value
        ? "Could not save quest changes. Please retry."
        : "Could not create quest. Please retry.",
    );
    isSubmitting.value = false;
  }
}

function emitDelete() {
  if (!editingTask.value) return;
  try {
    store.deleteTask((editingTask.value as any).uuid, editScope.value);
    emit("deleted");
    close();
  } catch (e) {
    console.error(e);
    // UB-40: keep modal open on delete failure; surface via toast
    notifyError("DELETE FAILED", "Could not remove quest. Please retry.");
    isSubmitting.value = false;
  }
}

/**
 * B-T2: handle the "Move to…" subcomponent's emit. The store appends the
 * task to the target day (no explicit index → append). On success, we
 * emit a toast and close the modal just like SAVE / DELETE.
 */
function onMoveTo(payload: { weekUuid: string; dayUuid: string }) {
  if (!editingTask.value) return;
  if (isSubmitting.value) return;
  isSubmitting.value = true;
  try {
    store.moveTask((editingTask.value as any).uuid, payload.dayUuid);
    const labelDay = store.currentMonth?.weeks
      .find((w) => w.uuid === payload.weekUuid)
      ?.days.find((d) => d.uuid === payload.dayUuid);
    const labelWeek = store.currentMonth?.weeks.find(
      (w) => w.uuid === payload.weekUuid,
    );
    const dayName = labelDay?.name ?? "another day";
    const weekName = labelWeek?.name ?? "";
    emitAppEvent("toast", {
      type: "success",
      title: "QUEST MOVED",
      message: `Moved to ${dayName}${weekName ? ` (${weekName})` : ""}.`,
    });
    emit("updated");
    close();
  } catch (e) {
    console.error(e);
    notifyError("MOVE FAILED", "Could not move quest. Please retry.");
    isSubmitting.value = false;
  }
}

function close() {
  isSubmitting.value = false;
  emit("close");
}
</script>

<style scoped src="./task/TaskModal.styles.scss"></style>
