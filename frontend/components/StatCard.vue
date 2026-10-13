<!--
  StatCard.vue (W1 restyle, V2 Combat Deck).

  Generic stat tile used by every section of MonthStatistics. Sharp
  1px `--pp-line` border, `--pp-card` resting background, mono body
  text. Best / worst badges light up with `--pp-amber` / `--pp-danger`
  accent strips (no animated glow).
-->
<template>
  <div
    class="stat-card"
    :class="[
      rank === 'best' ? 'stat-card--best' : '',
      rank === 'worst' ? 'stat-card--worst' : '',
    ]"
  >
    <div v-if="icon" class="stat-card__icon" aria-hidden="true">{{ icon }}</div>
    <div class="stat-card__body">
      <div class="stat-card__title">{{ title }}</div>
      <div class="stat-card__value">{{ value }}</div>
      <div v-if="subtitle" class="stat-card__subtitle">{{ subtitle }}</div>
    </div>
    <div v-if="rank" class="stat-card__rank">
      <span
        class="stat-card__rank-badge font-mono"
        :class="rank === 'best' ? 'stat-card__rank-badge--best' : 'stat-card__rank-badge--worst'"
      >{{ rank === 'best' ? 'BEST' : 'WORST' }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: string;
  rank?: 'best' | 'worst' | null;
}

withDefaults(defineProps<Props>(), {
  subtitle: '',
  icon: '',
  rank: null,
});
</script>

<style scoped>
.stat-card {
  background: var(--pp-card);
  border: 1px solid var(--pp-line);
  padding: 0.85rem 1rem;
  display: flex;
  align-items: center;
  gap: 0.85rem;
  font-family: "JetBrains Mono", ui-monospace, monospace;
  color: var(--pp-text);
  position: relative;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}

.stat-card:hover {
  background: var(--pp-card-active);
  border-color: var(--pp-cyan);
}

.stat-card__icon {
  font-size: 1.5rem;
  flex-shrink: 0;
  line-height: 1;
}

.stat-card__body {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.stat-card__title {
  font-family: "JetBrains Mono", ui-monospace, monospace;
  font-weight: 700;
  font-size: 0.65rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--pp-muted);
}

.stat-card__value {
  font-family: "Space Grotesk", system-ui, sans-serif;
  font-weight: 700;
  font-size: 1.1rem;
  letter-spacing: 0.02em;
  color: var(--pp-text);
  word-break: break-word;
}

.stat-card__subtitle {
  font-family: "JetBrains Mono", ui-monospace, monospace;
  font-size: 0.7rem;
  color: var(--pp-muted);
}

.stat-card__rank {
  position: absolute;
  top: 0.4rem;
  right: 0.5rem;
}

.stat-card__rank-badge {
  font-size: 0.55rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  padding: 0.15rem 0.4rem;
  border: 1px solid var(--pp-line);
}

.stat-card__rank-badge--best {
  background: var(--pp-amber);
  color: var(--pp-void);
  border-color: var(--pp-amber);
}

.stat-card__rank-badge--worst {
  background: var(--pp-danger);
  color: var(--pp-text);
  border-color: var(--pp-danger);
}

.stat-card--best {
  border-color: var(--pp-amber);
}
.stat-card--worst {
  border-color: var(--pp-danger);
}
</style>