<!--
  DayStrip.vue (W2 contract §4 / §5).

  7 day buttons for the current week. Each card:
    - Header: "MON // W2" (or weekday short) + status badge:
        * ACTIVE  — when this card is the current day
        * TODAY   — when this weekday matches today (only on the
                    week that contains today; `todayIndex !== null`)
        * STDBY   — default
    - Subline: "n / m DONE" + "p%"
    - 2px progress bar
    - Pip row: one pip per task, filled when done (capped at 10, then
      "+n" overflow chip)

  Below lg: scroll-snap horizontal strip; selected scrolled into view.
  ≥ lg: 7 equal columns.

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
          {{ shortName(day.name) }} <span class="text-pp-muted">//</span> W{{ weekIndex + 1 }}
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
import type { Day, Week } from "../../types/index";
import { calculateDayProgress } from "../../utils/sharedProgress";

const props = defineProps<{
  week: Week;
  weekIndex: number;
  currentDayUuid: string | null;
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

function cardClasses(day: Day, idx: number): string {
  const base = [
    "group flex flex-col text-left p-2 sm:p-3 border transition-colors min-w-[140px] sm:min-w-0 snap-start",
  ];
  if (day.uuid === props.currentDayUuid) {
    base.push(
      "bg-pp-card-active text-pp-cyan border-pp-cyan",
      "shadow-[0_0_12px_rgba(0,240,255,0.4)]",
    );
  } else if (idx === props.todayIndex) {
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
