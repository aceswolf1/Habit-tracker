<!--
  DayStrip.vue (W2 contract §4 / §5, v2.1 dated strip).

  7 day buttons for the current week. Each card:
    - Header: "MON // 17" when the cycle has a `startDate`
              (or "MON // W1" for legacy undated cycles) + status badge:
        * ACTIVE  — when this card is the current day
        * TODAY   — when this day is `findToday(cycle)` (only on the
                    week that contains today)
        * STDBY   — default
    - Subline: "n / m DONE" + "p%"
    - 2px progress bar
    - Pip row: one pip per task, filled when done (capped at 10, then
      "+n" overflow chip)

  Below lg: scroll-snap horizontal strip; selected scrolled into view.
  ≥ lg: 7 equal columns.

  v2.1:
    - Real date (`MON // 17`) when `cycle.startDate` is set, derived
      via `dayDate(startDate, weekIndex, dayIndex)` from `shared/dates.js`.
    - TODAY badge driven by `findToday(cycle)` rather than the
      weekday heuristic — re-renders automatically when the cycle
      changes.

  States:
    - selected  → ACTIVE badge + cyan glow
    - today     → TODAY badge (amber) + amber glow
    - required all done → green outline (pp-green left bar)
-->
<template>
  <div
    class="day-strip flex sm:grid sm:grid-cols-4 lg:grid-cols-7 gap-1 sm:gap-2 overflow-x-auto"
    aria-label="Days of the week"
  >
    <button
      v-for="(day, idx) in week.days"
      :key="day.uuid"
      ref="dayRefs"
      type="button"
      role="tab"
      :aria-selected="day.uuid === currentDayUuid"
      :class="cardClasses(day, idx)"
      @click="onPickDay(day.uuid)"
    >
      <div class="flex items-center justify-between mb-1 min-w-0">
        <span
          class="font-display text-headline-sm uppercase tracking-wider truncate"
          :class="day.uuid === currentDayUuid ? 'text-pp-cyan' : (idx === todayIndex ? 'text-pp-amber' : 'text-pp-text')"
        >
          {{ shortName(day.name) }} <span class="text-pp-muted">//</span> <span class="day-date-label">{{ dayDateLabel(weekIndex, idx) }}</span>
        </span>
        <span
          v-if="day.uuid === currentDayUuid"
          class="px-1.5 py-0.5 font-mono text-label-sm uppercase bg-pp-cyan text-pp-void"
        >ACTIVE</span>
        <span
          v-else-if="idx === todayIndex"
          class="px-1.5 py-0.5 font-mono text-label-sm uppercase bg-pp-amber text-pp-void"
        >TODAY</span>
        <span
          v-else
          class="font-mono text-label-sm uppercase text-pp-muted"
        >STDBY</span>
      </div>

      <div class="flex items-baseline justify-between mb-1 min-w-0">
        <span
          class="font-mono text-label-md"
          :class="day.uuid === currentDayUuid ? 'text-pp-cyan' : (idx === todayIndex ? 'text-pp-amber' : 'text-pp-muted')"
        >
          {{ doneCount(day) }} / {{ day.tasks.length }} DONE
        </span>
        <span
          class="font-display text-headline-sm"
          :class="day.uuid === currentDayUuid ? 'text-pp-cyan' : (idx === todayIndex ? 'text-pp-amber' : 'text-pp-muted')"
        >
          {{ dayPercent(day) }}%
        </span>
      </div>

      <div class="w-full h-0.5 bg-pp-void overflow-hidden mb-1">
        <div
          class="h-full"
          :style="{
            width: `${dayPercent(day)}%`,
            backgroundColor: idx === todayIndex ? 'var(--pp-amber)' : 'var(--pp-cyan)',
            boxShadow: day.uuid === currentDayUuid ? '0 0 6px rgba(0,240,255,0.6)' : 'none',
          }"
        ></div>
      </div>

      <div class="flex items-center gap-[3px] flex-wrap">
        <template v-for="(_, i) in pipsForDay(day)" :key="`p-${i}`">
          <span
            class="w-1.5 h-1.5"
            :class="i < doneCount(day) ? (idx === todayIndex ? 'bg-pp-amber' : 'bg-pp-cyan') : 'bg-pp-muted/40'"
          ></span>
        </template>
        <span
          v-if="day.tasks.length > 10"
          class="font-mono text-label-sm text-pp-muted"
        >+{{ day.tasks.length - 10 }}</span>
      </div>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import type { Cycle, Day, Week } from "../../types/index";
