<!--
  BossRankBadge.vue (W4 split, UB-55).

  Owns the rank badge overlay rendered on top of the boss portrait once a
  week reaches a rank tier (D ≥ 80%, C ≥ 85%, B ≥ 90%, A ≥ 95%, S = 100%).
  Same DOM, classes, and animation as the original
  WeeklyBossPortrait.vue `rank-badge-overlay` subtree.
-->
<template>
  <div class="rank-badge-overlay" :data-rank="rank.rank">
    <div class="rank-badge-container">
      <!-- Rank Letter -->
      <div
        class="rank-letter"
        :style="{ color: rank.color, textShadow: `0 0 20px ${rank.glow}` }"
      >
        {{ rank.rank }}
      </div>
      <!-- Percentage Badge -->
      <div class="percentage-badge" :style="{ background: rank.gradient }">
        <span class="percentage-text">{{ progress }}%</span>
        <span class="completion-label">COMPLETE</span>
      </div>
      <!-- Particle burst effect -->
      <div class="rank-particles">
        <div class="particle" v-for="n in 12" :key="n"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
export interface RankInfo {
  rank: string;
  threshold: number;
  color: string;
  gradient: string;
  glow: string;
}

defineProps<{
  /** Resolved rank payload (parent supplies it; null ⇒ don't render). */
  rank: RankInfo;
  /** 0–100 — used inside the percentage chip. */
  progress: number;
}>();
</script>

<style lang="scss" scoped>
.rank-badge-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(2px);
  z-index: 6;
}

.rank-badge-container {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  animation: rank-reveal 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

.rank-letter {
  font-family: "Press Start 2P", cursive;
  font-size: 8rem;
  font-weight: bold;
  line-height: 1;
  animation: rank-letter-pop 1s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  text-shadow:
    3px 3px 0 black,
    -1px -1px 0 black,
    1px -1px 0 black,
    -1px 1px 0 black;
  filter: drop-shadow(0 0 30px currentColor);
}

.percentage-badge {
  padding: 0.75rem 1.5rem;
  border: 3px solid black;
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow:
    0 0 20px rgba(0, 0, 0, 0.5),
    inset 0 2px 0 rgba(255, 255, 255, 0.3);
  animation: badge-shimmer 2s ease-in-out infinite;

  .percentage-text {
    font-family: "Press Start 2P", cursive;
    font-size: 1.5rem;
    color: white;
    font-weight: bold;
    text-shadow: 2px 2px 0 black;
    margin-bottom: 0.25rem;
  }

  .completion-label {
    font-family: "Press Start 2P", cursive;
    font-size: 0.6rem;
    color: rgba(255, 255, 255, 0.9);
    text-shadow: 1px 1px 0 black;
    letter-spacing: 2px;
  }
}

.rank-particles {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: visible;

  .particle {
    position: absolute;
    width: 8px;
    height: 8px;
    background: white;
    border-radius: 50%;
    top: 50%;
    left: 50%;
    opacity: 0;
    animation: particle-burst 1.5s ease-out forwards;
    box-shadow: 0 0 10px currentColor;

    @for $i from 1 through 12 {
      &:nth-child(#{$i}) {
        animation-delay: #{$i * 0.05}s;
        $angle: #{$i * 30}deg;
        --particle-angle: #{$angle};
      }
    }
  }
}

@keyframes rank-reveal {
  0% {
    opacity: 0;
    transform: scale(0.5) rotate(-10deg);
  }
  60% {
    opacity: 1;
    transform: scale(1.1) rotate(2deg);
  }
  100% {
    opacity: 1;
    transform: scale(1) rotate(0deg);
  }
}

@keyframes rank-letter-pop {
  0% {
    opacity: 0;
    transform: scale(0) rotate(-45deg);
  }
  50% {
    opacity: 1;
    transform: scale(1.3) rotate(10deg);
  }
  70% {
    transform: scale(0.95) rotate(-5deg);
  }
  100% {
    opacity: 1;
    transform: scale(1) rotate(0deg);
  }
}

@keyframes badge-shimmer {
  0%,
  100% {
    box-shadow:
      0 0 20px rgba(0, 0, 0, 0.5),
      inset 0 2px 0 rgba(255, 255, 255, 0.3);
  }
  50% {
    box-shadow:
      0 0 30px rgba(255, 255, 255, 0.4),
      inset 0 2px 0 rgba(255, 255, 255, 0.5);
  }
}

@keyframes particle-burst {
  0% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(0);
  }
  50% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform:
      translate(-50%, -50%)
      translate(
        calc(cos(var(--particle-angle, 0deg)) * 100px),
        calc(sin(var(--particle-angle, 0deg)) * 100px)
      )
      scale(1);
  }
}

/* B-T5: rank reveal animations off under prefers-reduced-motion; the
 * badge still shows up (the override opacity/transform below keeps the
 * rank letter and percentage chip visible without any motion). */
@media (prefers-reduced-motion: reduce) {
  .rank-badge-container,
  .rank-letter,
  .percentage-badge,
  .rank-particles .particle {
    animation: none !important;
  }
  .rank-letter {
    transform: scale(1);
    opacity: 1;
  }
  .rank-badge-container {
    transform: scale(1);
    opacity: 1;
  }
  .rank-particles {
    display: none !important;
  }
}
</style>
