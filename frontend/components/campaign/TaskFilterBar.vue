<!--
  TaskFilterBar.vue (W2 contract §4 / §5).

  Five-pill filter for the spotlight list:
    - All        — show every task in the day
    - Pending    — `!task.completed`
    - Done       — `task.completed`
    - Legendary  — `task.legendary`
    - Optional   — `task.optional`

  Each pill shows a count. The active pill is cyan-filled; the others are
  panel-on-panel ghost buttons with a 1px line border.

  Emits `update:modelValue` (v-model:filter) with the chosen Filter key.
  No local state — controlled component.
-->
<template>
  <div
    class="task-filter-bar flex flex-wrap items-center gap-1"
    role="tablist"
    aria-label="Filter tasks"
  >
    <button
      v-for="opt in options"
      :key="opt.key"
      type="button"
      role="tab"
      :aria-selected="modelValue === opt.key"
      :class="[
        'px-3 min-h-[40px] sm:min-h-0 sm:py-1 font-mono text-label-md uppercase tracking-wider border transition-colors',
        modelValue === opt.key
          ? 'bg-pp-cyan text-pp-void border-pp-cyan'
          : 'bg-pp-panel text-pp-muted border-pp-line hover:text-pp-text hover:border-pp-cyan',
      ]"
      @click="emit('update:modelValue', opt.key)"
    >
      <span>{{ opt.label }}</span>
      <span class="ml-2 text-pp-muted" :class="modelValue === opt.key && 'text-pp-void'">{{ opt.count }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { Task } from "../../types/index";

export type Filter = "all" | "pending" | "done" | "legendary" | "optional";

const props = defineProps<{
  modelValue: Filter;
  tasks: Task[];
}>();

const emit = defineEmits<{ "update:modelValue": [value: Filter] }>();

const options = computed(() => {
  const t = Array.isArray(props.tasks) ? props.tasks : [];
  return [
    { key: "all" as const,       label: "ALL",       count: t.length },
    { key: "pending" as const,   label: "PENDING",   count: t.filter((x) => !x.completed).length },
    { key: "done" as const,      label: "DONE",      count: t.filter((x) =>  x.completed).length },
    { key: "legendary" as const, label: "LEGENDARY", count: t.filter((x) => !!x.legendary).length },
    { key: "optional" as const,  label: "OPTIONAL",  count: t.filter((x) => !!x.optional).length },
  ];
});
</script>
