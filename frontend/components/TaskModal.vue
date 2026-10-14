<!--
  TaskModal.vue (W1 restyle + v2.1 task details).

  Thin orchestrator for the create/edit quest dialog. Form fields are
  extracted into `TaskModalFields.vue` (description + notes + flags) and
  `TaskModalDetails.vue` (v2.1 tag / duration / time of day / due time).
  The visual picker, day/week/recurrence selectors, and the edit-mode
  Move-to control each live in their own subcomponent. The form state,
  submit, and the create/edit decision stay here.

  V2 styling: cyan title, sharp 1px `--pp-line` borders, JetBrains Mono
  body, Space Grotesk title. Static transitions only. Honors reduced
  motion.
-->
<template>
  <Transition name="modal-bounce">
    <div v-if="open" class="task-modal-root">
      <div class="task-modal-scrim" @click="close"></div>

      <div class="task-modal-sheet" role="dialog" aria-modal="true">
        <header class="task-modal-header">
          <span class="task-modal-title">
            {{ isEdit ? "EDIT QUEST" : "NEW QUEST" }}
          </span>
          <button
            type="button"
            class="task-modal-close"
            aria-label="Close"
            @click="close"
          >✕</button>
        </header>

        <form class="task-modal-form" @submit.prevent="submit">
          <TaskModalFields
            v-model:description="form.description"
            v-model:notes="form.notes"
            v-model:optional="form.optional"
            v-model:legendary="form.legendary"
            :autofocus="true"
          />

          <!-- v2.1 task details (contract §5). -->
          <TaskModalDetails
            v-model:tag="form.tag"
            v-model:durationMin="form.durationMin"
            v-model:timeOfDay="form.timeOfDay"
            v-model:dueTime="form.dueTime"
            :showDueTime="showDueTime"
          />

          <!-- Visual type + emoji/gif picker subcomponent -->
          <TaskModalVisualPicker
            v-model:visualType="form.visualType"
            v-model:icon="form.icon"
            v-model:gifUrl="form.gifUrl"
            v-model:gifVideoUrl="form.gifVideoUrl"
            v-model:gifStillUrl="form.gifStillUrl"
            :description="form.description"
          />

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
          <footer class="task-modal-footer">
            <button
              type="button"
              class="task-btn task-btn--ghost"
              @click="close"
            >CANCEL</button>
            <div class="task-modal-footer__right">
              <button
                v-if="isEdit"
                type="button"
                class="task-btn task-btn--danger"
                @click="emitDelete"
              >DELETE</button>
              <button
                type="submit"
                class="task-btn task-btn--primary"
                :disabled="isSubmitting"
              >{{ isEdit ? "SAVE QUEST" : "START QUEST" }}</button>
            </div>
          </footer>
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
import type { TaskTag, TaskTimeOfDay } from "../types/index";
import TaskModalFields from "./task/TaskModalFields.vue";
import TaskModalDetails from "./task/TaskModalDetails.vue";
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

// UB-40: surface synchronous task-mutation failures via a toast and keep the modal open.
function notifyError(title: string, message: string) {
  emitAppEvent("toast", { type: "error", title, message });
}

// Form state (notes/visual come from V2 A8; tag/durationMin/timeOfDay/dueTime from v2.1 contract §5).
const form = reactive({
  description: "",
  optional: false,
  legendary: false,
  weekScope: "single" as WeekScope,
  repeatAcrossWeeks: false,
  icon: "",
  visualType: "emoji" as "emoji" | "gif",
  gifUrl: "",
  gifVideoUrl: "",
  gifStillUrl: "",
  notes: "",
  tag: null as TaskTag | null,
  durationMin: null as number | null,
  timeOfDay: null as TaskTimeOfDay | null,
  dueTime: null as string | null,
});

// Hide due-time when the cycle has no startDate (contract §5).
const showDueTime = computed(() => !!store.currentMonth?.startDate);

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

// Day uuid that currently holds the edited task (B-T2 Move-to preselect).
const currentDayUuid = computed<string | null>(() => {
  if (!isEdit.value || !editingTask.value || !store.currentMonth) return null;
  const target = editingTask.value.uuid;
  for (const week of store.currentMonth.weeks) {
    for (const day of week.days) {
      if (day.tasks.some((t) => t.uuid === target)) return day.uuid;
    }
  }
  return null;
});

