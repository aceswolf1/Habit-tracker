<!--
  ActionButtons.vue (W1 restyle, V2 stub).

  This legacy footer action row is no longer mounted by the V2 shell
  (`AppSidebar` owns New / Finish / Refresh buttons). Kept on disk
  so any leftover import keeps resolving, but rewritten to use V2
  tokens so the global legacy-arcade-font sweep returns clean.
-->
<template>
  <div class="action-buttons">
    <button
      type="button"
      class="ab-btn ab-btn--cyan"
      @click="onRefresh"
    >REFRESH DATA</button>
    <button
      type="button"
      class="ab-btn"
      :disabled="isFinished"
      @click="onAdd"
    >+ ADD HABIT</button>
    <button
      v-if="hasMonth"
      type="button"
      class="ab-btn ab-btn--danger"
      :disabled="isFinished"
      @click="onFinish"
    >{{ isFinished ? "FINISHED" : "FINISH MONTH" }}</button>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  isFinished: boolean;
  hasMonth: boolean;
  refreshData: () => void;
  openCreateTask: () => void;
  finishMonth: () => void;
}>();
const emit = defineEmits<{
  (e: "refresh"): void;
  (e: "add"): void;
  (e: "finish"): void;
}>();

function onRefresh() { emit("refresh"); }
function onAdd() { emit("add"); }
function onFinish() { emit("finish"); }
</script>

<style scoped>
.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  align-items: stretch;
}

@media (min-width: 640px) {
  .action-buttons {
    flex-direction: row;
    justify-content: center;
    flex-wrap: wrap;
  }
}

.ab-btn {
  font-family: "JetBrains Mono", ui-monospace, monospace;
  font-weight: 700;
  font-size: 0.7rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 0.5rem 1rem;
  background: var(--pp-card);
  color: var(--pp-text);
  border: 1px solid var(--pp-line);
  cursor: pointer;
  min-height: 40px;
}

.ab-btn--cyan {
  background: var(--pp-cyan);
  color: var(--pp-void);
  border-color: var(--pp-cyan);
}

.ab-btn--danger {
  background: var(--pp-danger);
  color: var(--pp-text);
  border-color: var(--pp-danger);
}

.ab-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>