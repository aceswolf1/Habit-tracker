<!--
  HighlightsGrid.vue (W1 restyle, V2 Combat Deck).

  Three-tile highlight row: Best Week, Worst Week, Consistency. Uses
  StatCard with the `best`/`worst` rank accents already wired in.
-->
<template>
  <div class="highlights-grid">
    <StatCard
      title="Best Week"
      :value="statistics?.bestWeek?.weekName || 'N/A'"
      :subtitle="`${statistics?.bestWeek?.progress || 0}% Complete`"
      icon="◈"
      rank="best"
    />
    <StatCard
      title="Worst Week"
      :value="statistics?.worstWeek?.weekName || 'N/A'"
      :subtitle="`${statistics?.worstWeek?.progress || 0}% Complete`"
      icon="▽"
      rank="worst"
    />
    <StatCard
      title="Consistency"
      :value="consistencyScore"
      :subtitle="`Std Dev: ${(statistics?.weekConsistency || 0).toFixed(1)}`"
      icon="⌬"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import StatCard from '../StatCard.vue';

const props = defineProps<{
  statistics: any;
}>();

const consistencyScore = computed(() => {
  const stdDev = props.statistics?.weekConsistency || 0;
  if (stdDev < 10) return 'Excellent';
  if (stdDev < 20) return 'Good';
  if (stdDev < 30) return 'Fair';
  return 'Variable';
});
</script>

<style scoped>
.highlights-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 0.75rem;
}

@media (min-width: 1024px) {
  .highlights-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
</style>