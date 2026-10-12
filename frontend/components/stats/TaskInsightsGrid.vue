<template>
  <div>
    <div class="section-header">
      <h2>✅ TASK INSIGHTS</h2>
    </div>
    <div class="task-stats-grid">
      <StatCard
        title="Required Tasks"
        :value="`${statistics?.requiredTasksCompleted || 0}/${statistics?.requiredTasksTotal || 0}`"
        :subtitle="`${statistics?.requiredCompletionRate || 0}% Complete`"
        icon="⚡"
        color="#ef4444"
      />
      <StatCard
        title="Optional Tasks"
        :value="`${statistics?.optionalTasksCompleted || 0}/${statistics?.optionalTasksTotal || 0}`"
        :subtitle="`${statistics?.optionalCompletionRate || 0}% Complete`"
        icon="💎"
        color="#3b82f6"
      />
      <StatCard
        title="Legendary Tasks"
        :value="statistics?.legendaryTasksCompleted || 0"
        subtitle="3x XP Earned"
        icon="👑"
        color="#fbbf24"
      />
      <StatCard
        title="Overall Rate"
        :value="`${statistics?.taskCompletionRate || 0}%`"
        :subtitle="`${statistics?.completedTasks || 0}/${statistics?.totalTasks || 0} Total`"
        icon="📋"
        color="#10b981"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import StatCard from '../StatCard.vue';

defineProps<{
  statistics: any;
}>();
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

.task-stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}
</style>