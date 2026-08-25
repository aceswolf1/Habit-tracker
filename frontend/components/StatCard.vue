<template>
  <div
    :class="['stat-card', rankClass]"
    :style="{ borderColor: borderColor }"
  >
    <div class="stat-icon" v-if="icon">{{ icon }}</div>
    <div class="stat-content">
      <div class="stat-title">{{ title }}</div>
      <div class="stat-value">{{ value }}</div>
      <div class="stat-subtitle" v-if="subtitle">{{ subtitle }}</div>
    </div>
    <div class="stat-rank" v-if="rank">
      <span class="rank-badge">{{ rank }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: string;
  color?: string;
  rank?: 'best' | 'worst' | null;
}

const props = withDefaults(defineProps<Props>(), {
  subtitle: '',
  icon: '',
  color: '#1d4ed8',
  rank: null
});

const rankClass = computed(() => {
  if (props.rank === 'best') return 'rank-best';
  if (props.rank === 'worst') return 'rank-worst';
  return '';
});

const borderColor = computed(() => {
  if (props.rank === 'best') return '#ffd700';
  if (props.rank === 'worst') return '#ef4444';
  return props.color;
});
</script>

<style scoped lang="scss">
.stat-card {
  background-color: rgba(26, 32, 44, 0.9);
  border: 3px solid;
  padding: 1rem;
  box-shadow: 4px 4px 0 rgba(0, 0, 0, 0.8);
  position: relative;
  display: flex;
  align-items: center;
  gap: 1rem;
  transition: transform 0.2s, box-shadow 0.2s;

  &:hover {
    transform: translate(-2px, -2px);
    box-shadow: 6px 6px 0 rgba(0, 0, 0, 0.8);
  }
}

.rank-best {
  border-color: #ffd700;
  box-shadow:
    4px 4px 0 rgba(0, 0, 0, 0.8),
    0 0 20px rgba(255, 215, 0, 0.3);
  animation: gold-glow 2s ease-in-out infinite;
}

.rank-worst {
  border-color: #ef4444;
  box-shadow:
    4px 4px 0 rgba(0, 0, 0, 0.8),
    0 0 15px rgba(239, 68, 68, 0.2);
}

@keyframes gold-glow {
  0%, 100% {
    box-shadow:
      4px 4px 0 rgba(0, 0, 0, 0.8),
      0 0 15px rgba(255, 215, 0, 0.3);
  }
  50% {
    box-shadow:
      4px 4px 0 rgba(0, 0, 0, 0.8),
      0 0 25px rgba(255, 215, 0, 0.5);
  }
}

.stat-icon {
  font-size: 2rem;
  min-width: 2.5rem;
  text-align: center;
}

.stat-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.stat-title {
  font-family: 'Press Start 2P', cursive;
  font-size: 0.65rem;
  color: #fbbf24;
  text-transform: uppercase;
  text-shadow: 2px 2px 0 #000;
}

.stat-value {
  font-family: 'Press Start 2P', cursive;
  font-size: 1.25rem;
  color: white;
  text-shadow: 2px 2px 0 #000;
}

.stat-subtitle {
  font-family: 'Press Start 2P', cursive;
  font-size: 0.5rem;
  color: #9ca3af;
  text-shadow: 1px 1px 0 #000;
}

.stat-rank {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
}

.rank-badge {
  font-family: 'Press Start 2P', cursive;
  font-size: 0.5rem;
  background-color: #ffd700;
  color: #000;
  padding: 0.25rem 0.5rem;
  border: 2px solid #000;
  box-shadow: 2px 2px 0 rgba(0, 0, 0, 0.5);
  text-transform: uppercase;
}

.rank-worst .rank-badge {
  background-color: #ef4444;
  color: white;
}
</style>
