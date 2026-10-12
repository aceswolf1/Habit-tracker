<template>
  <div class="stats-footer">
    <div class="finish-date">
      Completed on {{ formatDate(month?.finishedAt) }}
    </div>
  </div>
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
    day: 'numeric'
  });
}
</script>

<style scoped lang="scss">
.stats-footer {
  text-align: center;
  padding: 1rem;
  border-top: 2px solid var(--pp-gray);
}

.finish-date {
  font-family: 'Press Start 2P', cursive;
  font-size: 0.6rem;
  color: var(--pp-text-muted);
  text-shadow: 1px 1px 0 #000;
}
</style>