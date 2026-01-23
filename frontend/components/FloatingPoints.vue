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
            point.tier?.toLowerCase()
          ]"
        >
          <span class="point-value">
            {{ point.points > 0 ? '+' : '' }}{{ point.points }}
          </span>
          <span class="point-label">XP</span>
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
}

const activePoints = ref<FloatingPoint[]>([]);
let pointIdCounter = 0;

const handlePointsEarned = (event: Event) => {
  const customEvent = event as CustomEvent;
  const { points, taskUuid, tier } = customEvent.detail;

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
    tier
  };

  activePoints.value.push(newPoint);

  // Remove after animation completes (2 seconds)
  setTimeout(() => {
    const index = activePoints.value.findIndex(p => p.id === newPoint.id);
    if (index !== -1) {
      activePoints.value.splice(index, 1);
    }
  }, 2000);
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
    }

    &.silver {
      color: #c0c0c0;
    }

    &.gold {
      color: #ffd700;
    }

    &.champion {
      color: #ff6b6b;
    }

    &.final {
      color: #ff00ff;
      text-shadow:
        2px 2px 0 rgba(0, 0, 0, 0.8),
        0 0 10px rgba(255, 0, 255, 0.8);
    }
  }

  &.negative {
    color: #ff4444;
  }
}

.point-value {
  font-size: 24px;
}

.point-label {
  font-size: 14px;
  opacity: 0.9;
}

/* Floating animation */
.float-enter-active {
  animation: floatUp 2s ease-out;
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

@keyframes fadeOut {
  to {
    opacity: 0;
  }
}

/* Add pixel-art style pixelation effect */
.floating-point {
  image-rendering: pixelated;
  image-rendering: -moz-crisp-edges;
  image-rendering: crisp-edges;
}
</style>
