<!--
  WeekTabs.vue (W2 contract §4 / §5, v2.1 boss names).

  Horizontal tab strip for the 4 weeks of a cycle. Each tab:
    - "01" / "02" / ... numeric prefix in mono.
    - Week name (uppercase, display font).
    - v2.1: boss name (`bossForWeek(i).name`) beside the week name at
      ≥ lg; hidden on phone / tablet to keep the strip compact.
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
        v-if="bossForWeek(idx)"
        class="week-boss font-mono uppercase tracking-wider hidden lg:inline"
        :class="week.uuid === currentWeekUuid ? 'text-pp-magenta' : 'text-pp-muted'"
      >{{ bossForWeek(idx).name }}</span>
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
import { bossForWeek } from "../../utils/sharedBosses";

const props = defineProps<{
  weeks: Week[];
  currentWeekUuid: string | null;
  setCurrentWeek: (week: Week) => void;
}>();

function tabClasses(week: Week, _idx: number): string {
  const base = [
    "group inline-flex items-center gap-2 px-3 min-h-[40px] sm:min-h-0 sm:py-1.5 border transition-colors whitespace-nowrap shrink-0 flex-wrap",
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

<style scoped>
/* Boss label sits below the week name when the row wraps at ≥ lg; the
 * default flex column keeps the prefix + name above and the boss +
 * progress bar on the second line. */
/* Boss name sits on the same line as the week name so the tabs keep their
   v2.0 height (7 task rows must still fit at 1440×900). */
.week-boss {
  font-size: 0.65rem;
  letter-spacing: 0.1em;
  line-height: 1.2;
}
</style>