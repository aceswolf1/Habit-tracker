<!--
  DaySpotlight.vue (W2 contract §4 / §5).

  The left column of the campaign view. One day, focused.

  Layout (top → bottom):
    - Header: accent square + "<DAY NAME> PROTOCOLS"
                + subline "OBJECTIVES: n/m VERIFIED | +X XP SECURED TODAY"
    - Toolbar (right): Clone (toggles <CloneDayPanel>), View (toggles
                       <DayViewBar>: filter + sort + group by label),
                       "+ ADD PROTOCOL" (opens the create modal for this
                       day via `openCreateTaskForDay`).
    - Optional <CloneDayPanel>.
    - DayViewBar (when toggled).
    - TaskRow list, sorted per settingsStore.daySort and optionally grouped
      into collapsible sections by first label. Reorder (drag / ↑↓ / menu)
      only on "My order" with no filter; it saves via moveTasks.
    - Empty state: friendly message + ADD button.
    - Filter-empty state: "no tasks match this filter" + reset button.

  Props mirror the contract §4 ownership exactly — `day`, `week`,
  `isFinished`, the action callbacks from `useMonthPageState`, and the
  `monthProgress` number for the XP math.
-->
<template>
  <section
    v-if="day"
    class="day-spotlight flex flex-col gap-3"
    :aria-label="`${day.name} spotlight`"
  >
    <!-- Header -->
    <header
      class="flex flex-wrap items-start justify-between gap-3 p-3 bg-pp-card border border-pp-line"
    >
      <div class="flex flex-col gap-1 min-w-0">
        <div class="flex items-center gap-2">
          <span
            class="inline-block w-2.5 h-2.5 bg-pp-cyan"
            style="box-shadow: 0 0 8px rgba(0, 240, 255, 0.95);"
            aria-hidden="true"
          ></span>
          <h2 class="font-display text-headline-md uppercase text-pp-text tracking-wide truncate">
            {{ day.name }} Protocols
          </h2>
        </div>
        <div class="flex items-center gap-2 font-mono text-label-md uppercase text-pp-muted">
          <span>OBJECTIVES: {{ doneCount }}/{{ totalCount }} VERIFIED</span>
          <span aria-hidden="true">|</span>
          <span class="text-pp-amber font-bold">+{{ dayStats.xpEarned }} XP SECURED TODAY</span>
        </div>
      </div>

      <!-- Toolbar -->
      <div v-if="!isFinished" class="flex flex-wrap items-center gap-1">
        <button
          type="button"
          class="px-3 min-h-[40px] sm:min-h-0 sm:py-1 font-mono text-label-md uppercase tracking-wider bg-pp-panel text-pp-cyan border border-pp-line hover:border-pp-cyan transition-colors flex items-center gap-1"
          :aria-pressed="showClone"
          @click="showClone = !showClone"
        >
          <span aria-hidden="true">⇄</span>
          <span>Clone</span>
        </button>
        <button
          type="button"
          class="px-3 min-h-[40px] sm:min-h-0 sm:py-1 font-mono text-label-md uppercase tracking-wider bg-pp-panel text-pp-text border border-pp-line hover:border-pp-cyan transition-colors flex items-center gap-1"
          :aria-pressed="showFilter"
          @click="showFilter = !showFilter"
        >
          <span aria-hidden="true">⊟</span>
          <span>View</span>
          <span v-if="viewBadge" class="text-pp-cyan">· {{ viewBadge }}</span>
        </button>
        <button
          type="button"
          class="px-3 min-h-[40px] sm:min-h-0 sm:py-1 font-display text-label-md uppercase tracking-wider bg-pp-cyan text-pp-void border border-pp-cyan hover:bg-pp-text transition-colors flex items-center gap-1"
          @click="onAdd"
        >
          <span aria-hidden="true">+</span>
          <span>Add Protocol</span>
        </button>
      </div>
    </header>

    <!-- Clone panel (W3 placeholders until they ship) -->
    <CloneDayPanel
      v-if="showClone && !isFinished"
      :week="week"
      :weeks="weeks"
      :sourceDay="day"
      @close="showClone = false"
    />

    <!-- View bar: filter + sort + group by label -->
    <DayViewBar v-if="showFilter" v-model:filter="filter" :tasks="day.tasks" />

    <!-- Task rows (optionally grouped by first label) -->
    <div v-if="displayTasks.length > 0" class="flex flex-col gap-1.5">
      <template v-for="group in groups" :key="group.label">
        <button
          v-if="grouped"
          type="button"
          class="flex items-center justify-between gap-2 px-2 py-1 mt-1 font-mono text-label-md uppercase tracking-wider bg-pp-panel border border-pp-line hover:border-pp-cyan text-left"
          :aria-expanded="!collapsed.has(group.label)"
          @click="toggleGroup(group.label)"
        >
          <span class="flex items-center gap-2">
            <span
              v-if="group.label !== UNLABELED"
              class="pp-label-chip"
              :class="`pp-label-hue-${labelColorIndex(group.label)}`"
            >{{ group.label }}</span>
            <span v-else class="text-pp-muted">{{ UNLABELED }}</span>
            <span class="text-pp-muted">· {{ group.tasks.filter((t) => t.completed).length }}/{{ group.tasks.length }}</span>
          </span>
          <span class="text-pp-muted" aria-hidden="true">{{ collapsed.has(group.label) ? "▸" : "▾" }}</span>
        </button>
        <template v-if="!collapsed.has(group.label)">
          <TaskRow
            v-for="task in group.tasks"
            :key="task.uuid"
            :task="task"
            :day="day"
            :week="week"
            :monthProgress="monthProgress"
            :index="savedIndex(task)"
            :isFinished="isFinished"
            :isToday="isTodayForDay"
            :insightHabits="insightHabits"
            :canReorder="canReorder"
            :isFirst="savedIndex(task) === 0"
            :isLast="savedIndex(task) === day.tasks.length - 1"
            @toggle="onToggle"
            @edit="onEdit"
            @delete="onDelete"
            @moveUp="(uuid) => moveBy(uuid, -1)"
            @moveDown="(uuid) => moveBy(uuid, 1)"
            @dragStart="onDragStart"
            @dragEnd="onDragEnd"
            @dragover.prevent="onListDragOver"
            @drop.prevent="onDropOn(task)"
          />
        </template>
      </template>
    </div>

    <!-- Filter empty state -->
    <div
      v-else-if="day.tasks.length > 0"
      class="flex flex-col items-center justify-center gap-3 p-6 bg-pp-card border border-pp-line"
    >
      <span class="font-mono text-label-md uppercase text-pp-muted">
        No tasks match "{{ filter.toUpperCase() }}"
      </span>
      <button
        type="button"
        class="px-3 min-h-[40px] sm:min-h-0 sm:py-1 font-mono text-label-md uppercase tracking-wider bg-pp-panel text-pp-text border border-pp-line hover:border-pp-cyan"
        @click="filter = 'all'"
      >
        Reset filter
      </button>
    </div>

    <!-- Empty day state -->
    <div
      v-else
      class="flex flex-col items-center justify-center gap-3 p-6 bg-pp-card border border-pp-line"
    >
      <span class="font-display text-headline-sm uppercase text-pp-muted">NO PROTOCOLS YET</span>
      <span class="font-mono text-label-md uppercase text-pp-muted text-center max-w-sm">
        Add your first protocol for {{ day.name }} to start tracking this day.
      </span>
      <button
        v-if="!isFinished"
        type="button"
        class="px-3 min-h-[40px] sm:min-h-0 sm:py-1 font-display text-label-md uppercase tracking-wider bg-pp-cyan text-pp-void border border-pp-cyan hover:bg-pp-text flex items-center gap-1"
        @click="onAdd"
      >
        <span aria-hidden="true">+</span>
        <span>Add Protocol</span>
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, shallowRef, type Ref } from "vue";
import TaskRow from "./TaskRow.vue";
import { type Filter } from "./TaskFilterBar.vue";
import DayViewBar from "./DayViewBar.vue";
import { useSettingsStore } from "../../stores/settingsStore";
import {
  DAY_SORT_LABELS, UNLABELED, groupByFirstLabel, neighbourIndex, sortDayTasks,
} from "../../composables/useDayOrdering";
import { labelColorIndex } from "../../utils/sharedLabels";
import CloneDayPanel from "./CloneDayPanel.vue";
import type { Day, InsightsHabit, Task, Week, Cycle } from "../../types/index";
import { getDayStats } from "../../composables/useCampaignStats";
import { findToday as findTodayFn } from "../../utils/sharedDates";

