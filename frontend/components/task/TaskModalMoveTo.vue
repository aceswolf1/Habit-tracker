<!--
  TaskModalMoveTo.vue (W1 restyle, V2 Combat Deck).

  Edit-mode only "Move to…" control inside TaskModal. Two cascading
  selects (week → day) and a MOVE button that emits the chosen
  `{ weekUuid, dayUuid }`. Hidden when `finished` is true. The parent
  (TaskModal.vue) performs the actual `store.moveTask(...)` call, fires
  a toast on success via `emitAppEvent('toast', …)`, and closes the
  modal.

  V2 styling: cyan/magenta accent, sharp borders, mono body.
-->
<template>
  <div
    v-if="isEdit && !finished"
    class="mmove"
  >
    <div class="mmove-title font-mono">MOVE TO…</div>
    <div class="mmove-grid">
      <label class="mmove-field">
        <span class="mmove-label font-mono">WEEK</span>
        <select
          v-model="selectedWeek"
          class="mmove-select font-mono"
          aria-label="Target week"
        >
          <option v-for="w in weeks" :key="w.uuid" :value="w.uuid">
            {{ w.label }}
          </option>
        </select>
      </label>
      <label class="mmove-field">
        <span class="mmove-label font-mono">DAY</span>
        <select
          v-model="selectedDay"
          class="mmove-select font-mono"
          aria-label="Target day"
          :disabled="daysOfSelectedWeek.length === 0"
        >
          <option v-for="d in daysOfSelectedWeek" :key="d.uuid" :value="d.uuid">
            {{ d.name }}
          </option>
        </select>
      </label>
    </div>
    <button
      type="button"
      class="mmove-submit font-mono"
      :disabled="!canMove"
      @click="emitMove"
    >MOVE</button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useMonthStore } from "../../stores/monthStore";

const props = defineProps<{
  /** Rendered only inside the edit-mode modal. */
  isEdit: boolean;
  /** Hide the picker when the current cycle is finished. */
  finished: boolean;
  /** Week uuid from the modal context (the week the edit was opened on). */
  currentWeekUuid: string | null;
  /**
   * Optional initial day uuid — the day the edited task currently lives
   * on. If omitted (e.g. opening from the "+" button without a day
   * preselected), the picker falls back to the first day of the chosen
   * week.
   */
  initialDayUuid?: string | null;
}>();

const emit = defineEmits<{
  /** Parent (TaskModal.vue) wires this to `store.moveTask(uuid, dayUuid)`. */
  move: [{ weekUuid: string; dayUuid: string }];
}>();

const store = useMonthStore();

const weeks = computed(() =>
  !store.currentMonth
    ? []
    : store.currentMonth.weeks.map((w, i) => ({
        uuid: w.uuid,
        label: w.name || `Week ${i + 1}`,
      })),
);

const daysOfSelectedWeek = computed<Array<{ uuid: string; name: string }>>(() => {
  if (!store.currentMonth) return [];
  const w = store.currentMonth.weeks.find((ww) => ww.uuid === selectedWeek.value);
  if (!w) return [];
  return w.days.map((d) => ({ uuid: d.uuid, name: d.name }));
});

const selectedWeek = ref<string>(
  props.currentWeekUuid || (weeks.value[0]?.uuid ?? ""),
);
const selectedDay = ref<string>(
  props.initialDayUuid || (daysOfSelectedWeek.value[0]?.uuid ?? ""),
);

// Whenever the week changes, if the previously-selected day is no longer
// present (e.g. different week has different days), pick the first day of
// the new week.
watch(selectedWeek, () => {
  const days = daysOfSelectedWeek.value;
  if (!days.find((d) => d.uuid === selectedDay.value)) {
    selectedDay.value = days[0]?.uuid ?? "";
  }
});

const canMove = computed(() => !!selectedWeek.value && !!selectedDay.value);

function emitMove() {
  if (!canMove.value) return;
  emit("move", { weekUuid: selectedWeek.value, dayUuid: selectedDay.value });
}
</script>

<style scoped>
.mmove {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  border: 1px dashed var(--pp-line);
  background: rgb(var(--pp-void-rgb) / 0.6);
  padding: 0.75rem;
}

.mmove-title {
  font-size: 0.7rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--pp-magenta);
  font-weight: 700;
}

.mmove-grid {
  display: flex;
  gap: 0.5rem;
}

.mmove-field {
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: 0.25rem;
}

.mmove-label {
  font-size: 0.65rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--pp-cyan);
  font-weight: 700;
}

.mmove-select {
  font-family: "JetBrains Mono", ui-monospace, monospace;
  font-size: 0.75rem;
  background: var(--pp-panel);
  color: var(--pp-text);
  border: 1px solid var(--pp-line);
  padding: 0.55rem 0.6rem;
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.mmove-select:focus,
.mmove-select:focus-visible {
  border-color: var(--pp-cyan);
  box-shadow: 0 0 0 1px var(--pp-cyan);
}

.mmove-select:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.mmove-submit {
  font-family: "JetBrains Mono", ui-monospace, monospace;
  font-weight: 700;
  font-size: 0.75rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  background: var(--pp-cyan);
  color: var(--pp-void);
  border: 1px solid var(--pp-cyan);
  padding: 0.65rem;
  cursor: pointer;
  transition: background-color 0.15s ease;
  min-height: 40px;
}

.mmove-submit:hover:not(:disabled) {
  background: rgb(var(--pp-cyan-rgb) / 0.85);
}

.mmove-submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>