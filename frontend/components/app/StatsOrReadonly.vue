<template>
  <!--
    Routes between Statistics / ReadOnlyMonth views for finished months.
    Caller passes `currentMonth` so each child gets the same props.
  -->
  <MonthStatistics
    v-if="isFinished && viewMode === 'stats' && hasMonth"
    :month="currentMonth"
    :statistics="currentMonth?.statistics"
  />

  <ReadOnlyMonthView
    v-else-if="isFinished && viewMode === 'details' && hasMonth"
    :month="currentMonth"
  />
</template>

<script setup lang="ts">
import MonthStatistics from "../MonthStatistics.vue";
import ReadOnlyMonthView from "../ReadOnlyMonthView.vue";
import type { ViewMode } from "../../composables/useMonthViewMode";

defineProps<{
  isFinished: boolean;
  hasMonth: boolean;
  viewMode: ViewMode;
  currentMonth: any;
}>();
</script>