const props = defineProps<{
  day: Day;
  week: Week;
  weeks: Week[];
  monthProgress: number;
  isFinished: boolean;
  /** v2.1: full cycle so DaySpotlight can resolve whether the
   *  spotlight's day is today via `findToday(cycle)`. */
  cycle: Cycle | null;
  /** v2.2: insights habit table, piped down to TaskRow for the
   * STRIKE READY pill. Optional so legacy callers still compile. */
  insightHabits?: InsightsHabit[] | null;
  toggleTask: (uuid: string) => void;
  openEditTask: (uuid: string) => void;
  openCreateTaskForDay: (dayUuid: string) => void;
  moveTask: (uuid: string, toDayUuid: string, targetIndex?: number) => void;
  deleteSingleTask: (uuid: string) => void;
}>();

const showClone = ref(false);
const showFilter = ref(false);
const filter = ref<Filter>("all");

const dayStats = computed(() => getDayStats(props.day, props.monthProgress));
const totalCount = computed(() => props.day.tasks.length);
const doneCount = computed(() => props.day.tasks.filter((t) => t.completed).length);

// v2.1: whether the spotlight's day is today. Drives the DUE IN /
// OVERDUE line on each row. Computed from `findToday(cycle)` against
// the spotlight week's index.
const isTodayForDay = computed<boolean>(() => {
  if (!props.cycle) return false;
  const today = findTodayFn(props.cycle as { startDate?: string | null });
  if (!today) return false;
  const weekIdx = props.weeks.findIndex((w) => w.uuid === props.week.uuid);
  if (weekIdx < 0) return false;
  const dayIdx = props.week.days.findIndex((d) => d.uuid === props.day.uuid);
  return today.weekIndex === weekIdx && today.dayIndex === dayIdx;
});

