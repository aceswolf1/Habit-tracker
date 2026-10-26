<!--
  TaskLabelsField.vue — custom labels (e.g. HEALTH, WORK) for a task.

  - Chips for the current labels, each with a remove button.
  - Text input: Enter or comma adds; Backspace on an empty input removes the
    last chip. Labels are normalized like the API (shared/labels.js).
  - Suggestions: labels already used this month that aren't on the task yet.
  - Max MAX_LABELS labels per task.
-->
<template>
  <fieldset class="tl-field">
    <legend class="tl-label font-mono">
      LABELS <span class="tl-sub">({{ modelValue.length }}/{{ MAX_LABELS }})</span>
    </legend>

    <div class="tl-box" @click="inputEl?.focus()">
      <span
        v-for="label in modelValue"
        :key="label"
        class="tl-chip font-mono"
        :class="`pp-label-hue-${labelColorIndex(label)}`"
      >
        {{ label }}
        <button
          type="button"
          class="tl-remove"
          :aria-label="`Remove label ${label}`"
          @click.stop="remove(label)"
        >×</button>
      </span>
      <input
        v-if="modelValue.length < MAX_LABELS"
        ref="inputEl"
        v-model="draft"
        type="text"
        class="tl-input font-mono"
        :maxlength="MAX_LABEL_LENGTH"
        :placeholder="modelValue.length ? '' : 'e.g. HEALTH, WORK — Enter to add'"
        aria-label="Add a label"
        @keydown.enter.prevent="commit"
        @keydown.backspace="onBackspace"
        @input="onInput"
        @blur="commit"
      />
    </div>

    <div v-if="visibleSuggestions.length" class="tl-suggest" aria-label="Label suggestions">
      <button
        v-for="label in visibleSuggestions"
        :key="label"
        type="button"
        class="tl-chip tl-chip--suggest font-mono"
        :class="`pp-label-hue-${labelColorIndex(label)}`"
        @click="add(label)"
      >+ {{ label }}</button>
    </div>
  </fieldset>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import {
  MAX_LABELS,
  MAX_LABEL_LENGTH,
  labelColorIndex,
  normalizeLabel,
  normalizeLabels,
} from "../../utils/sharedLabels";

const props = defineProps<{
  modelValue: string[];
  /** Labels used elsewhere this month. */
  suggestions?: string[];
}>();
const emit = defineEmits<{ "update:modelValue": [value: string[]] }>();

const draft = ref("");
const inputEl = ref<HTMLInputElement | null>(null);

const visibleSuggestions = computed(() => {
  if (props.modelValue.length >= MAX_LABELS) return [];
  const typed = normalizeLabel(draft.value);
  return (props.suggestions || [])
    .filter((s) => !props.modelValue.includes(s))
    .filter((s) => !typed || s.includes(typed))
    .slice(0, 8);
});

function add(raw: string) {
  const next = normalizeLabels([...props.modelValue, raw]);
  if (next.length !== props.modelValue.length) emit("update:modelValue", next);
  draft.value = "";
}
function commit() {
  if (normalizeLabel(draft.value)) add(draft.value);
}
function remove(label: string) {
  emit("update:modelValue", props.modelValue.filter((l) => l !== label));
}
function onBackspace() {
  if (!draft.value && props.modelValue.length) remove(props.modelValue[props.modelValue.length - 1]);
}
// A comma acts like Enter so "health, work" adds two labels.
function onInput() {
  if (!draft.value.includes(",")) return;
  const parts = draft.value.split(",");
  draft.value = parts.pop() || "";
  const next = normalizeLabels([...props.modelValue, ...parts]);
  if (next.length !== props.modelValue.length) emit("update:modelValue", next);
}
</script>

<style scoped>
.tl-field { display: flex; flex-direction: column; gap: 0.35rem; border: 0; padding: 0; margin: 0; }
.tl-label { color: var(--pp-cyan); font-size: 10px; font-weight: 700; letter-spacing: 0.1em; }
.tl-sub { color: var(--pp-muted); }
.tl-box {
  display: flex; flex-wrap: wrap; align-items: center; gap: 0.35rem;
  min-height: 40px; padding: 0.35rem 0.5rem;
  background: var(--pp-panel); border: 1px solid var(--pp-line); cursor: text;
}
.tl-box:focus-within { border-color: var(--pp-cyan); }
.tl-input {
  flex: 1 1 8rem; min-width: 6rem; background: transparent; border: 0; outline: none;
  color: var(--pp-text); font-size: 12px; text-transform: uppercase;
}
.tl-chip {
  display: inline-flex; align-items: center; gap: 0.3rem;
  padding: 0.1rem 0.4rem; font-size: 10px; font-weight: 700; letter-spacing: 0.08em;
  border: 1px solid currentColor; background: rgb(var(--tl-rgb, 110 127 157) / 0.12);
}
.tl-chip--suggest { cursor: pointer; opacity: 0.8; background: transparent; }
.tl-chip--suggest:hover { opacity: 1; }
.tl-remove { background: none; border: 0; color: inherit; cursor: pointer; font-size: 12px; line-height: 1; padding: 0 0.1rem; }
.tl-suggest { display: flex; flex-wrap: wrap; gap: 0.35rem; }
</style>
