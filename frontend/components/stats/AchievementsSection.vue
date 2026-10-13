<!--
  AchievementsSection.vue (W1 restyle, V2 Combat Deck).

  Wrap of the locked-in cycle's earned achievements (month completed,
  bonus %, streak, perfect required, legendary hero). Sharp 1px
  borders, amber accents, mono body.
-->
<template>
  <section class="ach">
    <h2 class="ach__header font-display">ACHIEVEMENTS UNLOCKED</h2>
    <div class="ach__grid">
      <div v-if="(statistics?.finalProgress || 0) >= 100" class="ach__tile">
        <span class="ach__icon" aria-hidden="true">✦</span>
        <span class="ach__text font-mono">MONTH COMPLETED</span>
      </div>
      <div v-if="(statistics?.bonusPercentage || 0) > 0" class="ach__tile">
        <span class="ach__icon" aria-hidden="true">⌬</span>
        <span class="ach__text font-mono">+{{ statistics?.bonusPercentage }}% BONUS</span>
      </div>
      <div v-if="(statistics?.longestStreak || 0) >= 7" class="ach__tile">
        <span class="ach__icon" aria-hidden="true">⌁</span>
        <span class="ach__text font-mono">WEEK STREAK</span>
      </div>
      <div v-if="(statistics?.requiredCompletionRate || 0) === 100" class="ach__tile">
        <span class="ach__icon" aria-hidden="true">⚡</span>
        <span class="ach__text font-mono">PERFECT REQUIRED</span>
      </div>
      <div v-if="(statistics?.legendaryTasksCompleted || 0) > 0" class="ach__tile">
        <span class="ach__icon" aria-hidden="true">★</span>
        <span class="ach__text font-mono">LEGENDARY HERO</span>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  statistics: any;
}>();
</script>

<style scoped>
.ach {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem;
  background: var(--pp-card);
  border: 1px solid var(--pp-line);
}

.ach__header {
  font-family: "Space Grotesk", system-ui, sans-serif;
  font-weight: 700;
  font-size: 0.9rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--pp-amber);
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--pp-line);
}

.ach__grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  justify-content: flex-start;
}

.ach__tile {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  background: var(--pp-panel);
  border: 1px solid var(--pp-amber);
  padding: 0.5rem 0.75rem;
}

.ach__icon {
  font-size: 1rem;
  color: var(--pp-amber);
}

.ach__text {
  font-size: 0.65rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--pp-text);
  font-weight: 700;
}
</style>