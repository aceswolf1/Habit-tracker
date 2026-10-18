<!--
  TelemetryView.vue (v2.2 / W3).

  Cross-month analytics page. Composes four panels:
    1. MonthTrend   — per-month progress % + score line (chronological).
    2. WeekdayRates — 7 bars Mon..Sun with % completion.
    3. TopHabits    — top 20 habits by completions + current/best strike.
    4. StreakPanel  — perfect days (current/best) + finished-month streak.

  Reads `insights` from `monthStore` and triggers `fetchInsights()` on
  mount + listens to `monthFinished` (refreshes after a finish). Inline
  SVG only, V2 Combat Deck look, responsive (phone stacked, ≥lg 2-col).
-->
<template>
  <div class="telemetry-view">
    <header class="telemetry-view__header">
      <div class="telemetry-view__title-block">
        <span class="telemetry-view__eyebrow font-mono">COMBAT DECK // TELEMETRY</span>
        <h1 class="telemetry-view__title font-display">LONG-TERM INTEL</h1>
        <p class="telemetry-view__subtitle font-mono">
          Cross-month trends, top habits and streak rollups.
        </p>
      </div>
      <button
        type="button"
        class="telemetry-view__refresh font-mono"
        :disabled="loading"
        @click="onRefresh"
        title="Refresh insights"
        data-pp-telemetry-refresh
      >
        <UiPpIcon name="refresh" :size="14" />
        <span>{{ loading ? "LOADING…" : "REFRESH" }}</span>
      </button>
    </header>

    <div v-if="loading && !insights" class="telemetry-view__loading font-mono">
      LOADING TELEMETRY…
    </div>

    <div v-else-if="!hasAnyData" class="telemetry-view__empty">
      <UiPpPanel padded>
        <div class="telemetry-view__empty-body">
          <UiPpIcon name="insights" :size="22" />
          <h2 class="telemetry-view__empty-title font-display">NO INTEL YET</h2>
          <p class="telemetry-view__empty-text font-mono">
            Complete a few habits across at least one day and the
            telemetry page will start collecting trends, weekday
            completion rates, top habits and streak rollups here.
          </p>
        </div>
      </UiPpPanel>
    </div>

    <div v-else class="telemetry-view__grid">
      <TelemetryMonthTrend />
      <TelemetryWeekdayRates />
      <TelemetryTopHabits />
      <TelemetryStreakPanel />
    </div>
  </div>
</template>

<script setup lang="ts">
/*
 * V2.2 (W3) Telemetry page. The page is a thin composition layer over
 * the four panel components; it owns the loading / empty / refresh logic
 * and the responsive grid. Data comes from `useMonthStore().insights`,
 * already populated by `fetchMonthDataAction` on first app load (W1)
 * and refreshed on every task toggle / month finish (debounced 1 s by
 * the store). A mount-time `fetchInsights()` guarantees freshness when
 * the user navigates directly to /telemetry before any toggle has
 * happened in this session.
 */

import { computed, onBeforeUnmount, onMounted } from "vue";
import { storeToRefs } from "pinia";
import { useMonthStore } from "../../stores/monthStore";
import { onAppEvent } from "../../composables/useAppEvents";
import UiPpIcon from "../ui/PpIcon.vue";
import UiPpPanel from "../ui/PpPanel.vue";
import TelemetryMonthTrend from "./MonthTrend.vue";
import TelemetryWeekdayRates from "./WeekdayRates.vue";
import TelemetryTopHabits from "./TopHabits.vue";
import TelemetryStreakPanel from "./StreakPanel.vue";

const monthStore = useMonthStore();
const { insights } = storeToRefs(monthStore);

// Treat the panel as loading on first paint; clears as soon as insights
// arrives. Subsequent fetches don't gate the UI (debounced refresh).
const loading = computed(() => monthStore.isLoading && !insights.value);

const hasAnyData = computed(() => {
  const i = insights.value;
  if (!i) return false;
  // Considered "no data" only when EVERY bucket is empty / zero.
  const months = i.months?.length ?? 0;
  const habits = i.habits?.length ?? 0;
  const combatLog = i.combatLog?.length ?? 0;
  const weekdayMax = Math.max(0, ...(i.weekdayRates || [0]));
  const perfect = (i.perfectDays?.current || 0) + (i.perfectDays?.longest || 0);
  const finished = (i.finishedMonths?.total || 0) + (i.finishedMonths?.streak || 0);
  return (
    months > 0 ||
    habits > 0 ||
    combatLog > 0 ||
    weekdayMax > 0 ||
    perfect > 0 ||
    finished > 0
  );
});

async function onRefresh() {
  await monthStore.fetchInsights();
}

// SSR-safe: the page is rendered on the server too (preview can capture
// the empty shell via screenshot). We always attempt a fetch on mount
// so the user doesn't have to refresh manually.
const refreshAfterFinish = onAppEvent("monthFinished", () => {
  void monthStore.fetchInsights();
});

onMounted(() => {
  void monthStore.fetchInsights();
});

onBeforeUnmount(() => {
  refreshAfterFinish();
});
</script>

<style scoped>
.telemetry-view {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  min-width: 0;
}

.telemetry-view__header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.telemetry-view__title-block {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  min-width: 0;
}

.telemetry-view__eyebrow {
  font-size: 0.55rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--pp-muted);
}

.telemetry-view__title {
  font-family: "Space Grotesk", system-ui, sans-serif;
  font-weight: 700;
  font-size: 1.1rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--pp-cyan);
  margin: 0;
}

.telemetry-view__subtitle {
  font-size: 0.7rem;
  color: var(--pp-muted);
}

.telemetry-view__refresh {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.7rem;
  font-size: 0.6rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--pp-cyan);
  background: var(--pp-card);
  border: 1px solid var(--pp-line);
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}

.telemetry-view__refresh:hover:not(:disabled) {
  background: var(--pp-card-active);
  border-color: var(--pp-cyan);
}

.telemetry-view__refresh:disabled {
  opacity: 0.55;
  cursor: progress;
}

.telemetry-view__loading {
  padding: 2rem 1rem;
  text-align: center;
  font-size: 0.7rem;
  letter-spacing: 0.12em;
  color: var(--pp-muted);
  border: 1px dashed var(--pp-line);
  background: var(--pp-card);
}

.telemetry-view__empty-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 0.5rem;
  color: var(--pp-muted);
  padding: 1rem 0.5rem;
}

.telemetry-view__empty-title {
  font-family: "Space Grotesk", system-ui, sans-serif;
  font-weight: 700;
  font-size: 1rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--pp-text);
  margin: 0;
}

.telemetry-view__empty-text {
  font-size: 0.75rem;
  line-height: 1.5;
  max-width: 36rem;
}

.telemetry-view__grid {
  display: grid;
  gap: 0.75rem;
  grid-template-columns: 1fr;
}

@media (min-width: 1024px) {
  .telemetry-view__grid {
    grid-template-columns: 1fr 1fr;
  }
}
</style>