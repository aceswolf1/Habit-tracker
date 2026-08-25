<template>
  <Teleport to="body">
    <div class="floating-points-container">
      <TransitionGroup name="float">
        <div
          v-for="point in activePoints"
          :key="point.id"
          class="floating-point"
          :style="{
            left: point.x + 'px',
            top: point.y + 'px',
            '--float-offset-x': point.offsetX + 'px'
          }"
          :class="[
            point.points > 0 ? 'positive' : 'negative',
            point.tier?.toLowerCase(),
            { 'legendary': point.isLegendary }
          ]"
        >
          <span class="point-icon" v-if="point.isLegendary">👑</span>
          <span class="point-value">
            {{ point.points > 0 ? '+' : '' }}{{ point.points }}
          </span>
          <span class="point-label">XP</span>
          <span class="multiplier-badge" v-if="point.isLegendary">3x</span>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';

interface FloatingPoint {
  id: number;
  points: number;
  x: number;
  y: number;
  offsetX: number;
  tier?: string;
  isLegendary?: boolean;
}

const activePoints = ref<FloatingPoint[]>([]);
let pointIdCounter = 0;

const handlePointsEarned = (event: Event) => {
  const customEvent = event as CustomEvent;
  const { points, taskUuid, tier, isLegendary } = customEvent.detail;

  // Try to find the task element to position the floating points
  const taskElement = document.querySelector(`[data-task-uuid="${taskUuid}"]`);

  let x = window.innerWidth / 2;
  let y = window.innerHeight / 2;

  if (taskElement) {
    const rect = taskElement.getBoundingClientRect();
    x = rect.left + rect.width / 2;
    y = rect.top + rect.height / 2;
  }

  // Add slight random horizontal offset for visual variety
  const offsetX = (Math.random() - 0.5) * 30;

  const newPoint: FloatingPoint = {
    id: pointIdCounter++,
    points,
    x,
    y,
    offsetX,
    tier,
    isLegendary
  };

  activePoints.value.push(newPoint);

  // Remove after animation completes (2.5 seconds for legendary, 2 seconds for normal)
  const duration = isLegendary ? 2500 : 2000;
  setTimeout(() => {
    const index = activePoints.value.findIndex(p => p.id === newPoint.id);
    if (index !== -1) {
      activePoints.value.splice(index, 1);
    }
  }, duration);
};

onMounted(() => {
  window.addEventListener('pointsEarned', handlePointsEarned);
});

onUnmounted(() => {
  window.removeEventListener('pointsEarned', handlePointsEarned);
});
</script>

<style scoped lang="scss">
.floating-points-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 9999;
}

.floating-point {
  position: absolute;
  font-family: 'Press Start 2P', monospace;
  font-size: 20px;
  font-weight: bold;
  text-shadow:
    2px 2px 0 rgba(0, 0, 0, 0.8),
    -1px -1px 0 rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
  transform: translate(-50%, -50%);

  &.positive {
    color: #ffd700; /* Gold color for points */

    &.bronze {
      color: #cd7f32;
      text-shadow:
        2px 2px 0 rgba(0, 0, 0, 0.8),
        0 0 8px rgba(205, 127, 50, 0.6);
    }

    &.silver {
      color: #c0c0c0;
      text-shadow:
        2px 2px 0 rgba(0, 0, 0, 0.8),
        0 0 8px rgba(192, 192, 192, 0.6);
    }

    &.gold {
      color: #ffd700;
      text-shadow:
        2px 2px 0 rgba(0, 0, 0, 0.8),
        0 0 10px rgba(255, 215, 0, 0.8);
    }

    &.champion {
      color: #a78bfa;
      text-shadow:
        2px 2px 0 rgba(0, 0, 0, 0.8),
        0 0 12px rgba(167, 139, 250, 0.8);
    }

    &.final {
      color: #ffd700;
      text-shadow:
        2px 2px 0 rgba(0, 0, 0, 0.8),
        0 0 15px rgba(255, 215, 0, 1),
        0 0 25px rgba(255, 215, 0, 0.6);
      animation: rainbow-text 2s linear infinite;
    }
  }

  &.legendary {
    font-size: 26px;
    text-shadow:
      3px 3px 0 rgba(0, 0, 0, 0.9),
      0 0 20px rgba(255, 215, 0, 1),
      0 0 30px rgba(255, 215, 0, 0.7);
    animation: legendary-pulse 0.5s ease-in-out infinite alternate;
  }

  &.negative {
    color: #ff4444;
  }
}

.point-icon {
  font-size: 20px;
  animation: spin-icon 2s linear infinite;
}

.point-value {
  font-size: 24px;
}

.point-label {
  font-size: 14px;
  opacity: 0.9;
}

.multiplier-badge {
  font-size: 12px;
  background: linear-gradient(135deg, #ffd700, #ffed4e);
  color: #000;
  padding: 2px 6px;
  border-radius: 4px;
  border: 2px solid #000;
  box-shadow: 2px 2px 0 rgba(0, 0, 0, 0.8);
  animation: badge-bounce 0.5s ease-in-out infinite alternate;
}

/* Floating animation */
.float-enter-active {
  animation: floatUp 2s ease-out;

  &.legendary {
    animation: floatUpLegendary 2.5s ease-out;
  }
}

.float-leave-active {
  animation: fadeOut 0.5s ease-out;
}

@keyframes floatUp {
  0% {
    transform: translate(calc(-50% + var(--float-offset-x, 0px)), -50%) scale(0.5);
    opacity: 0;
  }
  10% {
    transform: translate(calc(-50% + var(--float-offset-x, 0px)), -50%) scale(1.3);
    opacity: 1;
  }
  20% {
    transform: translate(calc(-50% + var(--float-offset-x, 0px)), -50%) scale(1);
  }
  100% {
    transform: translate(calc(-50% + var(--float-offset-x, 0px)), calc(-50% - 100px)) scale(1);
    opacity: 0;
  }
}

@keyframes floatUpLegendary {
  0% {
    transform: translate(calc(-50% + var(--float-offset-x, 0px)), -50%) scale(0.3) rotate(-10deg);
    opacity: 0;
  }
  10% {
    transform: translate(calc(-50% + var(--float-offset-x, 0px)), -50%) scale(1.5) rotate(5deg);
    opacity: 1;
  }
  20% {
    transform: translate(calc(-50% + var(--float-offset-x, 0px)), -50%) scale(1.2) rotate(-3deg);
  }
  30% {
    transform: translate(calc(-50% + var(--float-offset-x, 0px)), -50%) scale(1.3) rotate(2deg);
  }
  100% {
    transform: translate(calc(-50% + var(--float-offset-x, 0px)), calc(-50% - 120px)) scale(1.2) rotate(0deg);
    opacity: 0;
  }
}

@keyframes fadeOut {
  to {
    opacity: 0;
  }
}

@keyframes legendary-pulse {
  from {
    transform: translate(-50%, -50%) scale(1);
  }
  to {
    transform: translate(-50%, -50%) scale(1.05);
  }
}

@keyframes spin-icon {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

@keyframes badge-bounce {
  from {
    transform: translateY(0);
  }
  to {
    transform: translateY(-2px);
  }
}

@keyframes rainbow-text {
  0% {
    filter: hue-rotate(0deg);
  }
  100% {
    filter: hue-rotate(360deg);
  }
}

/* Add pixel-art style pixelation effect */
.floating-point {
  image-rendering: pixelated;
  image-rendering: -moz-crisp-edges;
  image-rendering: crisp-edges;
}
</style>
