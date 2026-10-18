<!--
  XpChart.vue (v2.2 split from CampaignCockpit).

  Inline SVG polyline + dots showing the XP earned across the seven
  days of the active week. Hidden when every day is at 0.

  Geometry: fixed viewBox so the SVG scales with its container without
  reflowing the dots. Horizontal padding is generous enough that the
  first ("MON") and last ("SUN") text labels — rendered with
  text-anchor="middle" — sit fully inside the viewBox at every
  responsive width.
-->
<template>
  <UiPpPanel v-if="hasAnyXp" padded>
    <template #header>
      <div class="flex items-center justify-between w-full">
        <span class="text-headline-sm text-pp-cyan uppercase tracking-wider">
          Daily XP Trajectory
        </span>
        <span class="text-label-sm text-pp-muted">AVG {{ avgXp }} XP/DAY</span>
      </div>
    </template>
    <svg
      class="w-full"
      :viewBox="`0 0 ${chartWidth} ${chartHeight}`"
      preserveAspectRatio="none"
      role="img"
      aria-label="Daily XP chart"
    >
      <path
        v-if="chartPath"
        :d="chartPath"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        class="text-pp-cyan"
        style="filter: drop-shadow(0 0 4px rgba(0,240,255,0.6))"
      />
      <g>
        <circle
          v-for="(point, i) in chartPoints"
          :key="i"
          :cx="point.x"
          :cy="point.y"
          :r="point.isHighlight ? 4 : 3"
          :fill="point.isHighlight ? 'var(--pp-magenta)' : 'var(--pp-cyan)'"
        />
      </g>
      <text
        v-for="(label, i) in xAxisLabels"
        :key="`x-${i}`"
        :x="label.x"
        :y="chartHeight - 2"
        text-anchor="middle"
        class="text-label-sm"
        fill="currentColor"
        style="font-size: 9px; color: var(--pp-muted)"
      >{{ label.text }}</text>
    </svg>
  </UiPpPanel>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { getWeekDayXp } from "../../../composables/useCampaignStats";
import type { Week } from "../../../types/index";

const props = defineProps<{
  week: Week;
  monthProgress: number;
  currentDayUuid: string | null;
}>();

const chartWidth = 280;
const chartHeight = 56;
const chartPaddingX = 18;
const chartPaddingY = 6;
const chartLabelBand = 14;

const weekXpValues = computed(() => getWeekDayXp(props.week, props.monthProgress));
const hasAnyXp = computed(() => weekXpValues.value.some((v) => v > 0));

const avgXp = computed(() => {
  const nonZero = weekXpValues.value.filter((v) => v > 0);
  if (nonZero.length === 0) return 0;
  return Math.round(nonZero.reduce((a, b) => a + b, 0) / nonZero.length);
});

const chartPoints = computed(() => {
  const values = weekXpValues.value;
  const max = Math.max(1, ...values);
  const step = (chartWidth - chartPaddingX * 2) / 6;
  return values.map((xp, i) => {
    const x = chartPaddingX + step * i;
    const plotBottom = chartHeight - chartLabelBand;
    const y = plotBottom - (xp / max) * (plotBottom - chartPaddingY);
    const day = props.week.days[i];
    const isHighlight = !!day && day.uuid === props.currentDayUuid;
    return { x, y, isHighlight };
  });
});

const chartPath = computed(() => {
  if (chartPoints.value.length < 2) return "";
  return chartPoints.value
    .map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`))
    .join(" ");
});

const xAxisLabels = computed(() => {
  return chartPoints.value.map((p, i) => {
    const day = props.week.days[i];
    const text = day ? day.name.slice(0, 3).toUpperCase() : "";
    return { x: p.x, text };
  });
});
</script>
