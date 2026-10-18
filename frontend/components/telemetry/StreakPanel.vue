<!--
  StreakPanel.vue (v2.2 / W3).

  Panel 4 of TelemetryView. Rollups from
  `insights.perfectDays` (`current`, `longest`) and
  `insights.finishedMonths` (`total`, `streak`).
-->
<template>
  <UiPpPanel padded tag="section" data-pp-telemetry-streaks>
    <template #header>
      <div class="flex items-center justify-between w-full">
        <span class="font-display text-headline-sm text-pp-cyan uppercase tracking-wider">
          Streaks
        </span>
        <span class="text-label-sm text-pp-muted">ROLLUPS</span>
      </div>
    </template>

    <div class="streak__group">
      <div class="streak__group-head font-display">PERFECT DAYS</div>
      <div class="streak__row">
        <div class="streak__tile">
          <div class="streak__tile-label font-mono">CURRENT</div>
          <div class="streak__tile-value font-display">
            {{ perfect.current }}
          </div>
          <div class="streak__tile-sub font-mono">
            {{ perfect.current === 1 ? "DAY" : "DAYS" }}
          </div>
        </div>
        <div class="streak__tile streak__tile--best">
          <div class="streak__tile-label font-mono">BEST</div>
          <div class="streak__tile-value font-display">
            {{ perfect.longest }}
          </div>
          <div class="streak__tile-sub font-mono">
            {{ perfect.longest === 1 ? "DAY" : "DAYS" }}
          </div>
        </div>
      </div>
    </div>

    <div class="streak__group">
      <div class="streak__group-head font-display">FINISHED MONTHS</div>
      <div class="streak__row">
        <div class="streak__tile">
          <div class="streak__tile-label font-mono">TOTAL</div>
          <div class="streak__tile-value font-display">
            {{ finished.total }}
          </div>
          <div class="streak__tile-sub font-mono">
            {{ finished.total === 1 ? "CYCLE" : "CYCLES" }}
          </div>
        </div>
        <div class="streak__tile streak__tile--best">
          <div class="streak__tile-label font-mono">STREAK</div>
          <div class="streak__tile-value font-display">
            {{ finished.streak }}
          </div>
          <div class="streak__tile-sub font-mono">
            {{ finished.streak === 1 ? "IN A ROW" : "IN A ROW" }}
          </div>
        </div>
      </div>
    </div>
  </UiPpPanel>
</template>

<script setup lang="ts">
/*
 * Reads `monthStore.insights.perfectDays` and `…finishedMonths`.
 * Each rollup renders two stat tiles ("current"/"best" for perfect
 * days, "total"/"streak" for finished months).
 */

import { computed } from "vue";
import { storeToRefs } from "pinia";
import { useMonthStore } from "../../stores/monthStore";
import UiPpPanel from "../ui/PpPanel.vue";

const monthStore = useMonthStore();
const { insights } = storeToRefs(monthStore);

const perfect = computed(() => insights.value?.perfectDays ?? { current: 0, longest: 0 });
const finished = computed(() => insights.value?.finishedMonths ?? { total: 0, streak: 0 });
</script>

<style scoped>
.streak__group {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 0.25rem 0;
}

.streak__group + .streak__group {
  border-top: 1px solid var(--pp-line);
  margin-top: 0.25rem;
  padding-top: 0.75rem;
}

.streak__group-head {
  font-family: "Space Grotesk", system-ui, sans-serif;
  font-weight: 700;
  font-size: 0.7rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--pp-muted);
}

.streak__row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem;
}

.streak__tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 0.15rem;
  padding: 0.7rem 0.5rem;
  background: var(--pp-card);
  border: 1px solid var(--pp-line);
}

.streak__tile--best {
  border-color: var(--pp-cyan);
  background: var(--pp-card-active);
}

.streak__tile-label {
  font-size: 0.55rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--pp-muted);
}

.streak__tile-value {
  font-family: "Space Grotesk", system-ui, sans-serif;
  font-weight: 700;
  font-size: 1.4rem;
  color: var(--pp-text);
  line-height: 1;
}

.streak__tile--best .streak__tile-value {
  color: var(--pp-cyan);
}

.streak__tile-sub {
  font-size: 0.6rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--pp-muted);
}
</style>