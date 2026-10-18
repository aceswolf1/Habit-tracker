<!--
  WeekdayRates.vue (v2.2 / W3).

  Panel 2 of TelemetryView. Seven horizontal bars Mon..Sun, each
  labelled with its weekday completion % (0..100). The leading day
  (highest %) gets a cyan accent + a "PEAK" badge; the trailing day
  (lowest non-zero, or 0% if all zero) gets a muted accent.
-->
<template>
  <UiPpPanel padded tag="section" data-pp-telemetry-weekday-rates>
    <template #header>
      <div class="flex items-center justify-between w-full">
        <span class="font-display text-headline-sm text-pp-cyan uppercase tracking-wider">
          Weekday Rates
        </span>
        <span class="text-label-sm text-pp-muted">
          AVG {{ avgRate }}% COMPLETION
        </span>
      </div>
    </template>

    <div v-if="!hasData" class="weekday__empty font-mono">
      COMPLETE A FEW HABITS TO SEE ROLL-UPS.
    </div>

    <div v-else class="weekday__grid" role="list">
      <div
        v-for="(rate, i) in rates"
        :key="i"
        class="weekday__row"
        :class="{
          'weekday__row--peak': isPeak(i),
          'weekday__row--trough': isTrough(i),
        }"
        role="listitem"
      >
        <span class="weekday__name font-mono">{{ WEEKDAY_LABELS[i] }}</span>
        <div class="weekday__bar" :aria-label="`${WEEKDAY_LABELS[i]} ${rate}%`">
          <div
            class="weekday__fill"
            :style="{ width: `${rate}%` }"
          />
        </div>
        <span class="weekday__value font-display">{{ rate }}%</span>
      </div>
    </div>
  </UiPpPanel>
</template>

<script setup lang="ts">
/*
 * Renders the Mon..Sun (index 0..6) completion % array from
 * `monthStore.insights.weekdayRates`. Days with no data show "0%" with
 * an empty bar. Peak day is the day with the highest non-zero rate; if
 * every day is zero there's no peak and the rows render uniformly.
 */

import { computed } from "vue";
import { storeToRefs } from "pinia";
import { useMonthStore } from "../../stores/monthStore";
import UiPpPanel from "../ui/PpPanel.vue";

const monthStore = useMonthStore();
const { insights } = storeToRefs(monthStore);

const WEEKDAY_LABELS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

const rates = computed<number[]>(() => {
  const raw = insights.value?.weekdayRates ?? [];
  const out: number[] = [];
  for (let i = 0; i < 7; i += 1) {
    const v = raw[i];
    const n = typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(100, Math.round(v))) : 0;
    out.push(n);
  }
  return out;
});

const hasData = computed(() => rates.value.some((r) => r > 0));

const avgRate = computed(() => {
  const nonZero = rates.value.filter((r) => r > 0);
  if (!nonZero.length) return 0;
  return Math.round(nonZero.reduce((s, v) => s + v, 0) / nonZero.length);
});

const peakIndex = computed<number>(() => {
  const r = rates.value;
  let best = -1;
  let bestIdx = -1;
  for (let i = 0; i < r.length; i += 1) {
    if (r[i] > best) {
      best = r[i];
      bestIdx = i;
    }
  }
  return bestIdx;
});

const troughIndex = computed<number>(() => {
  const r = rates.value;
  const nonZero = r
    .map((v, i) => ({ v, i }))
    .filter((x) => x.v > 0);
  if (!nonZero.length) return -1;
  let worstVal = Infinity;
  let worstIdx = -1;
  for (const { v, i } of nonZero) {
    if (v < worstVal) {
      worstVal = v;
      worstIdx = i;
    }
  }
  // Suppress the trough accent when it's the same day as the peak.
  return worstIdx === peakIndex.value ? -1 : worstIdx;
});

function isPeak(i: number) {
  return i === peakIndex.value && rates.value[i] > 0;
}
function isTrough(i: number) {
  return i === troughIndex.value && rates.value[i] > 0;
}
</script>

<style scoped>
.weekday__empty {
  font-size: 0.7rem;
  letter-spacing: 0.1em;
  color: var(--pp-muted);
  padding: 1.25rem 0.5rem;
  text-align: center;
}

.weekday__grid {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.weekday__row {
  display: grid;
  grid-template-columns: 36px 1fr 44px;
  align-items: center;
  gap: 0.5rem;
}

.weekday__name {
  font-size: 0.6rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--pp-muted);
}

.weekday__bar {
  height: 8px;
  background: var(--pp-void);
  border: 1px solid var(--pp-line);
  position: relative;
  overflow: hidden;
}

.weekday__fill {
  height: 100%;
  background: var(--pp-cyan);
  transition: width 0.2s ease;
}

.weekday__row--peak .weekday__fill {
  background: var(--pp-cyan);
}

.weekday__row--peak .weekday__name,
.weekday__row--peak .weekday__value {
  color: var(--pp-cyan);
}

.weekday__row--peak .weekday__bar {
  border-color: var(--pp-cyan);
}

.weekday__row--trough .weekday__fill {
  background: var(--pp-muted);
}

.weekday__row--trough .weekday__name,
.weekday__row--trough .weekday__value {
  color: var(--pp-muted);
}

.weekday__value {
  font-family: "Space Grotesk", system-ui, sans-serif;
  font-weight: 700;
  font-size: 0.7rem;
  color: var(--pp-text);
  text-align: right;
}
</style>