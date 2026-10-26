<!--
  TaskModalDetails.vue (v2.1, contract §5).

  The v2.1 task-detail fields mounted inside `TaskModal.vue` between
  `TaskModalFields.vue` (description + notes + flags) and the visual
  picker. Keeps `TaskModalFields.vue` small (description-only) so the
  whole dialog tree stays ≤ 400 lines.

  Fields (each is a `v-model` pair on the parent form):
    - tag          chip group with a "NONE" pill and one chip per
                   entry in `TAGS` (`common | rare | essential | defense`).
                   Contract §1 / §5.
    - durationMin  minutes input (1..1440). Edit-mode renders the
                   value, and a "Clear" button to send `null`.
    - timeOfDay    chip group ("NONE" + `morning | afternoon | evening |
                   night`).
    - dueTime      `<input type="time">` (HH:MM). Empty = clear.

  All four fields use the same null-vs-undefined semantics as the
  rest of the dialog (v2.1 contract §3 / §5):
    - in create mode the parent only sends values when set;
    - in edit mode the parent sends `null` to clear an existing value.

  Layout: each field is a labeled stack with the V2 terminal look
  (cyan mono label, sharp 1px line border, mono body). Chip groups use
  the same border + active wash pattern as the existing flags
  (cyan/magenta) but with each chip's own accent.
-->
<template>
  <div class="task-modal-details">
    <!-- Custom labels (HEALTH, WORK, …) -->
    <TaskLabelsField
      :modelValue="labels"
      :suggestions="labelSuggestions"
      @update:modelValue="(v) => emit('update:labels', v)"
    />

    <!-- Tag -->
    <fieldset class="td-field">
      <legend class="td-label font-mono">TAG</legend>
      <div class="td-chip-row" role="radiogroup" aria-label="Tag">
        <button
          type="button"
          class="td-chip font-mono"
          :class="chipClasses(tag === null)"
          :aria-pressed="tag === null"
          @click="onTag(null)"
        >NONE</button>
        <button
          v-for="t in TAGS"
          :key="t"
          type="button"
          class="td-chip font-mono"
          :class="chipClasses(tag === t)"
          :aria-pressed="tag === t"
          @click="onTag(t)"
        >{{ labelFor(t) }}</button>
      </div>
    </fieldset>

    <!-- Duration -->
    <fieldset class="td-field">
      <div class="td-label-row font-mono">
        <legend>DURATION <span class="td-sub">(MINUTES, 1–1440)</span></legend>
        <button
          v-if="hasDuration"
          type="button"
          class="td-clear font-mono"
          @click="emit('update:durationMin', null)"
        >CLEAR</button>
      </div>
      <input
        type="number"
        inputmode="numeric"
        min="1"
        max="1440"
        step="1"
        class="td-input font-mono"
        :value="durationMin ?? ''"
        placeholder="—"
        @input="onDurationInput"
      />
    </fieldset>

    <!-- Time of day -->
    <fieldset class="td-field">
      <legend class="td-label font-mono">TIME OF DAY</legend>
      <div class="td-chip-row" role="radiogroup" aria-label="Time of day">
        <button
          type="button"
          class="td-chip font-mono"
          :class="chipClasses(timeOfDay === null)"
          :aria-pressed="timeOfDay === null"
          @click="emit('update:timeOfDay', null)"
        >NONE</button>
        <button
          v-for="tod in TIMES_OF_DAY"
          :key="tod"
          type="button"
          class="td-chip font-mono"
          :class="chipClasses(timeOfDay === tod)"
          :aria-pressed="timeOfDay === tod"
          @click="emit('update:timeOfDay', tod)"
        >{{ labelFor(tod) }}</button>
      </div>
    </fieldset>

    <!-- Due time (only when the cycle has a startDate, contract §5) -->
    <fieldset v-if="showDueTime" class="td-field">
      <div class="td-label-row font-mono">
        <legend>DUE TIME</legend>
        <button
          v-if="hasDueTime"
          type="button"
          class="td-clear font-mono"
          @click="emit('update:dueTime', null)"
        >CLEAR</button>
      </div>
      <input
        type="time"
        class="td-input font-mono"
        :value="dueTime ?? ''"
        @input="onDueTimeInput"
      />
    </fieldset>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import TaskLabelsField from "./TaskLabelsField.vue";
