<!--
  DaySpotlight.vue (W2 contract §4 / §5).

  The left column of the campaign view. One day, focused.

  Layout (top → bottom):
    - Header: accent square + "<DAY NAME> PROTOCOLS"
                + subline "OBJECTIVES: n/m VERIFIED | +X XP SECURED TODAY"
    - Toolbar (right): Clone (toggles <CloneDayPanel>), Filter (toggles
                       <TaskFilterBar>), "+ ADD PROTOCOL" (opens the
                       create modal for this day via the existing
                       `openCreateTaskForDay`).
    - Optional <CloneDayPanel> (W3 placeholder until they ship it).
    - TaskFilterBar (when toggled).
    - Sorted TaskRow list with drag-and-drop reorder.
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
          <span>Filter</span>
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

    <!-- Filter bar -->
    <div v-if="showFilter" class="px-1">
      <TaskFilterBar v-model="filter" :tasks="day.tasks" />
    </div>

    <!-- Task rows -->
    <div
      v-if="filteredTasks.length > 0"
      class="flex flex-col gap-1.5"
      @dragover.prevent="onListDragOver"
    >
      <TaskRow
        v-for="(task, idx) in filteredTasks"
        :key="task.uuid"
        :task="task"
        :day="day"
        :week="week"
        :monthProgress="monthProgress"
        :index="originalIndex(task)"
        :isFinished="isFinished"
        @toggle="onToggle"
        @edit="onEdit"
        @delete="onDelete"
        @dragStart="onDragStart"
        @dragEnd="onDragEnd"
      />
      <!-- Drop indicator (when dragging within the day) -->
      <div
        v-if="dragging"
        class="h-1 bg-pp-cyan/60"
        style="box-shadow: 0 0 8px rgba(0, 240, 255, 0.6);"
        aria-hidden="true"
      ></div>
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
import { computed, ref, shallowRef } from "vue";
import TaskRow from "./TaskRow.vue";
import TaskFilterBar, { type Filter } from "./TaskFilterBar.vue";
import CloneDayPanel from "./CloneDayPanel.vue";
import type { Day, Task, Week } from "../../types/index";
import { getDayStats } from "../../composables/useCampaignStats";

const props = defineProps<{
  day: Day;
  week: Week;
  weeks: Week[];
  monthProgress: number;
  isFinished: boolean;
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

const filteredTasks = computed(() => {
  const t = props.day.tasks;
  switch (filter.value) {
    case "pending":   return t.filter((x) => !x.completed);
    case "done":      return t.filter((x) =>  x.completed);
    case "legendary": return t.filter((x) => !!x.legendary);
    case "optional":  return t.filter((x) => !!x.optional);
    case "all":
    default:          return t;
  }
});

// We use the sorted (displayed) order but the index emitted is the
// position in the FULL sorted day.tasks list so cross-row drag-and-drop
// works against the same index space.
const sortedDayTasks = computed(() =>
  [...props.day.tasks].sort((a, b) => (a.order ?? 1e9) - (b.order ?? 1e9)),
);
function originalIndex(task: Task): number {
  return sortedDayTasks.value.findIndex((t) => t.uuid === task.uuid);
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
</script>

<style scoped>
@media (min-width: 1024px) {
  .day-spotlight {
    /* Slightly more generous row gap on desktop for the wide list. */
    gap: 0.75rem;
  }
}
</style>
