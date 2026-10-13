<!--
  EditableMonthView.vue (W2 rewrite).

  Thin shell that mounts the V2 CampaignView when the month is active
  and unfinished. The legacy `WeekStrip` + `DayGrid` components have
  been removed (W2 A7); the old `Day.vue` / `Task.vue` / etc. are still
  on disk because `ReadOnlyMonthView.vue` (W1 Wave B) depends on them.

  Inherits the same incoming props as before so `app.vue` doesn't
  change. `month` is read from the store inside `CampaignView` so the
  parent doesn't need to forward it.
-->
<template>
  <template v-if="!isFinished && hasMonth">
    <CampaignView :isFinished="isFinished" :hasMonth="hasMonth" />
  </template>
</template>

<script setup lang="ts">
import CampaignView from "../campaign/CampaignView.vue";

defineProps<{
  isFinished: boolean;
  hasMonth: boolean;
  // The following are still in the prop signature so app.vue doesn't
  // need to change; CampaignView pulls what it needs from the store
  // directly. Kept as unused-but-typed to avoid breaking callers.
  weeks?: unknown[];
  currentWeek?: unknown;
  currentDayUuid?: string | null;
  hasPrevWeek?: boolean;
  hasNextWeek?: boolean;
  setCurrentWeek?: (w: unknown) => void;
  setCurrentDay?: (uuid: string) => void;
  prevWeek?: () => void;
  nextWeek?: () => void;
  toggleTask?: (uuid: string) => void;
  openCreateTaskForDay?: (uuid: string) => void;
  moveTask?: (payload: { taskUuid: string; toDayUuid: string }) => void;
  openEditTask?: (uuid: string) => void;
  deleteSingleTask?: (uuid: string) => void;
  refreshData?: () => void;
  openCreateTask?: () => void;
  finishMonth?: () => void;
}>();
</script>
