<!--
  TaskRow.vue (W2 contract §4 / §5 / Wave B / B3, v2.1 details).

  Spotlight row. Layout differs between phone (< 640) and ≥ 640:

    ≥ 640 (desktop / tablet — unchanged from Wave A):
      [ check ] [ thumb 128×72 ] [ title + meta + badges ] [ edit ][ delete ][ drag ]

    < 640 (phone):
      [ check ] [ thumb 64×36 ] [ title (2 lines OK) ] [ ⋯ menu ]
      - thumb is hidden when the task has no media AND no icon
      - the two action buttons collapse into one TaskRowMenu (more_horiz)
      - drag is hidden (no native drag affordance on touch)

  v2.1 display rules (contract §5):
    - Tag badge (`PpBadge` `common | rare | essential | defense`) sits
      next to the title.
    - Duration overlay (`05:00` / `1:30:00`) on the thumb bottom-right
      via `TaskMedia.durationLabel`.
    - `• EVENING` in the meta line when `timeOfDay` is set.
    - `• DUE IN 2H 40M` (amber) when today's day and due time ahead;
      `• OVERDUE` (danger) when past and not completed. The line
      re-renders every 60 s via a local `now` ref so the "DUE IN"
      count ticks down without an explicit refresh.

  Check button (Wave B fixup):
    Unchecked: 1px cyan border (1px magenta for legendary), transparent
               fill, muted text. Hover fills to cyan/magenta with a dark
               glyph for clear visibility against the dark card.
    Checked:   solid green (or magenta for legendary completed) with a
               dark ✓ glyph — unchanged.

  Completed state: `pp-done` background + 3px green left bar.
  Drag-and-drop is plumbed via native HTML5 drag events. Within-day
  reorder uses the same `moveTask` action.

  Emits:
    toggle(uuid)
    edit(uuid)
    delete(uuid)
    dragStart({ uuid, fromDayUuid, fromIndex })
    dragEnd()
