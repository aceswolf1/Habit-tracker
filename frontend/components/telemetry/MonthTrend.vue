<!--
  MonthTrend.vue (v2.2 / W3).

  Panel 1 of TelemetryView. Inline SVG bar + line chart of all cycles,
  chronological. For each cycle:
    - a progress bar (% of month completed)
    - a score line / dot (the XP earned)
  Finished cycles render a marker accent; active cycles are amber.
-->
<template>
  <UiPpPanel padded tag="section" data-pp-telemetry-month-trend>
    <template #header>
      <div class="flex items-center justify-between w-full">
        <span class="font-display text-headline-sm text-pp-cyan uppercase tracking-wider">
          Month Trend
        </span>
        <span class="text-label-sm text-pp-muted">
          {{ months.length }} {{ months.length === 1 ? "CYCLE" : "CYCLES" }}
        </span>
      </div>
    </template>

    <div v-if="!months.length" class="month-trend__empty font-mono">
      NO CYCLES LOGGED YET.
    </div>

    <div v-else class="month-trend__chart">
      <svg
        :viewBox="`0 0 ${chartWidth} ${chartHeight}`"
        preserveAspectRatio="none"
        role="img"
        aria-label="Month progress and score trend chart"
        class="month-trend__svg"
      >
        <!-- Y-axis baseline + gridlines for 25/50/75/100 % -->
        <g class="month-trend__grid" aria-hidden="true">
          <line
            v-for="g in gridLines"
            :key="`g-${g.value}`"
            :x1="plotLeft"
            :x2="chartWidth - plotPaddingRight"
            :y1="g.y"
            :y2="g.y"
            class="month-trend__gridline"
          />
          <text
            v-for="g in gridLines"
            :key="`gl-${g.value}`"
            :x="plotLeft - 4"
            :y="g.y + 3"
            text-anchor="end"
            class="month-trend__axis-label"
          >{{ g.value }}%</text>
        </g>

        <!-- Per-month progress bars (left half of the month lane). -->
        <g class="month-trend__bars" aria-hidden="true">
          <template v-for="(label, i) in xAxisLabels" :key="`bar-${label.uuid}`">
            <rect
              :x="barRect(i).x"
              :y="barRect(i).y"
              :width="barRect(i).w"
              :height="barRect(i).h"
              rx="0"
              :class="barClass(label)"
              :fill="barFill(label)"
            />
          </template>
        </g>

        <!-- Score polyline (right axis) -->
        <g class="month-trend__line" aria-hidden="true">
          <path
            v-if="linePath"
            :d="linePath"
            fill="none"
            class="month-trend__line-path"
            stroke="var(--pp-magenta)"
            stroke-width="1.5"
            stroke-linecap="square"
            stroke-linejoin="miter"
          />
          <circle
            v-for="(p, i) in scorePoints"
            :key="`s-${i}`"
            :cx="p.x"
            :cy="p.y"
            r="2.5"
            :fill="dotFill(p)"
          />
        </g>

        <!-- X-axis month labels (below plot) -->
        <g class="month-trend__xlabels">
          <text
            v-for="(label, i) in xAxisLabels"
            :key="`xl-${label.uuid}`"
            :x="label.cx"
            :y="chartHeight - 4"
            text-anchor="middle"
            class="month-trend__axis-label"
            :class="{ 'label--active': label.finished === false }"
          >{{ label.short }}</text>
        </g>
      </svg>

      <div class="month-trend__legend font-mono">
        <span class="month-trend__legend-item">
          <span class="month-trend__legend-swatch month-trend__legend-swatch--bar" />
          PROGRESS
        </span>
        <span class="month-trend__legend-item">
          <span class="month-trend__legend-swatch month-trend__legend-swatch--line" />
          SCORE
        </span>
        <span class="month-trend__legend-item">
          <span class="month-trend__legend-swatch month-trend__legend-swatch--active" />
          ACTIVE
        </span>
      </div>
    </div>
  </UiPpPanel>
</template>

<script setup lang="ts">
/*
 * Per-month bars (progress %) + score polyline (XP), all inline SVG.
 * Months are read from `monthStore.insights.months` (chronological).
 *
 * Layout: the SVG is a 320×620 unit-equivalent rectangle; at render time
 * the panel width drives the actual on-screen size. Each month is given
 * a 48-unit lane: left 22 units = progress bar, right 18 units = score
 * marker), connected by a magenta polyline that runs through the lane
 * centres.
 */

import { computed } from "vue";
import { storeToRefs } from "pinia";
import { useMonthStore } from "../../stores/monthStore";
import UiPpPanel from "../ui/PpPanel.vue";

const monthStore = useMonthStore();
const { insights } = storeToRefs(monthStore);

const months = computed(() => insights.value?.months ?? []);

