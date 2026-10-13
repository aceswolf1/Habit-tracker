<!--
  BossRankBadge.vue (V2 A10 restyle, W3 owner).

  Sharp 1px line border, monospace, no animations. Same `RankInfo`
  contract — parent supplies color/gradient/glow which the SCSS
  references for the rank letter tint.
-->
<template>
  <div class="rank-badge-overlay" :data-rank="rank.rank">
    <div class="rank-badge-container">
      <div
        class="rank-letter"
        :style="{ color: rank.color, borderColor: rank.color }"
      >
        {{ rank.rank }}
      </div>
      <div class="percentage-badge" :style="{ borderColor: rank.color }">
        <span class="percentage-text">{{ progress }}%</span>
        <span class="completion-label">COMPLETE</span>
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
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(9, 11, 16, 0.85);
  z-index: 6;
}

.rank-badge-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.rank-letter {
  font-family: "Space Grotesk", sans-serif;
  font-size: 5rem;
  font-weight: 700;
  line-height: 1;
  letter-spacing: 0.08em;
  border: 1px solid;
  padding: 0.25rem 0.75rem;
  background: var(--pp-card);
}

.percentage-badge {
  padding: 0.375rem 0.75rem;
  border: 1px solid;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: var(--pp-card);

  .percentage-text {
    font-family: "Space Grotesk", sans-serif;
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--pp-text);
    letter-spacing: 0.05em;
  }

  .completion-label {
    font-family: "JetBrains Mono", monospace;
    font-size: 9px;
    font-weight: 700;
    color: var(--pp-muted);
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }
}
</style>
