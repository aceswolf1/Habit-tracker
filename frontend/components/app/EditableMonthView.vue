<template>
  <!--
    Normal Editable View for Active Months. Fragment, not a wrapper <div>,
    so the resulting DOM matches the pre-split markup exactly.
  -->
  <template v-if="!isFinished && hasMonth">
    <WeekStrip
      :weeks="weeks"
      :currentWeek="currentWeek"
      :setCurrentWeek="setCurrentWeek"
    />
    <DayGrid
      :currentWeek="currentWeek"
      :currentDayUuid="currentDayUuid"
      :hasPrevWeek="hasPrevWeek"
      :hasNextWeek="hasNextWeek"
      :toggleTask="toggleTask"
      :openCreateTaskForDay="openCreateTaskForDay"
      :moveTask="moveTask"
      :openEditTask="openEditTask"
      :deleteSingleTask="deleteSingleTask"
      :setCurrentDay="setCurrentDay"
      :prevWeek="prevWeek"
      :nextWeek="nextWeek"
    />
    <ActionButtons
      :isFinished="isFinished"
      :hasMonth="hasMonth"
      :refreshData="refreshData"
      :openCreateTask="openCreateTask"
      :finishMonth="finishMonth"
    />
  </template>
</template>

<script setup lang="ts">
import WeekStrip from "./WeekStrip.vue";
import DayGrid from "./DayGrid.vue";
import ActionButtons from "./ActionButtons.vue";

defineProps<{
  isFinished: boolean;
  hasMonth: boolean;
  weeks: any[];
  currentWeek: any;
  currentDayUuid: string | null;
  hasPrevWeek: boolean;
  hasNextWeek: boolean;
  setCurrentWeek: (week: any) => void;
  setCurrentDay: (dayUuid: string) => void;
  prevWeek: () => void;
  nextWeek: () => void;
  toggleTask: (taskUuid: string) => void;
  openCreateTaskForDay: (dayUuid: string) => void;
  moveTask: (payload: { taskUuid: string; toDayUuid: string }) => void;
  openEditTask: (taskUuid: string) => void;
  deleteSingleTask: (taskUuid: string) => void;
  refreshData: () => void;
  openCreateTask: () => void;
  finishMonth: () => void;
}>();
</script>