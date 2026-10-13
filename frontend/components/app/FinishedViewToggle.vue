<!--
  FinishedViewToggle.vue (W1 restyle, V2 stub).

  Legacy toggle button used by older `StatsOrReadonly` switches. Not
  mounted by the V2 sidebar — `AppShell` uses the section state to
  pick Campaign vs Stats. Restyled to V2 tokens for the global sweep.
-->
<template>
  <div v-if="isFinished && hasMonth" class="fvt">
    <button
      type="button"
      class="fvt__btn"
      @click="toggleView"
    >{{ viewMode === 'stats' ? 'VIEW FULL MONTH' : 'VIEW STATISTICS' }}</button>
  </div>
</template>

<script setup lang="ts">
import type { ViewMode } from "../../composables/useMonthViewMode";

defineProps<{
  isFinished: boolean;
  hasMonth: boolean;
  viewMode: ViewMode;
  toggleView: () => void;
}>();
</script>

<style scoped>
.fvt {
  display: flex;
  justify-content: center;
  margin-bottom: 1.5rem;
}

.fvt__btn {
  font-family: "JetBrains Mono", ui-monospace, monospace;
  font-weight: 700;
  font-size: 0.75rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--pp-text);
  background: var(--pp-cyan);
  border: 1px solid var(--pp-amber);
  padding: 0.65rem 1.2rem;
  cursor: pointer;
  transition: border-color 0.15s ease, color 0.15s ease;
}

.fvt__btn:hover,
.fvt__btn:focus-visible {
  color: var(--pp-amber);
  outline: none;
}
</style>