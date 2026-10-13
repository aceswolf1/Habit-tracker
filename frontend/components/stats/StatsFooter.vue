<!--
  StatsFooter.vue (W1 restyle, V2 Combat Deck).

  Plain "completed on" timestamp pinned under the stats view. Sharp
  1px divider above, muted mono caption.
-->
<template>
  <footer class="stats-footer">
    <span class="stats-footer__label font-mono">COMPLETED ON</span>
    <span class="stats-footer__date font-mono">{{ formatDate(month?.finishedAt) }}</span>
  </footer>
</template>

<script setup lang="ts">
defineProps<{
  month: any;
}>();

function formatDate(date: any) {
  if (!date) return 'Unknown';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
</script>

<style scoped>
.stats-footer {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  padding: 1rem;
  border-top: 1px solid var(--pp-line);
  font-family: "JetBrains Mono", ui-monospace, monospace;
}

.stats-footer__label {
  font-size: 0.55rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--pp-muted);
  font-weight: 700;
}

.stats-footer__date {
  font-size: 0.85rem;
  color: var(--pp-text);
}
</style>