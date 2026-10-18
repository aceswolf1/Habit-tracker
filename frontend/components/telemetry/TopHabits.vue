<!--
  TopHabits.vue (v2.2 / W3).

  Panel 3 of TelemetryView. Top 20 habits by total completions, with
  current strike (via `comboName`) + best strike. Habit names are
  truncated to fit the panel; descriptions show the canonical habit
  name from `insights.habits[i].name`.
-->
<template>
  <UiPpPanel padded tag="section" data-pp-telemetry-top-habits>
    <template #header>
      <div class="flex items-center justify-between w-full">
        <span class="font-display text-headline-sm text-pp-cyan uppercase tracking-wider">
          Top Habits
        </span>
        <span class="text-label-sm text-pp-muted">
          TOP {{ habits.length }} BY COMPLETIONS
        </span>
      </div>
    </template>

    <div v-if="!habits.length" class="tth__empty font-mono">
      NO COMPLETED HABITS YET.
    </div>

    <div v-else class="tth__table-wrap">
      <table class="tth__table font-mono" role="table">
        <thead>
          <tr class="tth__thead-row">
            <th class="tth__th tth__th--name" scope="col">HABIT</th>
            <th class="tth__th tth__th--num" scope="col">DONE</th>
            <th class="tth__th tth__th--strike" scope="col">STRIKE</th>
            <th class="tth__th tth__th--strike" scope="col">BEST</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(h, i) in habits"
            :key="h.habitKey"
            class="tth__row"
            :class="{ 'tth__row--peak': i === 0 }"
          >
            <td class="tth__td tth__td--name">
              <span class="tth__name" :title="h.name">{{ truncate(h.name, 26) }}</span>
            </td>
            <td class="tth__td tth__td--num">{{ h.completions }}</td>
            <td class="tth__td tth__td--strike">
              <UiPpBadge :kind="h.currentCombo >= 2 ? 'legendary' : 'common'">
                {{ currentLabel(h) }}
              </UiPpBadge>
            </td>
            <td class="tth__td tth__td--strike">
              <UiPpBadge :kind="h.bestCombo >= 2 ? 'legendary' : 'common'">
                {{ bestLabel(h) }}
              </UiPpBadge>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </UiPpPanel>
</template>

<script setup lang="ts">
/*
 * Reads `monthStore.insights.habits` (top 20 by completions; the BE
 * already sorts and trims). Each row has habit name, completions, a
 * "current strike" derived from `currentCombo` (via `comboName`) and a
 * "best strike" from `bestCombo`. Empty habits array → empty state.
 */

import { computed } from "vue";
import { storeToRefs } from "pinia";
import { useMonthStore } from "../../stores/monthStore";
import { comboName } from "../../utils/sharedCombos";
import UiPpPanel from "../ui/PpPanel.vue";
import UiPpBadge from "../ui/PpBadge.vue";

const monthStore = useMonthStore();
const { insights } = storeToRefs(monthStore);

const habits = computed(() => insights.value?.habits ?? []);

function truncate(s: string, max: number): string {
  if (!s) return "—";
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

function currentLabel(h: { currentCombo: number }) {
  return comboName(h.currentCombo) ?? "—";
}

function bestLabel(h: { bestCombo: number }) {
  return comboName(h.bestCombo) ?? "—";
}
</script>

<style scoped>
.tth__empty {
  font-size: 0.7rem;
  letter-spacing: 0.1em;
  color: var(--pp-muted);
  padding: 1.25rem 0.5rem;
  text-align: center;
}

.tth__table-wrap {
  overflow-x: auto;
  /* Make sure the panel never horizontally scrolls its parent. */
}

.tth__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.7rem;
}

.tth__thead-row {
  text-align: left;
}

.tth__th {
  font-family: "JetBrains Mono", ui-monospace, monospace;
  font-weight: 700;
  font-size: 0.55rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--pp-muted);
  padding: 0.25rem 0.4rem;
  border-bottom: 1px solid var(--pp-line);
}

.tth__th--num,
.tth__th--strike {
  text-align: center;
  white-space: nowrap;
}

.tth__row {
  border-bottom: 1px solid var(--pp-line);
}

.tth__row:last-child {
  border-bottom: 0;
}

.tth__row--peak .tth__td--name {
  color: var(--pp-cyan);
}

.tth__td {
  padding: 0.4rem 0.4rem;
  color: var(--pp-text);
  vertical-align: middle;
}

.tth__td--name {
  min-width: 0;
}

.tth__td--num {
  text-align: center;
  color: var(--pp-text);
  font-family: "Space Grotesk", system-ui, sans-serif;
  font-weight: 700;
}

.tth__td--strike {
  text-align: center;
}

.tth__name {
  display: inline-block;
  max-width: 100%;
  text-overflow: ellipsis;
  white-space: nowrap;
  overflow: hidden;
  vertical-align: middle;
}

/*
 * Override PpBadge's default palette to make STRIKE rows read as a
 * magenta combo badge. We use `legendary` as the closest existing kind
 * (it already paints magenta) — the deep selectors below nudge it to
 * the W2 contract look (slightly different magenta wash, fixed border).
 */
.tth__td--strike :deep(.pp-badge) {
  border-color: var(--pp-magenta);
  background: rgba(255, 0, 127, 0.18);
  color: var(--pp-magenta);
}

.tth__td--strike :deep(.pp-badge--common) {
  border-color: var(--pp-line);
  background: var(--pp-card);
  color: var(--pp-muted);
}

@media (max-width: 639.98px) {
  .tth__table {
    font-size: 0.65rem;
  }
  .tth__th,
  .tth__td {
    padding: 0.35rem 0.3rem;
  }
}
</style>