import { calculateDayProgress } from "../../utils/sharedProgress";
import { dayDate, findToday as findTodayFn } from "../../utils/sharedDates";

const props = defineProps<{
  week: Week;
  weekIndex: number;
  currentDayUuid: string | null;
  /** v2.1: the parent passes the full cycle so we can resolve TODAY
   *  from `findToday(cycle)` (date-based, not weekday-based). */
  cycle: Cycle | null;
  /** Keep the prop so existing parent code keeps compiling. The strip
   *  itself derives `todayIndex` from `cycle` + `findToday`; this prop
   *  is used as a tie-breaker fallback for the rare case where the
   *  cycle has no startDate (legacy undated months). */
  todayIndex: number | null;
  setCurrentDay: (dayUuid: string) => void;
}>();

const dayRefs = ref<Array<HTMLButtonElement | null>>([]);

function shortName(name: string): string {
  if (!name) return "DAY";
  return name.slice(0, 3).toUpperCase();
}

function dayPercent(day: Day): number {
  return calculateDayProgress(day);
}

function doneCount(day: Day): number {
  if (!Array.isArray(day.tasks)) return 0;
  // Required-only mirrors the backend / shared rule.
  return day.tasks.filter((t) => !t.optional && t.completed).length;
}

function pipsForDay(day: Day): unknown[] {
  return new Array(Math.min(10, day.tasks.length));
}

/**
 * v2.1 header label:
 *   - cycle has a `startDate`  → `MON // 17` (real day-of-month)
 *   - legacy / no startDate    → `MON // W1` (week label)
 */
function dayDateLabel(weekIndex: number, dayIndex: number): string {
  const startDate = (props.cycle as { startDate?: string | null } | null)?.startDate;
  const iso = dayDate(startDate || null, weekIndex, dayIndex);
  if (!iso) return `W${weekIndex + 1}`;
  const d = Number(iso.slice(8, 10));
  return `${d}`;
}

/**
 * v2.1: todayIndex from `findToday(cycle)`. Returns the dayIndex
 * inside the currently displayed week, or `null` for undated cycles
 * or out-of-range days.
 */
const todayIndexFromCycle = computed<number | null>(() => {
  if (!props.cycle) return null;
  const today = findTodayFn(props.cycle as { startDate?: string | null });
  if (!today) return null;
  if (today.weekIndex !== props.weekIndex) return null;
  return today.dayIndex;
});

const todayIndex = computed<number | null>(
  () => todayIndexFromCycle.value ?? props.todayIndex,
);

function cardClasses(day: Day, idx: number): string {
  const base = [
    "group flex flex-col text-left p-2 sm:p-3 border transition-colors min-w-[140px] sm:min-w-0 snap-start",
  ];
  if (day.uuid === props.currentDayUuid) {
    base.push(
      "bg-pp-card-active text-pp-cyan border-pp-cyan",
      "shadow-[0_0_12px_rgba(0,240,255,0.4)]",
    );
  } else if (idx === todayIndex.value) {
    base.push(
      "bg-pp-card text-pp-amber border-pp-amber",
      "shadow-[0_0_8px_rgba(255,190,11,0.35)]",
    );
  } else if (doneCount(day) === day.tasks.filter((t) => !t.optional).length && day.tasks.length > 0) {
    // All required done → green outline
    base.push("bg-pp-card text-pp-text border-pp-green");
  } else {
    base.push("bg-pp-card text-pp-text border-pp-line hover:border-pp-cyan");
  }
  return base.join(" ");
}

function onPickDay(uuid: string) {
  props.setCurrentDay(uuid);
}

// On small screens: when the selected day changes, scroll the matching
// card into view so the user doesn't have to swipe.
watch(
  () => props.currentDayUuid,
  async () => {
    await nextTick();
    if (typeof window === "undefined") return;
    if (window.innerWidth >= 640) return; // grid layout, no scroll needed
    const idx = props.week.days.findIndex((d) => d.uuid === props.currentDayUuid);
    if (idx < 0) return;
    const el = dayRefs.value[idx];
    if (el && typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  },
);
</script>

<style scoped>
/* Date label sits flush against the weekday short name without extra
 * weight so the strip header stays compact. */
.day-date-label {
  letter-spacing: 0;
}
</style>