const settings = useSettingsStore();

function matchesFilter(x: Task): boolean {
  switch (filter.value) {
    case "pending":   return !x.completed;
    case "done":      return x.completed;
    case "legendary": return !!x.legendary;
    case "optional":  return !!x.optional;
    default:          return true;
  }
}

// Saved order = the day's task array (what moveTasks rewrites).
const displayTasks = computed(() =>
  sortDayTasks(props.day.tasks, settings.daySort).filter(matchesFilter),
);
const grouped = computed(() => settings.groupByLabel);
const groups = computed(() =>
  grouped.value ? groupByFirstLabel(displayTasks.value) : [{ label: "", tasks: displayTasks.value }],
);
const collapsed = ref<Set<string>>(new Set());
function toggleGroup(label: string) {
  const next = new Set(collapsed.value);
  if (next.has(label)) next.delete(label);
  else next.add(label);
  collapsed.value = next;
}

// Reordering only makes sense on the saved order with nothing hidden.
const canReorder = computed(
  () => !props.isFinished && settings.daySort === "manual" && filter.value === "all",
);
const viewBadge = computed(() => {
  const parts: string[] = [];
  if (settings.daySort !== "manual") parts.push(DAY_SORT_LABELS[settings.daySort]);
  if (settings.groupByLabel) parts.push("Grouped");
  return parts.join(" · ");
});

function savedIndex(task: Task): number {
  return props.day.tasks.findIndex((t) => t.uuid === task.uuid);
}
function moveBy(uuid: string, delta: -1 | 1) {
  if (!canReorder.value) return;
  const to = neighbourIndex(props.day.tasks, uuid, delta);
  if (to !== null) props.moveTask(uuid, props.day.uuid, to);
}

function onToggle(uuid: string) {
  props.toggleTask(uuid);
}
function onEdit(uuid: string) {
  props.openEditTask(uuid);
}
function onDelete(uuid: string) {
  props.deleteSingleTask(uuid);
}
function onAdd() {
  props.openCreateTaskForDay(props.day.uuid);
}

const dragging = shallowRef<{ uuid: string; fromDayUuid: string; fromIndex: number } | null>(null);
function onDragStart(payload: { uuid: string; fromDayUuid: string; fromIndex: number }) {
  dragging.value = payload;
}
function onDragEnd() {
  dragging.value = null;
}
function onListDragOver(e: DragEvent) {
  if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
}
function onDropOn(target: Task) {
  const from = dragging.value;
  dragging.value = null;
  if (!from || !canReorder.value || from.uuid === target.uuid) return;
  if (from.fromDayUuid !== props.day.uuid) return;
  const to = savedIndex(target);
  if (to >= 0) props.moveTask(from.uuid, props.day.uuid, to);
}
</script>

<style scoped>
@media (min-width: 1024px) {
  .day-spotlight {
    /* Slightly more generous row gap on desktop for the wide list. */
    gap: 0.75rem;
  }
}
</style>
