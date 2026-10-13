<!--
  BossProgressBar.vue (V2 A10 restyle, W3 owner).

  Sharp 1px border, stepped segments, no glow animation. Same
  `RankInfo` contract; rank-achieved footer renders below the bar.
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
        :style="{ width: `${progress}%` }"
      />
      <div class="progress-markers">
        <div class="marker" v-for="n in 5" :key="n" />
      </div>
    </div>
    <div
      v-if="hasRank"
      class="rpg-progress-complete"
      :style="{ color: rankInfo.color }"
    >
      RANK {{ rankInfo.rank }} ACHIEVED
    </div>
  </div>
</template>

<script setup lang="ts">
import type { RankInfo } from "./BossRankBadge.vue";

defineProps<{
  progress: number;
  conquered: boolean;
  hasRank: boolean;
  rankInfo: RankInfo | null;
}>();
</script>

<style lang="scss" scoped>
.rpg-progress-container {
  background: var(--pp-card);
  border: 1px solid var(--pp-line);
  padding: 0.375rem 0.5rem;
}

.progress-label {
  display: flex;
  justify-content: space-between;
  color: var(--pp-text);
  font-family: "JetBrains Mono", monospace;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  margin-bottom: 0.25rem;

  .completed-text {
    color: var(--pp-amber);
  }
}

.rpg-progress-bar-outer {
  height: 6px;
  background: var(--pp-void);
  border: 1px solid var(--pp-line);
  position: relative;
  overflow: hidden;
}

.rpg-progress-bar-inner {
  height: 100%;
  background: linear-gradient(90deg, var(--pp-cyan), var(--pp-magenta));
}

.progress-markers {
  position: absolute;
  inset: 0;
  display: flex;
  justify-content: space-between;
  padding: 0 5%;
  pointer-events: none;

  .marker {
    width: 1px;
    height: 100%;
    background: var(--pp-line);
  }
}

.rpg-progress-complete {
  font-family: "JetBrains Mono", monospace;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  margin-top: 0.25rem;
}

@media (prefers-reduced-motion: reduce) {
  .rpg-progress-container,
  .rpg-progress-container * {
    transition: none !important;
    animation: none !important;
  }
}
</style>
