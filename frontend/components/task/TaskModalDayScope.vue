<!--
  TaskModalDayScope.vue (W1 restyle, V2 Combat Deck).

  Owns the "APPLY TO (THIS WEEK)" radio, the day-of-week chip grid,
  the "REPEAT IN OTHER WEEKS" section, and (when editing a recurring
  task) the "EDIT SCOPE" radio. Source-of-truth for the selections
  lives in the parent TaskModal (it bubbles back via
  v-model:selectedDayUuids and v-model:selectedWeekUuids); this
  component owns only the toggle UX.

  V2 styling: cyan amber amber-day chips, sharp 1px borders, no pixel
  font, no animated glows.
-->
<template>
  <!-- Scope inside week -->
  <div class="dscope">
    <div class="dscope-label">APPLY TO (THIS WEEK)</div>
    <div class="dscope-types font-mono">
      <label class="dscope-type">
        <input type="radio" value="single" v-model="weekScopeLocal" />
        <span>SINGLE DAY</span>
      </label>
      <label class="dscope-type">
        <input type="radio" value="multiple" v-model="weekScopeLocal" />
        <span>SELECTED DAYS</span>
      </label>
      <label class="dscope-type">
        <input type="radio" value="all" v-model="weekScopeLocal" />
        <span>ALL DAYS</span>
      </label>
    </div>

    <div v-if="showDaySelector" class="dscope-days">
      <button
        v-for="d in weekDays"
        :key="d.uuid"
        type="button"
        :class="[
          'dscope-day font-mono',
          selectedDayUuids.includes(d.uuid) ? 'dscope-day--on' : '',
        ]"
        @click="toggleDay(d.uuid)"
      >{{ d.short }}</button>
    </div>

    <!-- Recurrence across weeks -->
    <div class="dscope-recurrence">
      <label class="dscope-recurrence-toggle font-mono">
        <input type="checkbox" v-model="repeatAcrossWeeksLocal" />
        <span>REPEAT IN OTHER WEEKS</span>
      </label>
      <div v-if="repeatAcrossWeeks" class="dscope-recurrence-body">
        <div class="dscope-recurrence-actions font-mono">
          <button
            type="button"
            class="dscope-recurrence-btn dscope-recurrence-btn--accent"
            @click="selectAllWeeks"
          >ALL WEEKS</button>
          <button
            type="button"
            class="dscope-recurrence-btn"
            @click="selectedWeekUuidsLocal = []"
          >CLEAR</button>
        </div>
        <div class="dscope-recurrence-weeks font-mono">
          <button
            v-for="w in otherWeeks"
            :key="w.uuid"
            type="button"
            :class="[
              'dscope-week',
              selectedWeekUuids.includes(w.uuid) ? 'dscope-week--on' : '',
            ]"
            @click="toggleWeek(w.uuid)"
          >{{ w.label }}</button>
        </div>
      </div>
    </div>

    <!-- Edit recurrence scope -->
    <div v-if="isEdit && hasRecurrence">
      <div class="dscope-label dscope-label--sm">EDIT SCOPE</div>
      <div class="dscope-types font-mono">
        <label class="dscope-type">
          <input type="radio" value="single" v-model="editScopeLocal" />
          <span>THIS TASK ONLY</span>
        </label>
        <label class="dscope-type">
          <input type="radio" value="recurrence" v-model="editScopeLocal" />
          <span>ALL IN RECURRENCE</span>
        </label>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useMonthStore } from "../../stores/monthStore";
import type { DayChip, WeekScope } from "../../utils/cycleRecurrence";

const props = defineProps<{
  weekUuid: string | null;
  weekScope: WeekScope;
  selectedDayUuids: string[];
  selectedWeekUuids: string[];
  editScope: "single" | "recurrence";
  repeatAcrossWeeks: boolean;
  /** When true, day-of-week chips are shown (i.e. user hasn't selected "all"). */
  showDaySelector: boolean;
  /** Whether the modal is in edit mode (renders the recurrence scope radio). */
  isEdit: boolean;
  /** Whether the current editing task has a recurrenceId. */
  hasRecurrence: boolean;
}>();

const emit = defineEmits<{
  "update:weekScope": [value: WeekScope];
  "update:selectedDayUuids": [value: string[]];
  "update:selectedWeekUuids": [value: string[]];
  "update:editScope": [value: "single" | "recurrence"];
  "update:repeatAcrossWeeks": [value: boolean];
}>();

const store = useMonthStore();

const weekScopeLocal = computed({
  get: () => props.weekScope,
  set: (v) => emit("update:weekScope", v as WeekScope),
});
const repeatAcrossWeeksLocal = computed({
  get: () => props.repeatAcrossWeeks,
  set: (v) => emit("update:repeatAcrossWeeks", v),
});
const selectedDayUuidsLocal = computed({
  get: () => props.selectedDayUuids,
  set: (v) => emit("update:selectedDayUuids", v),
});
const selectedWeekUuidsLocal = computed({
  get: () => props.selectedWeekUuids,
  set: (v) => emit("update:selectedWeekUuids", v),
});
const editScopeLocal = computed({
  get: () => props.editScope,
  set: (v) => emit("update:editScope", v),
});

