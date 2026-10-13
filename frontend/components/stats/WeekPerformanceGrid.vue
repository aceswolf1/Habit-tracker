<!--
  WeekPerformanceGrid.vue (W1 restyle, V2 Combat Deck).

  Grid of 4 StatCard tiles, one per week of the finished cycle.
  Best/Worst weeks receive the amber / danger accent. The header is
  the V2 section header style (mono caps with cyan accent rule).
-->
<template>
  <section class="wpg">
    <h2 class="wpg__header font-display">WEEKLY PERFORMANCE</h2>
    <div class="wpg__grid">
      <StatCard
        v-for="week in statistics?.weekStats || []"
        :key="week.weekUuid"
        :title="week.weekName"
        :value="`${week.progress}%`"
        :subtitle="`${week.requiredCompleted}/${week.requiredTotal} Tasks`"
        icon="▦"
        :rank="getWeekRank(week)"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import StatCard from '../StatCard.vue';

const props = defineProps<{
  statistics: any;
}>();

function getWeekRank(week: any) {
  if (week.weekUuid === props.statistics?.bestWeek?.weekUuid) return 'best';
  if (week.weekUuid === props.statistics?.worstWeek?.weekUuid) return 'worst';
  return null;
}
</script>

<style scoped>
.wpg {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.wpg__header {
  font-family: "Space Grotesk", system-ui, sans-serif;
  font-weight: 700;
  font-size: 0.9rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--pp-cyan);
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--pp-line);
}

.wpg__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.75rem;
}

@media (min-width: 1024px) {
  .wpg__grid {
    grid-template-columns: repeat(4, 1fr);
  }
}
</style>