-->
<template>
  <div
    class="task-row group relative flex items-stretch gap-2 py-1.5 pl-2.5 pr-2 border-l-[3px] bg-pp-card hover:bg-pp-card-active transition-colors min-h-[56px] sm:min-h-[64px]"
    :class="[
      task.completed
        ? 'border-pp-green bg-pp-done'
        : task.legendary
          ? 'border-pp-magenta'
          : 'border-transparent',
      isFinished && 'opacity-80',
    ]"
    :data-task-uuid="task.uuid"
    :draggable="!isPhone"
    @dragstart="onDragStart"
    @dragend="onDragEnd"
  >
    <!-- 1. Check button (visible on every size; the styles change). -->
    <button
      type="button"
      class="check-btn shrink-0 self-center flex items-center justify-center font-mono font-bold"
      :class="[checkSizeClasses, checkClasses]"
      :aria-label="task.completed ? 'Mark incomplete' : 'Mark complete'"
      :aria-pressed="task.completed"
      :data-uuid="task.uuid"
      @click.stop="emit('toggle', task.uuid)"
    >
      <span v-if="task.completed" aria-hidden="true">✓</span>
      <span v-else-if="isPhone" class="text-pp-cyan text-[10px] font-mono" aria-hidden="true">—</span>
    </button>

    <!-- 2. Media thumb with v2.1 duration overlay. -->
    <div class="shrink-0 self-center">
      <TaskMedia :task="task" variant="thumb" :hide-on-empty="isPhone" :duration-label="durationLabel" />
    </div>

    <!-- 3-5. Title + meta. 2 lines on phone, 1 line ellipsis on ≥ sm. -->
    <div class="flex-1 min-w-0 flex flex-col gap-1 justify-center">
      <div class="flex items-center gap-2 min-w-0 flex-wrap">
        <h3
          class="font-display text-headline-sm uppercase text-pp-text min-w-0"
          :class="isPhone ? 'line-clamp-2' : 'truncate'"
          :title="task.description"
        >
          {{ task.description }}
        </h3>
        <PpBadge
          v-if="tagKind"
          :kind="tagKind"
        >{{ tagLabel }}</PpBadge>
        <span
          v-if="task.legendary"
          class="badge shrink-0 inline-flex items-center gap-1 px-1.5 sm:px-2 py-[2px] font-mono text-label-sm uppercase border text-pp-magenta border-pp-magenta"
          style="background: rgb(var(--pp-magenta-rgb) / 0.08);"
        >
          <span aria-hidden="true">★</span>
          <span>LEGENDARY</span>
        </span>
        <span
          v-else-if="task.optional"
          class="badge shrink-0 inline-flex items-center px-1.5 sm:px-2 py-[2px] font-mono text-label-sm uppercase text-pp-amber border border-pp-amber border-dashed"
        >
          OPTIONAL
        </span>
      </div>
      <div
        v-if="!isPhone"
        class="flex items-center gap-2 font-mono text-body-sm text-pp-muted min-w-0 flex-wrap"
      >
        <span class="shrink-0" :class="xpClasses">{{ xpLabel }}</span>
        <span v-if="task.notes" class="shrink-0 text-pp-muted" aria-hidden="true">•</span>
        <span v-if="task.notes" class="truncate min-w-0" :title="task.notes">{{ task.notes }}</span>
        <span v-if="replicatedLabel" class="shrink-0 text-pp-muted" aria-hidden="true">•</span>
        <span v-if="replicatedLabel" class="shrink-0 text-pp-muted">REPLICATED: {{ replicatedLabel }}</span>
        <span v-if="todLabel" class="shrink-0 text-pp-muted" aria-hidden="true">•</span>
        <span v-if="todLabel" class="shrink-0 text-pp-cyan">{{ todLabel }}</span>
        <span v-if="dueLine" class="shrink-0 text-pp-muted" aria-hidden="true">•</span>
        <span
          v-if="dueLine"
          class="shrink-0 font-bold"
          :class="dueLine.tone === 'danger' ? 'text-pp-danger' : 'text-pp-amber'"
          :title="dueLine.text"
        >{{ dueLine.text }}</span>
      </div>
      <!-- Phone: only show the xp line (no notes / replicated to keep
           the row short and avoid 3+ lines). Notes & replicated labels
           remain visible on desktop only. -->
      <div v-else class="font-mono text-body-sm text-pp-muted min-w-0">
        <span class="shrink-0" :class="xpClasses">{{ xpLabel }}</span>
      </div>
    </div>

    <!-- 6. Actions. -->
    <!-- Phone: one `more_horiz` menu. -->
    <TaskRowMenu
      v-if="isPhone && !isFinished"
      class="self-center"
      :task-uuid="task.uuid"
      :task-description="task.description"
      @edit="(uuid) => emit('edit', uuid)"
      @delete="(uuid) => emit('delete', uuid)"
    />

    <!-- ≥ sm: explicit edit + delete (and a hidden drag affordance at lg). -->
    <div
      v-else-if="!isFinished"
      class="shrink-0 self-center flex items-center gap-1"
    >
      <button
        type="button"
        class="micro shrink-0 w-7 h-7 flex items-center justify-center bg-pp-panel hover:bg-pp-card-active text-pp-muted hover:text-pp-cyan transition-colors"
        :aria-label="`Edit ${task.description}`"
        @click.stop="emit('edit', task.uuid)"
      >
        <PpIcon name="edit" :size="14" />
      </button>
      <button
        type="button"
        class="micro shrink-0 w-7 h-7 flex items-center justify-center bg-pp-panel hover:bg-pp-card-active text-pp-muted hover:text-pp-danger transition-colors"
        :aria-label="`Delete ${task.description}`"
        @click.stop="emit('delete', task.uuid)"
      >
        <PpIcon name="delete" :size="14" />
      </button>
      <!-- Drag affordance. The row is already `draggable` so this is
           only a visible handle + a keyboard focus target. -->
      <span
        v-if="showDragHandle"
        class="hidden lg:flex shrink-0 w-7 h-7 items-center justify-center text-pp-muted cursor-grab"
        :aria-label="`Reorder ${task.description}`"
      >
        <PpIcon name="drag_indicator" :size="16" />
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import TaskMedia from "../task/TaskMedia.vue";
import TaskRowMenu from "./TaskRowMenu.vue";
import PpIcon from "../ui/PpIcon.vue";
import PpBadge from "../ui/PpBadge.vue";
import {
  formatDurationLabel,
  getDueTimeLine,
  getReplicatedLabel,
  getTaskXp,
  tagBadgeKind,
  tagBadgeLabel,
  timeOfDayLabel,
} from "../../composables/useCampaignStats";
import { injectCampaignBreakpoints } from "../../composables/campaignBreakpoints";
import type { Task, Week } from "../../types/index";
import type { TaskTag, TaskTimeOfDay } from "../../types/index";

const props = defineProps<{
  task: Task;
  day: { uuid: string };
  week: Week;
  monthProgress: number;
  index: number;
  isFinished: boolean;
  /** v2.1: whether the row's day is today. Drives the DUE IN / OVERDUE line. */
  isToday: boolean;
}>();

const emit = defineEmits<{
  toggle: [uuid: string];
  edit: [uuid: string];
  delete: [uuid: string];
  dragStart: [payload: { uuid: string; fromDayUuid: string; fromIndex: number }];
  dragEnd: [];
}>();