const baseWeek = computed(() =>
  store.currentMonth?.weeks.find((w) => w.uuid === props.weekUuid),
);

const weekDays = computed<DayChip[]>(() =>
  baseWeek.value
    ? baseWeek.value.days.map((d) => ({ uuid: d.uuid, short: d.name.slice(0, 2) }))
    : [],
);

const otherWeeks = computed(() =>
  !store.currentMonth
    ? []
    : store.currentMonth.weeks
        .filter((w) => w.uuid !== props.weekUuid)
        .map((w, i) => ({ uuid: w.uuid, label: w.name || `Week ${i + 1}` })),
);

function toggleDay(uuid: string) {
  if (props.weekScope === "single") {
    selectedDayUuidsLocal.value = [uuid];
  } else if (selectedDayUuidsLocal.value.includes(uuid)) {
    selectedDayUuidsLocal.value = selectedDayUuidsLocal.value.filter((id) => id !== uuid);
  } else {
    selectedDayUuidsLocal.value = [...selectedDayUuidsLocal.value, uuid];
  }
}

function toggleWeek(uuid: string) {
  if (selectedWeekUuidsLocal.value.includes(uuid)) {
    selectedWeekUuidsLocal.value = selectedWeekUuidsLocal.value.filter(
      (id) => id !== uuid,
    );
  } else {
    selectedWeekUuidsLocal.value = [...selectedWeekUuidsLocal.value, uuid];
  }
}

function selectAllWeeks() {
  selectedWeekUuidsLocal.value = otherWeeks.value.map((w) => w.uuid);
}
</script>

<style scoped>
.dscope {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.dscope-label {
  font-family: "JetBrains Mono", ui-monospace, monospace;
  font-weight: 700;
  font-size: 0.7rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--pp-cyan);
}

.dscope-label--sm {
  font-size: 0.65rem;
}

.dscope-types {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  font-size: 0.65rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.dscope-type {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  cursor: pointer;
  color: var(--pp-text);
}

.dscope-type input {
  accent-color: var(--pp-cyan);
}

.dscope-type:hover {
  color: var(--pp-amber);
}

.dscope-days {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 0.25rem;
}

.dscope-day {
  font-family: "JetBrains Mono", ui-monospace, monospace;
  font-weight: 700;
  font-size: 0.65rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  background: var(--pp-panel);
  color: var(--pp-text);
  border: 1px solid var(--pp-line);
  padding: 0.4rem 0;
  cursor: pointer;
  min-height: 36px;
  transition: color 0.15s ease, background-color 0.15s ease,
    border-color 0.15s ease;
}

.dscope-day:hover,
.dscope-day:focus-visible {
  color: var(--pp-amber);
  border-color: var(--pp-amber);
  outline: none;
}

.dscope-day--on {
  background: var(--pp-amber);
  color: var(--pp-void);
  border-color: var(--pp-amber);
}

.dscope-recurrence {
  border: 1px dashed var(--pp-line);
  background: rgb(var(--pp-void-rgb) / 0.6);
  padding: 0.75rem;
}

.dscope-recurrence-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.7rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  cursor: pointer;
  color: var(--pp-text);
}

.dscope-recurrence-toggle input {
  accent-color: var(--pp-cyan);
}

.dscope-recurrence-body {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.dscope-recurrence-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  font-size: 0.6rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.dscope-recurrence-btn {
  font-family: "JetBrains Mono", ui-monospace, monospace;
  font-weight: 700;
  font-size: 0.65rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  background: var(--pp-card);
  color: var(--pp-text);
  border: 1px solid var(--pp-line);
  padding: 0.35rem 0.6rem;
  cursor: pointer;
  transition: color 0.15s ease, border-color 0.15s ease;
}

.dscope-recurrence-btn:hover,
.dscope-recurrence-btn:focus-visible {
  color: var(--pp-cyan);
  border-color: var(--pp-cyan);
  outline: none;
}

.dscope-recurrence-btn--accent {
  color: var(--pp-cyan);
  border-color: var(--pp-cyan);
}

.dscope-recurrence-weeks {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  font-size: 0.6rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.dscope-week {
  font-family: "JetBrains Mono", ui-monospace, monospace;
  font-weight: 700;
  font-size: 0.65rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  background: var(--pp-card);
  color: var(--pp-text);
  border: 1px solid var(--pp-line);
  padding: 0.35rem 0.55rem;
  cursor: pointer;
  transition: color 0.15s ease, background-color 0.15s ease,
    border-color 0.15s ease;
}

.dscope-week:hover {
  color: var(--pp-cyan);
  border-color: var(--pp-cyan);
}

.dscope-week--on {
  background: var(--pp-amber);
  color: var(--pp-void);
  border-color: var(--pp-amber);
}
</style>