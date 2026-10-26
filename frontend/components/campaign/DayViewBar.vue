<!--
  DayViewBar.vue — the Day Spotlight "View" panel:
    - status filter chips (TaskFilterBar),
    - Sort by (My order / Time of day / Due time / Pending first / Label / Name),
    - Group by label toggle.
  Sort + grouping are saved in settingsStore (localStorage); the filter is
  per-visit like before.
-->
<template>
  <div class="flex flex-col gap-2 px-1">
    <TaskFilterBar :modelValue="filter" :tasks="tasks" @update:modelValue="(v) => emit('update:filter', v)" />
    <div class="flex flex-wrap items-center gap-2 font-mono text-label-md uppercase">
      <label class="flex items-center gap-2 text-pp-muted">
        <span>Sort</span>
        <select
          class="min-h-[40px] sm:min-h-0 px-2 py-1 bg-pp-panel text-pp-text border border-pp-line hover:border-pp-cyan focus:border-pp-cyan outline-none uppercase"
          :value="settings.daySort"
          aria-label="Sort tasks"
          @change="onSort"
        >
          <option v-for="s in DAY_SORTS" :key="s" :value="s">{{ DAY_SORT_LABELS[s] }}</option>
        </select>
      </label>
      <button
        type="button"
        class="px-3 min-h-[40px] sm:min-h-0 sm:py-1 border transition-colors"
        :class="settings.groupByLabel
          ? 'bg-pp-cyan text-pp-void border-pp-cyan'
          : 'bg-pp-panel text-pp-text border-pp-line hover:border-pp-cyan'"
        :aria-pressed="settings.groupByLabel"
        @click="settings.setGroupByLabel(!settings.groupByLabel)"
      >Group by label</button>
      <span v-if="settings.daySort !== 'manual'" class="text-pp-muted normal-case tracking-normal">
        Switch to “My order” to reorder tasks.
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import TaskFilterBar, { type Filter } from "./TaskFilterBar.vue";
import { useSettingsStore } from "../../stores/settingsStore";
import { DAY_SORTS, DAY_SORT_LABELS, type DaySort } from "../../composables/useDayOrdering";
import type { Task } from "../../types/index";

defineProps<{ filter: Filter; tasks: Task[] }>();
const emit = defineEmits<{ "update:filter": [value: Filter] }>();

const settings = useSettingsStore();

function onSort(e: Event) {
  const value = (e.target as HTMLSelectElement).value as DaySort;
  if ((DAY_SORTS as readonly string[]).includes(value)) settings.setDaySort(value);
}
</script>
