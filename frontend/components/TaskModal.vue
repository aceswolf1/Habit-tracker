<!--
  TaskModal.vue (W1 restyle, V2 Combat Deck).

  Thin orchestrator for the create/edit quest dialog. Form fields are
  extracted into `TaskModalFields.vue`. The visual picker (emoji + GIF),
  the week/day/recurrence selectors, and the edit-mode Move-to control
  each live in their own subcomponent. The form state, submit, and the
  create/edit decision stay here.

  V2 styling: cyan title, sharp 1px `--pp-line` borders, JetBrains Mono
  body, Space Grotesk title, no legacy arcade fonts. Static
  transitions only (no animated glows). Honors reduced motion.
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
import TaskModalFields from "./task/TaskModalFields.vue";
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
// and keep the modal open so the user can retry instead of silently losing the form.
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
  gifVideoUrl: "" as string,
  gifStillUrl: "" as string,
  // V2 A8: optional free-form memo (≤ 280 chars). Empty string means
  // "no notes" — `submit()` translates that to `null` on edit PATCHes
  // so the server clears the field.
  notes: "",
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
        form.gifVideoUrl = (editingTask.value as any).gifVideoUrl || "";
        form.gifStillUrl = (editingTask.value as any).gifStillUrl || "";
        form.visualType = (editingTask.value as any).gifUrl ? "gif" : "emoji";
        // V2 A8: load the saved notes (may be undefined for older tasks).
        form.notes = (editingTask.value as any).notes || "";
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
  form.gifVideoUrl = "";
  form.gifStillUrl = "";
  form.notes = "";
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
        gifVideoUrl: form.gifUrl ? form.gifVideoUrl || undefined : undefined,
        gifStillUrl: form.gifUrl ? form.gifStillUrl || undefined : undefined,
        // V2 A8: only attach notes when the user typed something;
        // omitting keeps addTasks tasks notes-less by default.
        notes: form.notes || undefined,
      });
      emit("created");
    } else if (editingTask.value) {
      // FIX-01: in edit mode, an empty visual field means "clear it
      // server-side" → send `null`. `undefined` would mean "leave it",
      // which is wrong when the user has just toggled visualType.
      // V2 A8 extends the same null-clear semantics to `notes`.
      const iconPayload = form.icon ? form.icon : null;
      const gifUrlPayload = form.gifUrl ? form.gifUrl : null;
      const notesPayload = form.notes ? form.notes : null;
      store.updateTask((editingTask.value as any).uuid, {
        description: form.description,
        optional: form.optional,
        legendary: form.legendary,
        icon: iconPayload,
        gifUrl: gifUrlPayload,
        // W5: renditions follow gifUrl; cleared together when the GIF is.
        gifVideoUrl: form.gifUrl && form.gifVideoUrl ? form.gifVideoUrl : null,
        gifStillUrl: form.gifUrl && form.gifStillUrl ? form.gifStillUrl : null,
        notes: notesPayload,
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