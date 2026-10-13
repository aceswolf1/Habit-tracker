<!--
  TaskModalFields.vue (W1 restyle).
  Pure V2 form fields used inside the TaskModal create/edit dialog.
  Owns description + notes (free-form memo, ≤ 280 chars) + optional +
  legendary flag toggles. Visual type / GIF picker / day scope / Move-to
  remain in their own subcomponents so this file stays small.

  Layout: each field uses the V2 terminal input shape (sharp 1px border
  on `--pp-line`, cyan focus border, mono body, cyan text, uppercase
  label). Flags use the cyan/magenta colorways.
-->
<template>
  <div class="task-modal-fields">
    <!-- Description -->
    <label class="tm-field">
      <span class="tm-label">DESCRIPTION</span>
      <input
        v-model.trim="descriptionLocal"
        type="text"
        class="tm-input"
        placeholder="Enter quest details…"
        required
        :autofocus="autofocus"
      />
    </label>

    <!-- Notes (V2 A8) — optional free-form memo, ≤ 280 chars. -->
    <label class="tm-field">
      <div class="tm-label-row">
        <span>NOTES <span class="tm-sub">(OPTIONAL)</span></span>
        <span
          class="tm-counter font-mono"
          :class="notesLocal.length > 260 ? 'tm-counter--warn' : ''"
        >{{ notesLocal.length }}/280</span>
      </div>
      <textarea
        v-model="notesLocal"
        class="tm-input tm-textarea"
        rows="3"
        maxlength="280"
        placeholder="Memo, link, or reminder for this quest…"
      />
    </label>

    <!-- Flags: Optional + Legendary -->
    <div class="tm-flags">
      <label class="tm-flag tm-flag--optional">
        <input
          v-model="optionalLocal"
          type="checkbox"
          class="tm-flag__native sr-only"
        />
        <span class="tm-flag__box" aria-hidden="true">
          <span v-if="optionalLocal">✓</span>
        </span>
        <span class="tm-flag__label">OPTIONAL SIDE QUEST</span>
      </label>

      <label class="tm-flag tm-flag--legendary">
        <input
          v-model="legendaryLocal"
          type="checkbox"
          class="tm-flag__native sr-only"
        />
        <span class="tm-flag__box" aria-hidden="true">
          <span v-if="legendaryLocal">★</span>
        </span>
        <span class="tm-flag__label">LEGENDARY QUEST (3X SCORE)</span>
      </label>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  description: string;
  notes: string;
  optional: boolean;
  legendary: boolean;
  autofocus?: boolean;
}>();

const emit = defineEmits<{
  "update:description": [value: string];
  "update:notes": [value: string];
  "update:optional": [value: boolean];
  "update:legendary": [value: boolean];
}>();

const descriptionLocal = computed({
  get: () => props.description,
  set: (v) => emit("update:description", v),
});
const notesLocal = computed({
  get: () => props.notes,
  set: (v) => emit("update:notes", v),
});
const optionalLocal = computed({
  get: () => props.optional,
  set: (v) => emit("update:optional", v),
});
const legendaryLocal = computed({
  get: () => props.legendary,
  set: (v) => emit("update:legendary", v),
});
</script>

<style scoped>
.task-modal-fields {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.tm-field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.tm-label {
  font-family: "JetBrains Mono", ui-monospace, monospace;
  font-weight: 700;
  font-size: 0.7rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--pp-cyan);
}

.tm-label-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-family: "JetBrains Mono", ui-monospace, monospace;
  font-weight: 700;
  font-size: 0.7rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--pp-cyan);
}

.tm-sub {
  color: var(--pp-muted);
  font-weight: 500;
  letter-spacing: 0.08em;
  margin-left: 0.25rem;
}

.tm-counter {
  font-size: 0.65rem;
  color: var(--pp-muted);
  letter-spacing: 0.08em;
  text-transform: none;
}

.tm-counter--warn {
  color: var(--pp-danger);
}

.tm-input {
  font-family: "JetBrains Mono", ui-monospace, monospace;
  font-size: 0.875rem;
  color: var(--pp-text);
  background: var(--pp-panel);
  border: 1px solid var(--pp-line);
  padding: 0.75rem;
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
  width: 100%;
}

.tm-input:focus,
.tm-input:focus-visible {
  border-color: var(--pp-cyan);
  box-shadow: 0 0 0 1px var(--pp-cyan);
}

.tm-textarea {
  resize: vertical;
  min-height: 4.5rem;
}

.tm-flags {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.25rem;
}

.tm-flag {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  cursor: pointer;
  font-family: "JetBrains Mono", ui-monospace, monospace;
  font-weight: 700;
  font-size: 0.7rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--pp-text);
  user-select: none;
}

.tm-flag__box {
  width: 1.25rem;
  height: 1.25rem;
  border: 1px solid var(--pp-line);
  background: var(--pp-panel);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  color: var(--pp-text);
  transition: background-color 0.15s ease, border-color 0.15s ease,
    color 0.15s ease;
}

.tm-flag__native:focus-visible + .tm-flag__box {
  outline: 2px solid var(--pp-cyan);
  outline-offset: 2px;
}

.tm-flag--optional .tm-flag__box {
  border-color: var(--pp-cyan);
  color: var(--pp-cyan);
}

.tm-flag--optional:has(.tm-flag__native:checked) .tm-flag__box {
  background: var(--pp-cyan);
  color: var(--pp-void);
}

.tm-flag--legendary .tm-flag__box {
  border-color: var(--pp-magenta);
  color: var(--pp-magenta);
}

.tm-flag--legendary:has(.tm-flag__native:checked) .tm-flag__box {
  background: var(--pp-magenta);
  color: var(--pp-void);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>