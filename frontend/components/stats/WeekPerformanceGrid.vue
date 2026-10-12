<template>
  <div>
    <div class="section-header">
      <h2>📊 WEEKLY PERFORMANCE</h2>
    </div>
    <div class="week-grid">
      <StatCard
        v-for="week in statistics?.weekStats || []"
        :key="week.weekUuid"
        :title="week.weekName"
        :value="`${week.progress}%`"
        :subtitle="`${week.requiredCompleted}/${week.requiredTotal} Tasks`"
        icon="🏰"
        :rank="getWeekRank(week)"
      />
    </div>
  </div>
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

<style scoped lang="scss">
.section-header {
  margin-top: 1rem;
}

.section-header h2 {
  font-family: 'Press Start 2P', cursive;
  font-size: 1rem;
  color: var(--pp-gold-acc);
  text-shadow: 2px 2px 0 #000;
  padding-bottom: 0.5rem;
  border-bottom: 3px solid var(--pp-gold-acc);
}

.week-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
}
</style>