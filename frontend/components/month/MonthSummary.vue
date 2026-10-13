<!--
  MonthSummary.vue (W1 restyle, V2 Combat Deck).

  Sidebar Stats roll-up of the active cycle: month title + progress +
  per-week summary cards. Sharp borders, mono body, cyan accent rule.
-->
<template>
  <section v-if="month" class="month-summary">
    <header class="ms-header">
      <h1 class="ms-title font-display">{{ month.name }} — {{ month.subtitle }}</h1>
      <div class="ms-progress-row font-mono">
        <span class="ms-progress-bar">
          <span class="ms-progress-fill" :style="{ width: `${month.progress || 0}%` }"></span>
        </span>
        <span class="ms-progress-pct">{{ month.progress || 0 }}%</span>
      </div>
    </header>

    <div class="ms-weeks">
      <article
        v-for="week in month.weeks"
        :key="week.uuid"
        class="ms-week"
      >
        <header class="ms-week__head">
          <h2 class="ms-week__name font-display">{{ week.name }} — {{ week.subtitle }}</h2>
        </header>
        <div class="ms-week__bar font-mono">
          <span class="ms-week__bar-track">
            <span class="ms-week__bar-fill" :style="{ width: `${week.progress || 0}%` }"></span>
          </span>
          <span class="ms-week__bar-pct">{{ week.progress || 0 }}%</span>
        </div>
        <p class="ms-week__meta font-mono">
          {{ week.days.length }} DAYS · {{ getTotalTasksInWeek(week) }} TOTAL · {{ getCompletedTasksInWeek(week) }} COMPLETED
        </p>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
import { storeToRefs } from "pinia";
import { useMonthStore } from "../../stores/monthStore";
import { Week } from "../../types";

const monthStore = useMonthStore();
const { currentMonth: month } = storeToRefs(monthStore);

const getTotalTasksInWeek = (week: Week): number => {
  return week.days.reduce((total, day) => total + day.tasks.length, 0);
};

const getCompletedTasksInWeek = (week: Week): number => {
  return week.days.reduce((total, day) => {
    return total + day.tasks.filter((task) => task.completed).length;
  }, 0);
};
</script>

<style scoped>
.month-summary {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-width: 1000px;
}

.ms-header {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--pp-line);
}

.ms-title {
  font-family: "Space Grotesk", system-ui, sans-serif;
  font-weight: 700;
  font-size: 1.1rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--pp-cyan);
}

.ms-progress-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.7rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.ms-progress-bar {
  flex: 1;
  height: 6px;
  background: var(--pp-panel);
  border: 1px solid var(--pp-line);
  overflow: hidden;
}

.ms-progress-fill {
  display: block;
  height: 100%;
  background: var(--pp-cyan);
}

.ms-progress-pct {
  color: var(--pp-text);
  font-weight: 700;
}

.ms-weeks {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 0.75rem;
}

.ms-week {
  background: var(--pp-card);
  border: 1px solid var(--pp-line);
  padding: 0.85rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}

.ms-week:hover {
  background: var(--pp-card-active);
  border-color: var(--pp-cyan);
}

.ms-week__head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.ms-week__name {
  font-family: "Space Grotesk", system-ui, sans-serif;
  font-weight: 700;
  font-size: 0.8rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--pp-text);
}

.ms-week__bar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.65rem;
  letter-spacing: 0.08em;
}

.ms-week__bar-track {
  flex: 1;
  height: 4px;
  background: var(--pp-panel);
  border: 1px solid var(--pp-line);
  overflow: hidden;
}

.ms-week__bar-fill {
  display: block;
  height: 100%;
  background: var(--pp-cyan);
}

.ms-week__bar-pct {
  color: var(--pp-muted);
  font-weight: 700;
}

.ms-week__meta {
  font-size: 0.6rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--pp-muted);
}
</style>