interface BarRect {
  x: number;
  y: number;
  w: number;
  h: number;
}
interface ScorePoint {
  x: number;
  y: number;
  finished: boolean;
}
interface XLabel {
  uuid: string;
  short: string;
  cx: number;
  finished: boolean;
}

const chartWidth = 320;
const chartHeight = 160;
const plotPaddingTop = 8;
const plotPaddingBottom = 22; // leaves room for x-axis labels
const plotLeft = 30; // room for % y-axis labels ("100%" must not clip)
const plotPaddingRight = 6;
const plotHeight = computed(
  () => chartHeight - plotPaddingTop - plotPaddingBottom,
);

const gridLines = computed(() => {
  const h = plotHeight.value;
  return [0, 25, 50, 75, 100].map((v) => ({
    value: v,
    y: plotPaddingTop + h - (v / 100) * h,
  }));
});

const xAxisLabels = computed<XLabel[]>(() => {
  const list = months.value;
  if (!list.length) return [];
  const usable = chartWidth - plotLeft - plotPaddingRight;
  const step = list.length === 1 ? 0 : usable / (list.length - 1);
  return list.map((m, i) => {
    const cx =
      list.length === 1
        ? plotLeft + usable / 2
        : plotLeft + step * i;
    const raw = (m.name || "").toUpperCase();
    const short = raw.length > 7 ? raw.slice(0, 6) + "…" : raw || "—";
    return {
      uuid: m.uuid,
      short,
      cx,
      finished: !!m.finished,
    };
  });
});

const maxScore = computed(() => {
  const scores = months.value.map((m) => m.score || 0);
  return Math.max(1, ...scores);
});

function barRect(i: number): BarRect {
  const list = months.value;
  if (!list.length) return { x: 0, y: 0, w: 0, h: 0 };
  const usable = chartWidth - plotLeft - plotPaddingRight;
  const lane = list.length === 1 ? usable : usable / list.length;
  const barW = Math.max(8, Math.min(18, lane * 0.42));
  // Centre bar within its lane:
  const laneStart = plotLeft + lane * i;
  const x = laneStart + (lane - barW) / 2;
  const pct = Math.max(0, Math.min(100, months.value[i].progress || 0));
  const h = plotHeight.value;
  const barH = (pct / 100) * h;
  const y = plotPaddingTop + h - barH;
  return { x, y, w: barW, h: barH };
}

const scorePoints = computed<ScorePoint[]>(() => {
  const list = months.value;
  if (!list.length) return [];
  const usable = chartWidth - plotLeft - plotPaddingRight;
  const step = list.length === 1 ? 0 : usable / (list.length - 1);
  const h = plotHeight.value;
  const max = maxScore.value;
  return list.map((m, i) => {
    const x =
      list.length === 1
        ? plotLeft + usable / 2
        : plotLeft + step * i;
    const score = m.score || 0;
    const y = plotPaddingTop + h - (score / max) * h;
    return { x, y, finished: !!m.finished };
  });
});

const linePath = computed(() => {
  const pts = scorePoints.value;
  if (pts.length < 2) return "";
  return pts.map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`)).join(" ");
});

function barFill(label: { finished: boolean }): string {
  return label.finished ? "var(--pp-green)" : "var(--pp-amber)";
}

function barClass(_label: { finished: boolean }): string {
  // Reserved for future per-bar modifiers (animations, etc.).
  return "month-trend__bar";
}

function dotFill(p: ScorePoint): string {
  return p.finished ? "var(--pp-magenta)" : "var(--pp-amber)";
}
</script>

<style scoped>
.month-trend__empty {
  font-size: 0.7rem;
  letter-spacing: 0.1em;
  color: var(--pp-muted);
  padding: 1.25rem 0.5rem;
  text-align: center;
}

.month-trend__chart {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.month-trend__svg {
  width: 100%;
  height: auto;
  display: block;
}

.month-trend__gridline {
  stroke: var(--pp-line);
  stroke-width: 0.5;
  stroke-dasharray: 2 3;
}

.month-trend__axis-label {
  font-family: "JetBrains Mono", ui-monospace, monospace;
  font-size: 9px;
  fill: var(--pp-muted);
}

.month-trend__axis-label.label--active {
  fill: var(--pp-amber);
}

.month-trend__legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  font-size: 0.55rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--pp-muted);
}

.month-trend__legend-item {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.month-trend__legend-swatch {
  width: 14px;
  height: 8px;
  border: 1px solid var(--pp-line);
  display: inline-block;
}

.month-trend__legend-swatch--bar {
  background: var(--pp-green);
}
.month-trend__legend-swatch--line {
  background: var(--pp-magenta);
  height: 2px;
  border-color: var(--pp-magenta);
}
.month-trend__legend-swatch--active {
  background: var(--pp-amber);
}
</style>