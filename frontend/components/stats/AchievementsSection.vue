<template>
  <div class="achievement-section">
    <div class="achievement-title">🏅 ACHIEVEMENTS UNLOCKED</div>
    <div class="achievement-grid">
      <div class="achievement" v-if="(statistics?.finalProgress || 0) >= 100">
        <span class="achievement-icon">🎊</span>
        <span class="achievement-text">Month Completed!</span>
      </div>
      <div class="achievement" v-if="(statistics?.bonusPercentage || 0) > 0">
        <span class="achievement-icon">💯</span>
        <span class="achievement-text">+{{ statistics?.bonusPercentage }}% Bonus</span>
      </div>
      <div class="achievement" v-if="(statistics?.longestStreak || 0) >= 7">
        <span class="achievement-icon">🔥</span>
        <span class="achievement-text">Week Streak!</span>
      </div>
      <div class="achievement" v-if="(statistics?.requiredCompletionRate || 0) === 100">
        <span class="achievement-icon">⚡</span>
        <span class="achievement-text">Perfect Required!</span>
      </div>
      <div class="achievement" v-if="(statistics?.legendaryTasksCompleted || 0) > 0">
        <span class="achievement-icon">👑</span>
        <span class="achievement-text">Legendary Hero</span>
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
.achievement-section {
  background: linear-gradient(135deg, rgba(167, 139, 250, 0.2) 0%, rgba(139, 92, 246, 0.3) 100%);
  border: 3px solid var(--pp-champion);
  padding: 1.5rem;
  box-shadow: 4px 4px 0 rgba(0, 0, 0, 0.8);
}

.achievement-title {
  font-family: 'Press Start 2P', cursive;
  font-size: 1rem;
  color: var(--pp-gold-acc);
  text-shadow: 2px 2px 0 #000;
  margin-bottom: 1rem;
  text-align: center;
}

.achievement-grid {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 1rem;
}

.achievement {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background-color: rgba(26, 32, 44, 0.9);
  border: 2px solid var(--pp-gold-acc);
  padding: 0.75rem 1.25rem;
  box-shadow: 3px 3px 0 rgba(0, 0, 0, 0.8);
}

.achievement-icon {
  font-size: 1.5rem;
}

.achievement-text {
  font-family: 'Press Start 2P', cursive;
  font-size: 0.65rem;
  color: white;
  text-shadow: 1px 1px 0 #000;
}
</style>