<!--
  TaskInsightsGrid.vue (W1 restyle, V2 Combat Deck).

  Four-tile summary of required / optional / legendary / overall task
  counts. Uses the same V2 StatCard pattern as the other sections.
-->
<template>
  <section class="tig">
    <h2 class="tig__header font-display">TASK INSIGHTS</h2>
    <div class="tig__grid">
      <StatCard
        title="Required Tasks"
        :value="`${statistics?.requiredTasksCompleted || 0}/${statistics?.requiredTasksTotal || 0}`"
        :subtitle="`${statistics?.requiredCompletionRate || 0}% Complete`"
        icon="⚡"
      />
      <StatCard
        title="Optional Tasks"
        :value="`${statistics?.optionalTasksCompleted || 0}/${statistics?.optionalTasksTotal || 0}`"
        :subtitle="`${statistics?.optionalCompletionRate || 0}% Complete`"
        icon="◇"
      />
      <StatCard
        title="Legendary Tasks"
        :value="statistics?.legendaryTasksCompleted || 0"
        subtitle="3x XP Earned"
        icon="★"
      />
      <StatCard
        title="Overall Rate"
        :value="`${statistics?.taskCompletionRate || 0}%`"
        :subtitle="`${statistics?.completedTasks || 0}/${statistics?.totalTasks || 0} Total`"
        icon="◉"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import StatCard from '../StatCard.vue';

defineProps<{
  statistics: any;
}>();
</script>

<style scoped>
.tig {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.tig__header {
  font-family: "Space Grotesk", system-ui, sans-serif;
  font-weight: 700;
  font-size: 0.9rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--pp-cyan);
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--pp-line);
}

.tig__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 0.75rem;
}

@media (min-width: 1024px) {
  .tig__grid {
    grid-template-columns: repeat(4, 1fr);
  }
}
</style>