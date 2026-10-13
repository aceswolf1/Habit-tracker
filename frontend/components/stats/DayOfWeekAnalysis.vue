<!--
  DayOfWeekAnalysis.vue (W1 restyle, V2 Combat Deck).

  7-column grid of day-of-week averages. Each tile shows the day name,
  a 4px progress bar, the completion %, and a perfect-days badge.
  Best/Worst day tiles get amber / danger borders.
-->
<template>
  <section class="dow">
    <h2 class="dow__header font-display">DAY OF WEEK ANALYSIS</h2>
    <div class="dow__grid">
      <div
        v-for="day in statistics?.dayOfWeekStats || []"
        :key="day.dayName"
        class="dow__tile"
        :class="{
          'dow__tile--best': isBestDay(day.dayName),
          'dow__tile--worst': isWorstDay(day.dayName),
        }"
      >
        <div class="dow__name font-mono">{{ day.dayName.substring(0, 3).toUpperCase() }}</div>
        <div class="dow__bar">
          <div class="dow__fill" :style="{ width: day.averageCompletion + '%' }"></div>
        </div>
        <div class="dow__value font-display">{{ day.averageCompletion }}%</div>
        <div v-if="day.perfectDays > 0" class="dow__perfect font-mono">✦ {{ day.perfectDays }}</div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
const props = defineProps<{
  statistics: any;
}>();

function isBestDay(dayName: string) {
  return dayName === props.statistics?.bestDayOfWeek?.dayName;
}
function isWorstDay(dayName: string) {
  return dayName === props.statistics?.worstDayOfWeek?.dayName;
}
</script>

<style scoped>
.dow {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.dow__header {
  font-family: "Space Grotesk", system-ui, sans-serif;
  font-weight: 700;
  font-size: 0.9rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--pp-cyan);
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--pp-line);
}

.dow__grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 0.5rem;
}

@media (max-width: 639.98px) {
  .dow__grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

.dow__tile {
  background: var(--pp-card);
  border: 1px solid var(--pp-line);
  padding: 0.6rem 0.4rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  min-width: 0;
}

.dow__tile--best {
  border-color: var(--pp-amber);
}
.dow__tile--worst {
  border-color: var(--pp-danger);
}

.dow__name {
  font-size: 0.6rem;
  letter-spacing: 0.12em;
  color: var(--pp-amber);
  text-transform: uppercase;
  font-weight: 700;
}

.dow__bar {
  width: 100%;
  height: 4px;
  background: var(--pp-void);
  border: 1px solid var(--pp-line);
  overflow: hidden;
}

.dow__fill {
  height: 100%;
  background: var(--pp-cyan);
}

.dow__value {
  font-family: "Space Grotesk", system-ui, sans-serif;
  font-weight: 700;
  font-size: 0.75rem;
  color: var(--pp-text);
}

.dow__perfect {
  font-size: 0.55rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--pp-amber);
}
</style>