// Hide Move-to on finished months (W4b).
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
    if (!o) return;
    isSubmitting.value = false;
    if (isEdit.value && editingTask.value) {
      const t = editingTask.value;
      form.description = t.description;
      form.optional = t.optional;
      form.legendary = t.legendary || false;
      form.icon = t.icon || "";
      form.gifUrl = t.gifUrl || "";
      form.gifVideoUrl = t.gifVideoUrl || "";
      form.gifStillUrl = t.gifStillUrl || "";
      form.visualType = t.gifUrl ? "gif" : "emoji";
      form.notes = t.notes || "";
      // v2.1: coerce missing fields to null so pickers show "NONE".
      form.tag = t.tag ?? null;
      form.durationMin = t.durationMin ?? null;
      form.timeOfDay = t.timeOfDay ?? null;
      form.dueTime = t.dueTime ?? null;
    } else {
      resetForm();
      if (props.prefillDayUuid) {
        form.weekScope = "single";
        selectedDayUuids.value = [props.prefillDayUuid];
      }
    }
  },
);

function resetForm() {
  Object.assign(form, {
    description: "",
    optional: false,
    legendary: false,
    weekScope: "single" as WeekScope,
    repeatAcrossWeeks: false,
    icon: "",
    visualType: "emoji" as "emoji" | "gif",
    gifUrl: "",
    gifVideoUrl: "",
    gifStillUrl: "",
    notes: "",
    tag: null as TaskTag | null,
    durationMin: null as number | null,
    timeOfDay: null as TaskTimeOfDay | null,
    dueTime: null as string | null,
  });
  selectedDayUuids.value = [];
  selectedWeekUuids.value = [];
  editScope.value = "single";
  isSubmitting.value = false;
}

function submit() {
  if (isSubmitting.value) return;
  if (!form.description) return;
  if (!props.weekUuid) return;

  // Auto-pick first day if 'single' and nothing selected.
  if (
    form.weekScope === "single" &&
    selectedDayUuids.value.length === 0 &&
    baseWeek.value &&
    baseWeek.value.days.length > 0
  ) {
    selectedDayUuids.value = [baseWeek.value.days[0].uuid];
  }

  const valid =
    form.weekScope === "all"
      ? !!(baseWeek.value && baseWeek.value.days.length > 0)
      : selectedDayUuids.value.length > 0;
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
      // Create: only forward fields when set; omit keeps the server default.
      store.bulkAddTasks({
        description: form.description,
        optional: form.optional,
        legendary: form.legendary,
        dayUuidsByWeek,
        baseWeekUuid: props.weekUuid,
        icon: form.icon || undefined,
        gifUrl: form.gifUrl || undefined,
        gifVideoUrl: form.gifUrl ? form.gifVideoUrl || undefined : undefined,
        gifStillUrl: form.gifUrl ? form.gifStillUrl || undefined : undefined,
        notes: form.notes || undefined,
        tag: form.tag ?? undefined,
        durationMin: form.durationMin ?? undefined,
        timeOfDay: form.timeOfDay ?? undefined,
        dueTime: form.dueTime ?? undefined,
      });
      emit("created");
    } else if (editingTask.value) {
      // Edit: send `null` to clear, never `undefined` (FIX-01 / V2 A8 / v2.1 §3).
      store.updateTask(editingTask.value.uuid, {
        description: form.description,
        optional: form.optional,
        legendary: form.legendary,
        icon: form.icon || null,
        gifUrl: form.gifUrl || null,
        gifVideoUrl: form.gifUrl && form.gifVideoUrl ? form.gifVideoUrl : null,
        gifStillUrl: form.gifUrl && form.gifStillUrl ? form.gifStillUrl : null,
        notes: form.notes || null,
        tag: form.tag,
        durationMin: form.durationMin,
        timeOfDay: form.timeOfDay,
        dueTime: form.dueTime,
      });
      emit("updated");
    }
    close();
  } catch (e) {
    console.error(e);
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