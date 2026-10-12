<template>
  <div class="highlights-grid">
    <StatCard
      title="Best Week"
      :value="statistics?.bestWeek?.weekName || 'N/A'"
      :subtitle="`${statistics?.bestWeek?.progress || 0}% Complete`"
      icon="🏆"
      rank="best"
    />
    <StatCard
      title="Worst Week"
      :value="statistics?.worstWeek?.weekName || 'N/A'"
      :subtitle="`${statistics?.worstWeek?.progress || 0}% Complete`"
      icon="⚠️"
      rank="worst"
    />
    <StatCard
      title="Consistency"
      :value="consistencyScore"
      :subtitle="`Std Dev: ${statistics?.weekConsistency?.toFixed(1) || 0}`"
      icon="📈"
      color="#8b5cf6"
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

<style scoped lang="scss">
.highlights-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
}
</style>