<template>
  <!--
    Sidebar Stats section for an unfinished month (contract §3).
    Renders a short panel that mirrors the existing MonthSummary plus
    the contract-mandated "unlock on finish" note + a list of finished
    months to open. We do NOT compute any new statistics — the heavy
    stats view only unlocks when the user finishes a month.
  -->
  <div class="stats-unfinished">
    <PpPanel glow="cyan" tag="section">
      <template #header>STATS</template>

      <div class="stats-unfinished__body">
        <div class="stats-unfinished__row">
          <span class="stats-unfinished__label">CYCLE</span>
          <span class="stats-unfinished__value">{{ currentMonth?.name || "—" }}</span>
        </div>
        <div class="stats-unfinished__row">
          <span class="stats-unfinished__label">PROGRESS</span>
          <span class="stats-unfinished__value">{{ progress }}%</span>
        </div>
        <div class="stats-unfinished__row">
          <span class="stats-unfinished__label">SCORE</span>
          <span class="stats-unfinished__value">{{ currentMonth?.score || 0 }} XP</span>
        </div>

        <div class="stats-unfinished__divider"></div>

        <p class="stats-unfinished__note">
          Full statistics unlock when you finish the cycle. Keep going —
          the analytics dashboard builds itself from completed weeks.
        </p>

        <UiPpSegmentedProgress
          :value="progress"
          color="cyan"
          :height="6"
        />
      </div>
    </PpPanel>

    <PpPanel tag="section" :padded="true">
      <template #header>FINISHED CYCLES</template>
      <div v-if="!finishedMonths.length" class="stats-unfinished__empty">
        No completed cycles yet.
      </div>
      <div v-else class="stats-unfinished__finished">
        <button
          v-for="m in finishedMonths"
          :key="m.uuid"
          type="button"
          class="stats-unfinished__finished-row"
          :class="{ 'stats-unfinished__finished-row--current': m.uuid === currentMonthUuid }"
          @click="emit('selectMonth', m.uuid)"
        >
          <span class="stats-unfinished__finished-name">{{ m.name }}</span>
          <UiPpBadge kind="done">FINISHED</UiPpBadge>
        </button>
      </div>
    </PpPanel>
  </div>
</template>

<script setup lang="ts">
/*
 * V2 sidebar Stats panel for an unfinished month (contract §3).
 * Renders the current cycle's progress + a "unlock on finish" note +
 * a list of finished cycles to open. Pure presentational.
 */

import { computed } from "vue";
import UiPpSegmentedProgress from "../ui/PpSegmentedProgress.vue";
import UiPpBadge from "../ui/PpBadge.vue";
import PpPanel from "../ui/PpPanel.vue";

const props = defineProps<{
  currentMonth: any;
  months: Array<{ uuid: string; name: string; finished: boolean }>;
  currentMonthUuid: string | null;
}>();

const emit = defineEmits<{
  (e: "selectMonth", uuid: string): void;
}>();

const progress = computed(() =>
  Math.max(0, Math.min(100, props.currentMonth?.progress || 0)),
);

const finishedMonths = computed(() =>
  props.months.filter((m) => m.finished),
);
</script>

<style scoped>
.stats-unfinished {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  max-width: 640px;
}

.stats-unfinished__body {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.stats-unfinished__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.stats-unfinished__label {
  font-family: "JetBrains Mono", ui-monospace, monospace;
  font-weight: 700;
  font-size: 0.7rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--pp-muted);
}

.stats-unfinished__value {
  font-family: "JetBrains Mono", ui-monospace, monospace;
  font-weight: 700;
  font-size: 0.85rem;
  color: var(--pp-cyan);
}

.stats-unfinished__divider {
  height: 1px;
  background: var(--pp-line);
  margin: 0.25rem 0;
}

.stats-unfinished__note {
  font-family: "JetBrains Mono", ui-monospace, monospace;
  font-size: 0.75rem;
  line-height: 1.5;
  color: var(--pp-muted);
  margin: 0 0 0.25rem 0;
}

.stats-unfinished__empty {
  font-family: "JetBrains Mono", ui-monospace, monospace;
  font-size: 0.75rem;
  color: var(--pp-muted);
}

.stats-unfinished__finished {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.stats-unfinished__finished-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.5rem;
  background: var(--pp-card);
  border: 1px solid var(--pp-line);
  cursor: pointer;
  font-family: "JetBrains Mono", ui-monospace, monospace;
  font-size: 0.8rem;
  text-align: left;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}

.stats-unfinished__finished-row:hover {
  background: var(--pp-card-active);
  border-color: var(--pp-cyan);
}

.stats-unfinished__finished-row--current {
  border-color: var(--pp-cyan);
}

.stats-unfinished__finished-name {
  flex: 1 1 auto;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--pp-text);
}
</style>
