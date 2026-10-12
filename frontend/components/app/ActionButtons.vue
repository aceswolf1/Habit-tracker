<template>
  <!--
    Footer action row, responsive:
      - phone  (<640): full-width buttons stacked vertically
      - tablet / desktop: original inline row
  -->
  <div
    class="action-buttons flex flex-col items-stretch gap-3 sm:flex-row sm:justify-center sm:items-center sm:gap-4 sm:flex-wrap"
  >
    <button
      @click="onRefresh"
      class="pp-tap font-press text-[10px] text-pixel-text border-2 border-pixel-black bg-pixel-blue px-3 py-2"
      style="
        box-shadow: 4px 4px 0 rgba(0, 0, 0, 0.8);
        transform: translate(-2px, -2px);
        transition: transform 0.1s, box-shadow 0.1s;
      "
    >
      REFRESH DATA
    </button>
    <button
      :disabled="isFinished"
      @click="onAdd"
      class="pp-tap font-press text-[10px] text-white border-2 border-black px-0"
      :style="addButtonStyle"
    >
      + ADD HABIT
    </button>
    <button
      v-if="hasMonth"
      :disabled="isFinished"
      @click="onFinish"
      class="pp-tap font-press text-[10px] text-white border-2 border-black px-0"
      :style="finishButtonStyle"
    >
      {{ isFinished ? "FINISHED" : "FINISH MONTH" }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  isFinished: boolean;
  hasMonth: boolean;
  refreshData: () => void;
  openCreateTask: () => void;
  finishMonth: () => void;
}>();

function onRefresh() {
  props.refreshData();
}
function onAdd() {
  props.openCreateTask();
}
function onFinish() {
  props.finishMonth();
}

const baseBtn = {
  fontFamily: "'Press Start 2P', cursive",
  color: "var(--pp-text)",
  border: "2px solid var(--pp-black)",
  position: "relative",
  display: "inline-block",
  boxShadow: "4px 4px 0 rgba(0,0,0,0.8)",
  transform: "translate(-2px,-2px)",
  transition: "transform 0.1s, box-shadow 0.1s",
  fontSize: "0.75rem",
  padding: "0.5rem 1rem",
};
const addButtonStyle = computed(
  () =>
    ({
      ...(baseBtn as any),
      backgroundColor: "var(--pp-blue)",
      opacity: props.isFinished ? 0.5 : 1,
      cursor: props.isFinished ? "not-allowed" : "pointer",
    } as any)
);
const finishButtonStyle = computed(
  () =>
    ({
      ...(baseBtn as any),
      backgroundColor: "var(--pp-cancel)",
      opacity: props.isFinished ? 0.5 : 1,
      cursor: props.isFinished ? "not-allowed" : "pointer",
    } as any)
);
</script>

<style lang="scss">
.action-buttons {
  /* layout is set inline / via Tailwind for stability with the prior markup */
}

@media (max-width: 1023px) {
  .action-buttons > button {
    width: 100%;
  }
}

@media (min-width: 1024px) {
  .pp-tap {
    min-height: auto;
    min-width: auto;
  }
}
</style>