<template>
  <div class="hero-section">
    <div class="tier-badge" :class="`tier-${tierClass}`">
      <div class="tier-icon">{{ tierIcon }}</div>
      <div class="tier-text">{{ statistics?.finalTier || 'Bronze' }} TIER</div>
    </div>
    <div class="hero-stats">
      <StatCard
        title="Total XP"
        :value="`${statistics?.totalXP || 0} XP`"
        icon="⚔️"
        color="#ffd700"
      />
      <StatCard
        title="Completion"
        :value="`${statistics?.finalProgress || 0}%`"
        :subtitle="bonusText"
        icon="🎯"
        color="#4ade80"
      />
      <StatCard
        title="Perfect Days"
        :value="statistics?.totalPerfectDays || 0"
        subtitle="100% Completed"
        icon="✨"
        color="#a78bfa"
      />
      <StatCard
        title="Best Streak"
        :value="`${statistics?.longestStreak || 0} Days`"
        subtitle="Consecutive Perfect"
        icon="🔥"
        color="#fb923c"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import StatCard from '../StatCard.vue';

const props = defineProps<{
  statistics: any;
}>();

const tierClass = computed(() => {
  const tier = props.statistics?.finalTier || 'Bronze';
  return tier.toLowerCase();
});

const tierIcon = computed(() => {
  const tier = props.statistics?.finalTier || 'Bronze';
  switch (tier) {
    case 'Final': return '✨';
    case 'Champion': return '👑';
    case 'Gold': return '⚔️';
    case 'Silver': return '🏆';
    case 'Bronze': return '🏆';
    default: return '🏆';
  }
});

const bonusText = computed(() => {
  const bonus = props.statistics?.bonusPercentage || 0;
  return bonus > 0 ? `+${bonus}% Bonus!` : 'Base Progress';
});
</script>

<style scoped lang="scss">
.hero-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
  padding: 2rem;
  background: linear-gradient(135deg, rgba(29, 78, 216, 0.2) 0%, rgba(139, 92, 246, 0.2) 100%);
  border: 3px solid var(--pp-blue);
  box-shadow: 4px 4px 0 rgba(0, 0, 0, 0.8);
}

.tier-badge {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 1.5rem;
  border: 4px solid;
  box-shadow: 6px 6px 0 rgba(0, 0, 0, 0.8);
  min-width: 200px;
  text-align: center;
}

.tier-bronze { border-color: var(--pp-bronze); background: rgba(205, 127, 50, 0.2); }
.tier-silver { border-color: var(--pp-silver); background: rgba(192, 192, 192, 0.2); }
.tier-gold { border-color: var(--pp-gold); background: rgba(255, 215, 0, 0.2); }
.tier-champion { border-color: var(--pp-champion); background: rgba(167, 139, 250, 0.2); }
.tier-final {
  border-color: var(--pp-gold);
  background: rgba(255, 215, 0, 0.2);
  animation: final-tier-glow 2s ease-in-out infinite;
}

@keyframes final-tier-glow {
  0%, 100% {
    box-shadow: 6px 6px 0 rgba(0, 0, 0, 0.8), 0 0 20px rgba(255, 215, 0, 0.5);
  }
  50% {
    box-shadow: 6px 6px 0 rgba(0, 0, 0, 0.8), 0 0 40px rgba(255, 215, 0, 0.8);
  }
}

.tier-icon {
  font-size: 4rem;
}

.tier-text {
  font-family: 'Press Start 2P', cursive;
  font-size: 1.25rem;
  color: white;
  text-shadow: 3px 3px 0 #000;
}

.hero-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  width: 100%;
}
</style>