<!--
  WeekGrid.vue (W2 contract §4 / §5 / §7).

  7D Grid view. Renders 7 day columns:
    - ≥ lg       : 7 equal columns
    - 640-1023   : horizontal scroll-snap, columns ≥ 220px wide
    - < 640      : hidden (Spotlight is forced on phones; the ViewBar
                   toggle is also hidden below sm).

  Each column:
    - Compact header (day name + done count + percent + add button).
    - Stacked TaskTile list (sorted by `order`).
    - Drop target for cross-day drag-and-drop via `moveTask`.

  Hidden on phone — the parent (CampaignView) doesn't render this
  component there; the guard below is a belt-and-suspenders fallback.
-->
<template>
  <div
    v-if="!isPhone"
    class="week-grid grid gap-1 sm:gap-2 sm:grid-cols-[repeat(7,minmax(220px,1fr))] lg:grid-cols-7 overflow-x-auto"
    :class="{ 'is-dragging': isDragging }"
  >
    <div
      v-for="(day, idx) in week.days"
      :key="day.uuid"
      class="day-column flex flex-col gap-1 p-1.5 bg-pp-panel border border-pp-line min-w-[220px] lg:min-w-0 snap-start"
      :class="[
        day.uuid === currentDayUuid
          ? 'border-pp-cyan shadow-[0_0_10px_rgba(0,240,255,0.25)]'
          : '',
        dragOverDay === day.uuid ? 'bg-pp-card-active' : '',
      ]"
      @dragover.prevent="onColumnDragOver(day.uuid, $event)"
      @dragenter.prevent="onColumnDragEnter(day.uuid)"
      @dragleave.prevent="onColumnDragLeave(day.uuid)"
      @drop.prevent="onColumnDrop(day.uuid)"
    >
      <div class="flex items-center justify-between mb-1">
        <div class="flex items-center gap-1.5 min-w-0">
          <span
            class="font-display text-headline-sm uppercase tracking-wider truncate"
            :class="day.uuid === currentDayUuid ? 'text-pp-cyan' : 'text-pp-text'"
          >
            {{ shortName(day.name) }}
          </span>
          <span class="font-mono text-label-sm text-pp-muted uppercase">
            {{ doneCount(day) }}/{{ day.tasks.length }}
          </span>
        </div>
        <button
          v-if="!isFinished"
          type="button"
          class="w-7 h-7 sm:w-10 sm:h-10 lg:w-7 lg:h-7 flex items-center justify-center bg-pp-card-active hover:bg-pp-cyan hover:text-pp-void text-pp-text transition-colors"
          :aria-label="`Add task to ${day.name}`"
          @click="onAdd(day.uuid)"
        >
          +
        </button>
      </div>

      <div class="flex flex-col gap-1 min-h-[60px]">
        <TaskTile
          v-for="(task, tidx) in sortedTasks(day)"
          :key="task.uuid"
          :task="task"
          :dayUuid="day.uuid"
          :index="tidx"
          @toggle="onToggle"
          @edit="onEdit"
          @delete="onDelete"
          @dragStart="onDragStart"
          @dragEnd="onDragEnd"
        />
        <div
          v-if="day.tasks.length === 0"
          class="font-mono text-label-sm uppercase text-pp-muted text-center py-4"
        >No protocols</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, shallowRef } from "vue";
import { injectCampaignBreakpoints } from "../../composables/campaignBreakpoints";
import TaskTile from "./TaskTile.vue";
import type { Day, Task, Week } from "../../types/index";

const props = defineProps<{
  week: Week;
  monthProgress: number;
  isFinished: boolean;
  toggleTask: (uuid: string) => void;
  openEditTask: (uuid: string) => void;
  openCreateTaskForDay: (dayUuid: string) => void;
  moveTask: (uuid: string, toDayUuid: string, targetIndex?: number) => void;
  deleteSingleTask: (uuid: string) => void;
  currentDayUuid: string | null;
  setCurrentDay: (dayUuid: string) => void;
}>();

const bp = injectCampaignBreakpoints();
const isPhone = computed(() => !!bp.isPhone?.value);

const dragOverDay = ref<string | null>(null);
const isDragging = shallowRef(false);

function shortName(name: string): string {
  if (!name) return "DAY";
  return name.slice(0, 3).toUpperCase();
}

function sortedTasks(day: Day): Task[] {
  return [...(day.tasks || [])].sort(
    (a, b) => (a.order ?? 1e9) - (b.order ?? 1e9),
  );
}

function doneCount(day: Day): number {
  if (!Array.isArray(day.tasks)) return 0;
  return day.tasks.filter((t) => !t.optional && t.completed).length;
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
function onAdd(dayUuid: string) {
  props.setCurrentDay(dayUuid);
  props.openCreateTaskForDay(dayUuid);
}

function onDragStart() {
  isDragging.value = true;
}
function onDragEnd() {
  isDragging.value = false;
  dragOverDay.value = null;
}
function onColumnDragOver(dayUuid: string, e: DragEvent) {
  if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
  dragOverDay.value = dayUuid;
}
function onColumnDragEnter(dayUuid: string) {
  dragOverDay.value = dayUuid;
}
function onColumnDragLeave(dayUuid: string) {
  if (dragOverDay.value === dayUuid) {
    dragOverDay.value = null;
  }
}
function onColumnDrop(dayUuid: string) {
  dragOverDay.value = null;
  isDragging.value = false;
  // The dataTransfer payload was set by TaskTile/TaskRow. Read it
  // and call `moveTask`.
  try {
    const data = JSON.parse(
      (window.event as DragEvent)?.dataTransfer?.getData("application/json") || "{}",
    );
    if (!data || !data.uuid) return;
    // Default targetIndex: end of destination day.
    const dest = props.week.days.find((d) => d.uuid === dayUuid);
    const targetIndex = dest ? dest.tasks.length : undefined;
    props.moveTask(data.uuid, dayUuid, targetIndex);
  } catch {
    /* ignore malformed payload */
  }
}
</script>

<style scoped>
@media (max-width: 1023.98px) {
  .day-column {
    min-height: 60px;
  }
}
.is-dragging .day-column {
  /* Visual feedback while any drag is in flight. */
  transition: background-color 100ms linear;
}
</style>
