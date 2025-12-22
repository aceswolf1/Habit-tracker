<template>
  <!-- Wrapper sized to parent (parent must be position:relative) -->
  <div class="progress-particles" aria-hidden="true">
    <!-- Energy pool / glow at bottom scaling with progress -->
    <div class="energy-pool" :style="energyStyle"></div>
    <div
      v-for="p in particles"
      :key="p.id"
      class="particle"
      :class="{ bonus: isBonus }"
      :style="{
        left: p.x + '%',
        animationDuration: p.duration + 's',
        animationDelay: p.delay + 's',
        '--rise': p.rise + 'vh',
        '--drift': p.drift + 'px',
        '--scale': p.scale,
        opacity: p.opacity,
      }"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";

const props = defineProps<{
  progress: number;
  maxParticles?: number;
  bonusThreshold?: number;
}>();

const maxParticles = computed(() => props.maxParticles ?? 48);
const bonusThreshold = computed(() => props.bonusThreshold ?? 100);
const cappedProgress = computed(() => Math.min(props.progress ?? 0, 110));

// Bucket progress in 5% increments to avoid regenerating every minor change
const progressBucket = computed(() => Math.floor(cappedProgress.value / 5));

// Map bucket to particle count tiers
function particlesFor(progress: number) {
  if (progress <= 0) return 0;
  if (progress < 15) return 4;
  if (progress < 30) return 8;
  if (progress < 50) return 14;
  if (progress < 75) return 20;
  if (progress < 90) return 28;
  if (progress < 100) return 32;
  if (progress === 100) return 38; // all required done
  return 44; // bonus > 100
}

const targetCount = computed(() =>
  Math.min(particlesFor(cappedProgress.value), maxParticles.value)
);
const isBonus = computed(() => cappedProgress.value >= bonusThreshold.value);

interface ParticleMeta {
  id: string;
  x: number;
  duration: number;
  delay: number;
  rise: number;
  drift: number;
  scale: number;
  opacity: number;
}
const particles = ref<ParticleMeta[]>([]);

function regenParticles() {
  const arr: ParticleMeta[] = [];
  for (let i = 0; i < targetCount.value; i++) {
    const x = Math.random() * 100; // percentage
    const duration = 5 + Math.random() * 6; // 5s - 11s
    const delay = Math.random() * duration; // stagger loop
    const rise = 40 + Math.random() * 35; // how high (vh relative to viewport height)
    const drift = (Math.random() - 0.5) * 40; // -20 .. 20px
    const scale = 0.4 + Math.random() * 0.9; // base size multiplier
    const opacity = 0.25 + Math.random() * 0.55;
    arr.push({
      id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2)}`,
      x,
      duration,
      delay,
      rise,
      drift,
      scale,
      opacity,
    });
  }
  particles.value = arr;
}

// Only regenerate when bucket changes or count changes significantly
watch([progressBucket, targetCount], regenParticles, { immediate: true });

// Accessibility: respect prefers-reduced-motion
const prefersReduced = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
).matches;
if (prefersReduced) {
  // drastically reduce particle count
  watch(
    progressBucket,
    () => {
      particles.value = [];
    },
    { immediate: true }
  );
}

const energyStyle = computed(() => ({
  opacity: Math.min(1, cappedProgress.value / 100),
  filter: isBonus.value ? "brightness(1.3) saturate(1.4)" : "none",
}));
</script>

<style scoped>
.progress-particles {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  z-index: 0; /* behind content (content should have higher z-index) */
}
.energy-pool {
  position: absolute;
  left: 50%;
  bottom: -10%; /* extend slightly so gradient feather not visibly cropped */
  width: 160%;
  height: 70%;
  transform: translateX(-50%);
  background: radial-gradient(
    circle at 50% 85%,
    rgba(80, 160, 255, 0.45) 0%,
    rgba(80, 160, 255, 0.18) 40%,
    rgba(80, 160, 255, 0.08) 60%,
    transparent 78%
  );
  mix-blend-mode: screen;
  transition: opacity 0.6s ease, filter 1s linear;
  filter: blur(8px);
}
.particle {
  position: absolute;
  bottom: -6%;
  width: 6px;
  height: 6px;
  background: radial-gradient(
    circle at 30% 30%,
    #ffffff,
    #9fd6ff 70%,
    #2e6bff 100%
  );
  border-radius: 50%;
  animation: rise linear infinite;
  transform: translateY(0) scale(var(--scale));
  will-change: transform, opacity;
  box-shadow: 0 0 6px 2px rgba(120, 180, 255, 0.4),
    0 0 14px 4px rgba(120, 180, 255, 0.18);
}
.particle.bonus {
  background: radial-gradient(
    circle at 30% 30%,
    #fffbe6,
    #ffd700 60%,
    #b8860b 100%
  );
  box-shadow: 0 0 6px 2px rgba(255, 215, 0, 0.55),
    0 0 14px 4px rgba(255, 215, 0, 0.25);
}
@keyframes rise {
  0% {
    transform: translate3d(0, 0, 0) scale(var(--scale));
    opacity: 0;
  }
  6% {
    opacity: 1;
  }
  85% {
    opacity: 1;
  }
  100% {
    transform: translate3d(var(--drift), calc(-1 * var(--rise)), 0)
      scale(calc(var(--scale) * 0.5));
    opacity: 0;
  }
}

/* Reduced motion preference */
@media (prefers-reduced-motion: reduce) {
  .particle {
    animation: none !important;
    opacity: 0.15;
  }
  .energy-pool {
    animation: none !important;
  }
}
</style>