const bp = injectCampaignBreakpoints();
const isPhone = computed(() => !!bp.isPhone?.value);
const showDragHandle = computed(() => !isPhone.value && !!bp.isDesktop?.value);

const replicatedLabel = computed(() => getReplicatedLabel(props.task, props.week));

const xp = computed(() => getTaskXp(props.task, props.monthProgress));
const xpLabel = computed(() => {
  if (props.task.completed) return `+${xp.value} XP EARNED`;
  return `+${xp.value} XP PENDING`;
});
const xpClasses = computed(() => {
  if (props.task.completed) {
    return props.task.legendary ? "text-pp-magenta font-bold" : "text-pp-green";
  }
  return props.task.legendary ? "text-pp-magenta font-bold" : "text-pp-cyan";
});

// v2.1 display helpers.
const durationLabel = computed(() => formatDurationLabel(props.task.durationMin));
const tagKind = computed(() => tagBadgeKind(props.task.tag));
const tagLabel = computed(() => tagBadgeLabel(props.task.tag) || "");
const todLabel = computed(() => timeOfDayLabel(props.task.timeOfDay));

// `now` ticks once a minute so DUE IN counts down live. The interval
// is only registered while the row is mounted; cleanup on unmount.
const now = ref(new Date());
let nowTimer: ReturnType<typeof setInterval> | null = null;
onMounted(() => {
  nowTimer = setInterval(() => {
    now.value = new Date();
  }, 60_000);
});
onBeforeUnmount(() => {
  if (nowTimer !== null) {
    clearInterval(nowTimer);
    nowTimer = null;
  }
});

const dueLine = computed(() =>
  getDueTimeLine(
    props.task,
    { isToday: props.isToday, now: now.value },
    props.task.dueTime ?? null,
  ),
);

/**
 * Check button classes (Wave B fixup):
 *  - unchecked regular   → 1px cyan border, transparent fill, muted text;
 *                          hover fills to cyan with the dark glyph.
 *  - unchecked legendary → 1px magenta border + magenta hover fill.
 *  - checked regular     → solid green + dark ✓ glyph (unchanged).
 *  - checked legendary   → solid magenta + dark ✓ glyph (unchanged).
 */
const checkClasses = computed(() => {
  if (props.task.completed) {
    if (props.task.legendary) {
      return "bg-pp-magenta text-pp-void shadow-[0_0_10px_rgba(255,0,127,0.6)]";
    }
    return "bg-pp-green text-pp-void shadow-[0_0_8px_rgba(0,255,102,0.6)]";
  }
  if (props.task.legendary) {
    return "bg-transparent text-pp-magenta border border-pp-magenta hover:bg-pp-magenta hover:text-pp-void";
  }
  return "bg-transparent text-pp-cyan border border-pp-cyan hover:bg-pp-cyan hover:text-pp-void";
});

/**
 * Phone uses a smaller square (32×32). Desktop / tablet keep the 32×32
 * size from Wave A for visual rhythm; we widen to 40×40 at sm and lg to
 * match the 40 px tap-target rule.
 */
const checkSizeClasses = computed(() =>
  isPhone.value ? "w-8 h-8" : "w-8 h-8 sm:w-10 sm:h-10",
);

function onDragStart(e: DragEvent) {
  if (isPhone.value) return;
  if (!e.dataTransfer) return;
  e.dataTransfer.effectAllowed = "move";
  const payload = {
    uuid: props.task.uuid,
    fromDayUuid: props.day.uuid,
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
 * Short neon pulse on the check button (≤ 400 ms, off under reduced motion).
 * Both ring + filled states get the same scale-on-press; the visible
 * colour flash comes from the hover/active class transitions above.
 */
.check-btn:active {
  transform: scale(0.92);
}
@media (prefers-reduced-motion: no-preference) {
  .check-btn {
    transition: background-color 120ms linear, color 120ms linear,
      transform 120ms linear, border-color 120ms linear;
  }
}

/*
 * Compact desktop row height: the 72px target at ≥ sm comes from
 * `sm:min-h-[72px]` + `py-2` + a 96×54 TaskMedia thumb.
 * Phone keeps `min-h-[60px]` + 64×36 thumb (handled by TaskMedia).
 */

/*
 * Micro button tap target — keep ≥ 40×40 below lg (B-S2, contract §7).
 */
@media (max-width: 1023.98px) {
  .micro {
    width: 40px !important;
    height: 40px !important;
  }
}

/*
 * 2-line title clamp on phone. Tailwind's `line-clamp-2` only exists
 * from v3.3 — keep an explicit fallback so older toolchains don't
 * silently lose it.
 */
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>