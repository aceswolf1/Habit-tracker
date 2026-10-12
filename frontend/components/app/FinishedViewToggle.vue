<template>
  <!-- Toggle Button for Finished Months -->
  <div v-if="isFinished && hasMonth" style="display: flex; justify-content: center; margin-bottom: 1.5rem;">
    <button
      @click="toggleView"
      style="
        font-family: 'Press Start 2P', cursive;
        color: var(--pp-text);
        border: 3px solid var(--pp-gold-acc);
        background-color: var(--pp-blue);
        font-size: 0.75rem;
        padding: 0.75rem 1.5rem;
        box-shadow: 4px 4px 0 rgba(0, 0, 0, 0.8);
        transition: transform 0.1s, box-shadow 0.1s;
        cursor: pointer;
      "
      class="hover:transform hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0_rgba(0,0,0,0.8)]"
    >
      {{ viewMode === 'stats' ? '📋 VIEW FULL MONTH' : '📊 VIEW STATISTICS' }}
    </button>
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