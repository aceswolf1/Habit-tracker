<template>
  <Teleport to="body">
    <div class="particle-burst-container">
      <svg
        v-for="burst in activeBursts"
        :key="burst.id"
        class="particle-burst-svg"
        :style="{
          left: burst.x + 'px',
          top: burst.y + 'px'
        }"
      >
        <circle
          v-for="particle in burst.particles"
          :key="particle.id"
          class="particle"
          :class="[burst.type, { legendary: burst.isLegendary }]"
          :style="{
            '--particle-x': particle.x + 'px',
            '--particle-y': particle.y + 'px',
            '--delay': particle.delay + 's',
            '--duration': particle.duration + 's'
          }"
          :cx="0"
          :cy="0"
          :r="particle.size"
          :fill="particle.color"
        />
      </svg>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  delay: number;
  duration: number;
}

interface ParticleBurst {
  id: number;
  x: number;
  y: number;
  particles: Particle[];
  type: string;
  isLegendary: boolean;
}

const activeBursts = ref<ParticleBurst[]>([]);
let burstIdCounter = 0;
let particleIdCounter = 0;

// Color schemes for different task types
const colorSchemes = {
  required: ['#3b82f6', '#60a5fa', '#93c5fd', '#dbeafe'],  // Blue
  optional: ['#a78bfa', '#c4b5fd', '#ddd6fe', '#ede9fe'],  // Purple
  legendary: ['#ffd700', '#ffed4e', '#fff9c4', '#fffde7', '#ff6b6b'], // Gold with red
  bronze: ['#cd7f32', '#e39a5d', '#f4c28f', '#fae6cc'],
  silver: ['#c0c0c0', '#d3d3d3', '#e8e8e8', '#f5f5f5'],
  gold: ['#ffd700', '#ffed4e', '#fff59d', '#fff9c4'],
  champion: ['#a78bfa', '#c4b5fd', '#e0d5ff', '#f3f0ff'],
  final: ['#ffd700', '#ff00ff', '#00ffff', '#ff69b4']  // Rainbow
};

function getColorScheme(taskType: string, tier: string, isLegendary: boolean) {
  if (isLegendary) return colorSchemes.legendary;
  if (tier && colorSchemes[tier.toLowerCase()]) {
    return colorSchemes[tier.toLowerCase()];
  }
  return taskType === 'optional' ? colorSchemes.optional : colorSchemes.required;
}

function createParticleBurst(x: number, y: number, taskType: string, tier: string, isLegendary: boolean) {
  const colors = getColorScheme(taskType, tier, isLegendary);
  const particleCount = isLegendary ? 30 : 20;
  const particles: Particle[] = [];

  for (let i = 0; i < particleCount; i++) {
    const angle = (Math.PI * 2 * i) / particleCount + Math.random() * 0.5;
    const velocity = isLegendary ? 80 + Math.random() * 60 : 50 + Math.random() * 40;
    const px = Math.cos(angle) * velocity;
    const py = Math.sin(angle) * velocity;

    particles.push({
      id: particleIdCounter++,
      x: px,
      y: py,
      size: isLegendary ? 3 + Math.random() * 3 : 2 + Math.random() * 2,
      color: colors[Math.floor(Math.random() * colors.length)],
      delay: Math.random() * 0.1,
      duration: 0.6 + Math.random() * 0.4
    });
  }

  const burst: ParticleBurst = {
    id: burstIdCounter++,
    x,
    y,
    particles,
    type: taskType,
    isLegendary
  };

  activeBursts.value.push(burst);

  // Remove burst after animation completes
  const duration = isLegendary ? 1200 : 1000;
  setTimeout(() => {
    const index = activeBursts.value.findIndex(b => b.id === burst.id);
    if (index !== -1) {
      activeBursts.value.splice(index, 1);
    }
  }, duration);
}

const handleTaskCompleted = (event: Event) => {
  const customEvent = event as CustomEvent;
  const { taskUuid, taskType, tier, isLegendary } = customEvent.detail;

  // Find the task element to position the burst
  const taskElement = document.querySelector(`[data-task-uuid="${taskUuid}"]`);

  if (taskElement) {
    const rect = taskElement.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    createParticleBurst(x, y, taskType, tier, isLegendary || false);
  }
};

onMounted(() => {
  window.addEventListener('taskCompleted', handleTaskCompleted);
});

onUnmounted(() => {
  window.removeEventListener('taskCompleted', handleTaskCompleted);
});
</script>

<style scoped lang="scss">
.particle-burst-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 9998;
}

.particle-burst-svg {
  position: absolute;
  width: 200px;
  height: 200px;
  transform: translate(-50%, -50%);
  overflow: visible;
  pointer-events: none;
}

.particle {
  transform-origin: 0 0;
  animation: particle-explode var(--duration) ease-out var(--delay) forwards;
  opacity: 1;

  &.legendary {
    animation: particle-explode-legendary var(--duration) ease-out var(--delay) forwards;
    filter: drop-shadow(0 0 3px currentColor);
  }
}

@keyframes particle-explode {
  0% {
    transform: translate(0, 0) scale(0);
    opacity: 1;
  }
  10% {
    transform: translate(calc(var(--particle-x) * 0.2), calc(var(--particle-y) * 0.2)) scale(1);
    opacity: 1;
  }
  100% {
    transform: translate(var(--particle-x), var(--particle-y)) scale(0.3);
    opacity: 0;
  }
}

@keyframes particle-explode-legendary {
  0% {
    transform: translate(0, 0) scale(0) rotate(0deg);
    opacity: 1;
  }
  10% {
    transform: translate(calc(var(--particle-x) * 0.3), calc(var(--particle-y) * 0.3)) scale(1.5) rotate(180deg);
    opacity: 1;
  }
  50% {
    transform: translate(calc(var(--particle-x) * 0.7), calc(var(--particle-y) * 0.7)) scale(1.2) rotate(360deg);
    opacity: 0.8;
  }
  100% {
    transform: translate(var(--particle-x), var(--particle-y)) scale(0.5) rotate(540deg);
    opacity: 0;
  }
}
</style>
