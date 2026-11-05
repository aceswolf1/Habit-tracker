<!--
  TaskModalCopyTo.vue — edit-mode "Copy to…" inside TaskModal.

  A week × weekday grid of toggle buttons. Picks any days in the month,
  then COPY sends one `addTasks` PATCH through `store.cloneDayTasks(…,
  [taskUuid])`: copies are unchecked, keep the habit (strikes) and skip
  days that already have the same task (shown as ✓, not selectable).
  Copies the SAVED task, so the hint asks to save edits first.
  Emits `copied` so the parent closes the dialog.
-->
<template>
  <div v-if="isEdit && !finished && sourceDayUuid && task" class="mcopy">
    <div class="mcopy-title font-mono">COPY TO…</div>
    <p class="mcopy-hint font-mono">Pick days in any week. Copies the saved version.</p>
    <div class="mcopy-grid" role="group" aria-label="Days to copy to">
      <span />
      <span v-for="(n, i) in WEEKDAY_SHORT" :key="i" class="mcopy-head font-mono">{{ n }}</span>
      <template v-for="row in rows" :key="row.uuid">
        <button
          type="button"
          class="mcopy-week font-mono"
          :aria-label="`Select all of ${row.label}`"
          @click="toggleWeek(row)"
        >{{ row.short }}</button>
        <button
          v-for="cell in row.cells"
          :key="cell.uuid"
          type="button"
          class="mcopy-day font-mono"
          :class="{ 'mcopy-day--on': selected.has(cell.uuid), 'mcopy-day--here': cell.isSource }"
          :disabled="cell.isSource || cell.hasTask"
          :aria-pressed="selected.has(cell.uuid)"
          :aria-label="cell.aria"
          @click="toggle(cell.uuid)"
        >{{ cell.isSource ? "●" : cell.hasTask ? "✓" : cell.text }}</button>
      </template>
    </div>
    <div class="mcopy-actions">
      <button type="button" class="mcopy-link font-mono" @click="sameWeekday">Same day every week</button>
      <button v-if="selected.size" type="button" class="mcopy-link font-mono" @click="selected = new Set()">Clear</button>
    </div>
    <button
      type="button"
      class="mcopy-submit font-mono"
      :disabled="selected.size === 0"
      @click="copy"
    >{{ selected.size ? `COPY TO ${selected.size} DAY${selected.size === 1 ? "" : "S"}` : "COPY" }}</button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useMonthStore } from "../../stores/monthStore";
import { dayHasTask } from "../../utils/cloneDay";
import { dayDate, dayOfMonth } from "../../utils/sharedDates";
import type { Task } from "../../types/index";

const props = defineProps<{
  isEdit: boolean;
  finished: boolean;
  /** The task being edited (saved state from the store). */
  task: Task | null;
  /** Day that currently holds the task. */
  sourceDayUuid: string | null;
}>();
const emit = defineEmits<{ copied: [count: number] }>();

const WEEKDAY_SHORT = ["M", "T", "W", "T", "F", "S", "S"];
const store = useMonthStore();
const selected = ref<Set<string>>(new Set());

interface Cell { uuid: string; text: string; aria: string; isSource: boolean; hasTask: boolean }
interface Row { uuid: string; label: string; short: string; cells: Cell[] }

const rows = computed<Row[]>(() => {
  const month = store.currentMonth;
  const task = props.task;
  if (!month || !task) return [];
  return month.weeks.map((w, wi) => {
    const label = w.name || `Week ${wi + 1}`;
    return {
      uuid: w.uuid,
      label,
      short: `W${wi + 1}`,
      cells: w.days.map((d, di) => {
        const iso = dayDate(month.startDate ?? null, wi, di);
        const isSource = d.uuid === props.sourceDayUuid;
        const hasTask = !isSource && dayHasTask(d, task);
        const state = isSource ? " (this task's day)" : hasTask ? " (already has it)" : "";
        return {
          uuid: d.uuid,
          text: iso ? String(dayOfMonth(iso)) : WEEKDAY_SHORT[di],
          aria: `${d.name}, ${label}${iso ? `, ${iso}` : ""}${state}`,
          isSource,
          hasTask,
        };
      }),
    };
  });
});

const selectable = (c: Cell) => !c.isSource && !c.hasTask;

function toggle(uuid: string) {
  const next = new Set(selected.value);
  if (next.has(uuid)) next.delete(uuid);
  else next.add(uuid);
  selected.value = next;
}

function toggleWeek(row: Row) {
  const open = row.cells.filter(selectable);
  const allOn = open.length > 0 && open.every((c) => selected.value.has(c.uuid));
  const next = new Set(selected.value);
  for (const c of open) {
    if (allOn) next.delete(c.uuid);
    else next.add(c.uuid);
  }
  selected.value = next;
}

function sameWeekday() {
  const idx = rows.value
    .map((r) => r.cells.findIndex((c) => c.isSource))
    .find((i) => i >= 0);
  if (idx === undefined) return;
  const next = new Set(selected.value);
  for (const r of rows.value) {
    const c = r.cells[idx];
    if (c && selectable(c)) next.add(c.uuid);
  }
  selected.value = next;
}

function copy() {
  if (!props.task || !props.sourceDayUuid || selected.value.size === 0) return;
  const added = store.cloneDayTasks(props.sourceDayUuid, [...selected.value], [props.task.uuid]);
  selected.value = new Set();
  emit("copied", added);
}
</script>

<style scoped>
.mcopy {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  border: 1px dashed var(--pp-line);
  background: rgb(var(--pp-void-rgb) / 0.6);
  padding: 0.75rem;
}
.mcopy-title {
  font-size: 0.7rem;
  letter-spacing: 0.12em;
  color: var(--pp-magenta);
  font-weight: 700;
}
.mcopy-hint {
  font-size: 0.7rem;
  color: var(--pp-muted);
}
.mcopy-grid {
  display: grid;
  grid-template-columns: 2.25rem repeat(7, minmax(0, 1fr));
  gap: 0.25rem;
}
.mcopy-head {
  text-align: center;
  font-size: 0.65rem;
  font-weight: 700;
  color: var(--pp-cyan);
}
.mcopy-week,
.mcopy-day {
  min-height: 36px;
  font-size: 0.75rem;
  border: 1px solid var(--pp-line);
  background: var(--pp-panel);
  color: var(--pp-text);
  cursor: pointer;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}
.mcopy-week {
  color: var(--pp-muted);
  font-weight: 700;
}
.mcopy-week:hover,
.mcopy-day:hover:not(:disabled) {
  border-color: var(--pp-cyan);
}
.mcopy-day--on {
  background: var(--pp-cyan);
  border-color: var(--pp-cyan);
  color: var(--pp-void);
  font-weight: 700;
}
.mcopy-day:disabled {
  cursor: not-allowed;
  color: var(--pp-muted);
  opacity: 0.6;
}
.mcopy-day--here:disabled {
  color: var(--pp-magenta);
  opacity: 1;
}
.mcopy-actions {
  display: flex;
  gap: 1rem;
}
.mcopy-link {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--pp-cyan);
  min-height: 32px;
}
.mcopy-link:hover {
  color: var(--pp-text);
}
.mcopy-submit {
  font-weight: 700;
  font-size: 0.75rem;
  letter-spacing: 0.1em;
  background: var(--pp-cyan);
  color: var(--pp-void);
  border: 1px solid var(--pp-cyan);
  padding: 0.65rem;
  min-height: 40px;
  cursor: pointer;
}
.mcopy-submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
