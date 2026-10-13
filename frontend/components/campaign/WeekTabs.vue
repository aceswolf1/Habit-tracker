<!--
  WeekTabs.vue (W2 contract §4 / §5).

  Horizontal tab strip for the 4 weeks of a cycle. Each tab:
    - "01" / "02" / ... numeric prefix in mono.
    - Week name (uppercase, display font).
    - Mini progress bar (full week progress, cyan fill, dim track).
    - Active state: cyan glow + bright label.
    - Conquered state: green check + dim label.

  Selection: click anywhere on the tab. Selected = cyan fill, others
  panel-on-card with 1px line border. Below sm: horizontally scrollable.
-->
<template>
  <nav
    class="week-tabs flex items-stretch gap-1 overflow-x-auto"
    aria-label="Weeks"
  >
    <button
      v-for="(week, idx) in weeks"
      :key="week.uuid"
      type="button"
      role="tab"
      :aria-selected="week.uuid === currentWeekUuid"
      :class="tabClasses(week, idx)"
      @click="setCurrentWeek(week)"
    >
      <span class="font-mono text-label-sm text-pp-muted" aria-hidden="true">
        {{ String(idx + 1).padStart(2, "0") }}
      </span>
      <span class="font-display text-headline-sm uppercase tracking-wider truncate">
        {{ week.name }}
      </span>
      <span
        class="block w-10 h-1 bg-pp-void overflow-hidden"
        aria-hidden="true"
      >
        <span
          class="block h-full"
          :class="week.uuid === currentWeekUuid ? 'bg-pp-cyan' : 'bg-pp-muted'"
          :style="{ width: `${week.progress ?? 0}%`, boxShadow: week.uuid === currentWeekUuid ? '0 0 6px rgba(0,240,255,0.6)' : 'none' }"
        ></span>
      </span>
      <span
        v-if="week.conquered"
        class="font-mono text-label-sm text-pp-green"
        aria-label="Conquered"
      >✓</span>
    </button>
  </nav>
</template>

<script setup lang="ts">
import type { Week } from "../../types/index";

const props = defineProps<{
  weeks: Week[];
  currentWeekUuid: string | null;
  setCurrentWeek: (week: Week) => void;
}>();

function tabClasses(week: Week, _idx: number): string {
  const base = [
    "group inline-flex items-center gap-2 px-3 min-h-[40px] sm:min-h-0 sm:py-1.5 border transition-colors whitespace-nowrap shrink-0",
  ];
  if (week.uuid === props.currentWeekUuid) {
    base.push(
      "bg-pp-card-active text-pp-cyan border-pp-cyan",
      "shadow-[0_0_10px_rgba(0,240,255,0.35)]",
    );
  } else if (week.conquered) {
    base.push("bg-pp-card text-pp-green border-pp-line hover:border-pp-green");
  } else {
    base.push("bg-pp-card text-pp-text border-pp-line hover:border-pp-cyan");
  }
  return base.join(" ");
}
</script>
