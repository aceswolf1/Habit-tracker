<!--
  BossProgressBar.vue (W4 split, UB-55).

  The RPG-style progress bar rendered under the boss portrait. Hosted
  outside `WeeklyBossPortrait.vue` so the parent can stay focused on the
  boss shell + rank banner. Color/glow for the "rank achieved" footer
  come from `rankInfo` when present.
-->
<template>
  <div class="rpg-progress-container">
    <div class="progress-label">
      <span>PROGRESS</span>
      <span :class="{ 'completed-text': conquered }">{{ progress }}%</span>
    </div>
    <div class="rpg-progress-bar-outer">
      <div
        class="rpg-progress-bar-inner"
        :style="[{ width: `${progress}%` }, progressBarColor]"
      >
        <div class="progress-glow"></div>
      </div>
      <div class="progress-markers">
        <div class="marker" v-for="n in 5" :key="n"></div>
      </div>
    </div>
    <div
      v-if="hasRank"
      class="rpg-progress-complete"
      :style="{ color: rankInfo.color, textShadow: `0 0 8px ${rankInfo.glow}` }"
    >
      RANK {{ rankInfo.rank }} ACHIEVED!
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { RankInfo } from "./BossRankBadge.vue";

const props = defineProps<{
  progress: number;
  conquered: boolean;
  hasRank: boolean;
  rankInfo: RankInfo | null;
}>();

const progressBarColor = computed(() => {
  // Red component decreases as progress increases
  const redComponent = Math.max(0, 200 - props.progress * 1.5);
  // Green component increases as progress increases
  const greenComponent = Math.min(185, props.progress * 1.85);
  return {
    background: `linear-gradient(to right,
      rgb(${redComponent}, ${greenComponent}, 20),
      rgb(${redComponent - 20}, ${greenComponent + 20}, 40)
    )`,
  };
});
</script>

<style lang="scss" scoped>
.rpg-progress-container {
  background-color: var(--pp-bg-panel);
  border: 2px solid black;
  padding: 0.5rem;
  border-radius: 2px;
}

.progress-label {
  display: flex;
  justify-content: space-between;
  color: white;
  font-family: "Press Start 2P", cursive;
  font-size: 0.7rem;
  margin-bottom: 0.5rem;

  .completed-text {
    color: var(--pp-gold-acc);
  }
}

.rpg-progress-bar-outer {
  height: 1.25rem;
  /* #111827 — Tailwind gray-900; no `pp-*` token, keep literal. */
  background-color: #111827;
  border: 2px solid var(--pp-gray-mid);
  position: relative;
  overflow: hidden;
  margin-bottom: 0.25rem;
}

.rpg-progress-bar-inner {
  height: 100%;
  position: relative;
  transition: all 1s ease;

  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 40%;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 0 0 50% 50%;
  }
}

.progress-glow {
  position: absolute;
  top: 0;
  right: 0;
  width: 20px;
  height: 100%;
  background: linear-gradient(
    to right,
    transparent,
    rgba(255, 255, 255, 0.6)
  );
  filter: blur(5px);
  animation: glow-move 2s infinite;
  mix-blend-mode: overlay;
}

.progress-markers {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  justify-content: space-between;
  padding: 0 5%;
  pointer-events: none;

  .marker {
    width: 1px;
    height: 100%;
    background-color: rgba(255, 255, 255, 0.3);

    &:first-child {
      opacity: 0;
    }
  }
}

.rpg-progress-complete {
  color: var(--pp-gold-acc);
  font-family: "Press Start 2P", cursive;
  font-size: 0.75rem;
  margin-top: 0.5rem;
  animation: text-flicker 2s infinite;
  text-shadow: 0 0 5px var(--pp-gold-acc);
}

@keyframes glow-move {
  0% {
    opacity: 0.5;
  }
  50% {
    opacity: 1;
  }
  100% {
    opacity: 0.5;
  }
}

@keyframes text-flicker {
  0% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
  100% {
    opacity: 1;
  }
}

/* B-T5: stop the bar's glow sweep and the rank-achieved flicker under
 * prefers-reduced-motion. The bar fill, label, and markers stay as is. */
@media (prefers-reduced-motion: reduce) {
  .progress-glow,
  .rpg-progress-bar-inner,
  .rpg-progress-complete {
    animation: none !important;
  }
}
</style>
