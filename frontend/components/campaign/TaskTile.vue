<!--
  TaskTile.vue (W2 contract §4 / §5 / §7).

  Compact card for the 7D grid. Shows:
    - TaskMedia tile (16:9, full column width)
    - Title (1 line, ellipsis)
    - Check button (same check rules as TaskRow)
    - Badges (LEGENDARY / OPTIONAL)
  No meta line (no XP, no notes, no replicated label) — the column
  header already shows the day-level XP; per-task meta lives in the
  spotlight.

  Native HTML5 drag source (same `dataTransfer` payload as TaskRow).
  The `dayUuid` prop is required so the drag payload can stamp the
  source day for cross-day moves.
-->
<template>
  <div
    class="task-tile flex flex-col gap-1 p-1.5 bg-pp-card border border-pp-line hover:bg-pp-card-active transition-colors"
    :class="[
      task.completed
        ? 'border-l-[3px] border-l-pp-green'
        : task.legendary
          ? 'border-l-[3px] border-l-pp-magenta'
          : '',
    ]"
    :data-task-uuid="task.uuid"
    draggable="true"
    @dragstart="onDragStart"
    @dragend="onDragEnd"
  >
    <div class="relative">
      <TaskMedia :task="task" variant="tile" />
      <button
        type="button"
        class="absolute top-1 right-1 w-7 h-7 flex items-center justify-center font-mono font-bold text-pp-void"
        :class="checkClasses"
        :aria-label="task.completed ? 'Mark incomplete' : 'Mark complete'"
        :aria-pressed="task.completed"
        @click.stop="emit('toggle', task.uuid)"
      >
        <span v-if="task.completed" aria-hidden="true">✓</span>
      </button>
    </div>
    <div class="flex items-center justify-between gap-1 min-w-0">
      <span
        class="task-tile-title font-display text-headline-sm uppercase text-pp-text min-w-0"
        :title="task.description"
      >{{ task.description }}</span>
    </div>
    <div class="flex items-center gap-1 flex-wrap">
      <span
        v-if="task.legendary"
        class="inline-flex items-center gap-1 px-1.5 py-0.5 font-mono text-label-sm uppercase border text-pp-magenta border-pp-magenta"
        style="background: rgb(var(--pp-magenta-rgb) / 0.08);"
      >
        <span aria-hidden="true">★</span>
        <span>LEGENDARY</span>
      </span>
      <span
        v-else-if="task.optional"
        class="inline-flex items-center px-1.5 py-0.5 font-mono text-label-sm uppercase text-pp-amber border border-pp-amber border-dashed"
      >
        OPTIONAL
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import TaskMedia from "../task/TaskMedia.vue";
import type { Task } from "../../types/index";

const props = defineProps<{
  task: Task;
  dayUuid: string;
  index: number;
}>();

const emit = defineEmits<{
  toggle: [uuid: string];
  edit: [uuid: string];
  delete: [uuid: string];
  dragStart: [payload: { uuid: string; fromDayUuid: string; fromIndex: number }];
  dragEnd: [];
}>();

/**
 * Check button classes (Wave B fixup):
 *  - unchecked regular   → 1px cyan border, transparent fill, muted text;
 *                          hover fills to cyan.
 *  - unchecked legendary → 1px magenta border, magenta hover fill.
 *  - checked regular     → solid green + dark ✓ glyph.
 *  - checked legendary   → solid magenta + dark ✓ glyph.
 *
 * The grid tile keeps the same visual rule as the row so users get the
 * same affordance in both views.
 */
const checkClasses = computed(() => {
  if (props.task.completed) {
    if (props.task.legendary) {
      return "bg-pp-magenta text-pp-void shadow-[0_0_8px_rgba(255,0,127,0.6)]";
    }
    return "bg-pp-green text-pp-void shadow-[0_0_6px_rgba(0,255,102,0.6)]";
  }
  if (props.task.legendary) {
    return "bg-transparent text-pp-magenta border border-pp-magenta hover:bg-pp-magenta hover:text-pp-void";
  }
  return "bg-transparent text-pp-cyan border border-pp-cyan hover:bg-pp-cyan hover:text-pp-void";
});

function onDragStart(e: DragEvent) {
  if (!e.dataTransfer) return;
  e.dataTransfer.effectAllowed = "move";
  const payload = {
    uuid: props.task.uuid,
    fromDayUuid: props.dayUuid,
    fromIndex: props.index,
  };
  e.dataTransfer.setData("application/json", JSON.stringify(payload));
  emit("dragStart", payload);
}
function onDragEnd() {
  emit("dragEnd");
}
</script>

<style scoped>
/*
 * TaskTile title: 2-line clamp with ellipsis (R8). QA found that
 * the 1-line truncate at desktop 1440×900 was clipping long titles
 * ("DRINK 8 GLASSES OF", "MORNING STRETCHI", etc.). Two lines of
 * 14px/20px Space Grotesk at narrow column widths reads cleanly and
 * always closes with an ellipsis on overflow.
 *
 * The fall-back is a `-webkit-line-clamp` + `-webkit-box-orient`
 * because Tailwind's `line-clamp-2` only landed in v3.3 and the
 * project's Tailwind may be a touch older.
 */
.task-tile-title {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
}
</style>
