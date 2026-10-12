<template>
  <div class="habits-grid">
    <div class="habit-card best-habit" v-if="statistics?.bestHabit">
      <div class="habit-header">
        <span class="habit-badge">BEST HABIT</span>
      </div>
      <div class="habit-icon">{{ statistics.bestHabit.icon || '⭐' }}</div>
      <div class="habit-name">{{ statistics.bestHabit.description }}</div>
      <div class="habit-stat">
        <span class="habit-rate">{{ statistics.bestHabit.completionRate }}%</span>
        <span class="habit-count">{{ statistics.bestHabit.timesCompleted }}/{{ statistics.bestHabit.timesAppeared }}</span>
      </div>
    </div>

    <div class="habit-card worst-habit" v-if="statistics?.worstHabit">
      <div class="habit-header">
        <span class="habit-badge">NEEDS WORK</span>
      </div>
      <div class="habit-icon">{{ statistics.worstHabit.icon || '💪' }}</div>
      <div class="habit-name">{{ statistics.worstHabit.description }}</div>
      <div class="habit-stat">
        <span class="habit-rate">{{ statistics.worstHabit.completionRate }}%</span>
        <span class="habit-count">{{ statistics.worstHabit.timesCompleted }}/{{ statistics.worstHabit.timesAppeared }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  statistics: any;
}>();
</script>

<style scoped lang="scss">
.habits-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1rem;
}

.habit-card {
  background-color: rgba(26, 32, 44, 0.9);
  border: 3px solid;
  padding: 1.5rem;
  box-shadow: 4px 4px 0 rgba(0, 0, 0, 0.8);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  text-align: center;
}

.best-habit {
  border-color: var(--pp-gold);
  box-shadow: 4px 4px 0 rgba(0, 0, 0, 0.8), 0 0 20px rgba(255, 215, 0, 0.3);
}

.worst-habit {
  border-color: var(--pp-danger);
}

.habit-header {
  width: 100%;
}

.habit-badge {
  font-family: 'Press Start 2P', cursive;
  font-size: 0.6rem;
  background-color: var(--pp-gold);
  color: #000;
  padding: 0.5rem 1rem;
  border: 2px solid #000;
  box-shadow: 2px 2px 0 rgba(0, 0, 0, 0.5);
}

.worst-habit .habit-badge {
  background-color: var(--pp-danger);
  color: white;
}

.habit-icon {
  font-size: 3rem;
}

.habit-name {
  font-family: 'Press Start 2P', cursive;
  font-size: 0.75rem;
  color: white;
  text-shadow: 2px 2px 0 #000;
  line-height: 1.4;
}

.habit-stat {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.habit-rate {
  font-family: 'Press Start 2P', cursive;
  font-size: 1.5rem;
  color: var(--pp-gold-acc);
  text-shadow: 2px 2px 0 #000;
}

.habit-count {
  font-family: 'Press Start 2P', cursive;
  font-size: 0.6rem;
  color: var(--pp-text-muted);
  text-shadow: 1px 1px 0 #000;
}
</style>