import {
  TAGS,
  TIMES_OF_DAY,
} from "../../utils/sharedTaskMeta";
import type { TaskTag, TaskTimeOfDay } from "../../types/index";

const props = defineProps<{
  tag: TaskTag | null;
  durationMin: number | null;
  timeOfDay: TaskTimeOfDay | null;
  dueTime: string | null;
  /** Hide the due-time field when the active cycle has no startDate. */
  showDueTime: boolean;
  /** Custom labels and suggestions (labels used elsewhere this month). */
  labels: string[];
  labelSuggestions?: string[];
}>();

const emit = defineEmits<{
  "update:tag": [value: TaskTag | null];
  "update:durationMin": [value: number | null];
  "update:timeOfDay": [value: TaskTimeOfDay | null];
  "update:dueTime": [value: string | null];
  "update:labels": [value: string[]];
}>();

const hasDuration = computed(() => props.durationMin !== null);
const hasDueTime = computed(() => !!props.dueTime);

function onTag(v: TaskTag | null) {
  emit("update:tag", v);
}

function onDurationInput(e: Event) {
  const raw = (e.target as HTMLInputElement).value.trim();
  if (raw === "") {
    emit("update:durationMin", null);
    return;
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) return;
  // Clamp to the contract range; zod re-validates on the server.
  const clamped = Math.max(1, Math.min(1440, Math.round(n)));
  emit("update:durationMin", clamped);
}

function onDueTimeInput(e: Event) {
  const raw = (e.target as HTMLInputElement).value;
  if (raw === "") {
    emit("update:dueTime", null);
    return;
  }
  // `<input type=time>` returns "HH:MM" already.
  emit("update:dueTime", raw);
}

/**
 * Chip active class — sharp 1px border in the chip's accent color with
 * a low-opacity wash and inverted text. Inactive = 1px line border,
 * muted text. Same pattern as `tm-flag` in TaskModalFields.vue.
 */
function chipClasses(active: boolean): string {
  const base =
    "px-2.5 py-1 text-[11px] tracking-[0.12em] uppercase transition-colors border";
  return active
    ? `${base} bg-pp-cyan text-pp-void border-pp-cyan`
    : `${base} bg-pp-panel text-pp-muted border-pp-line hover:text-pp-text hover:border-pp-cyan`;
}

function labelFor(value: string): string {
  return value.toUpperCase();
}
</script>

<style scoped>
.task-modal-details {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.td-field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  border: 0;
  padding: 0;
  margin: 0;
}

.td-label,
.td-label-row legend {
  font-weight: 700;
  font-size: 0.7rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--pp-cyan);
}

.td-label-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
}

.td-sub {
  color: var(--pp-muted);
  font-weight: 500;
  letter-spacing: 0.08em;
  margin-left: 0.25rem;
}

.td-clear {
  background: transparent;
  border: 1px solid var(--pp-line);
  color: var(--pp-muted);
  padding: 0.15rem 0.5rem;
  font-size: 0.6rem;
  letter-spacing: 0.12em;
  cursor: pointer;
  transition: color 0.15s ease, border-color 0.15s ease;
}
.td-clear:hover,
.td-clear:focus-visible {
  color: var(--pp-cyan);
  border-color: var(--pp-cyan);
  outline: none;
}

.td-chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.td-input {
  font-size: 0.875rem;
  color: var(--pp-text);
  background: var(--pp-panel);
  border: 1px solid var(--pp-line);
  padding: 0.65rem 0.75rem;
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
  width: 100%;
}

.td-input:focus,
.td-input:focus-visible {
  border-color: var(--pp-cyan);
  box-shadow: 0 0 0 1px var(--pp-cyan);
}
</style>