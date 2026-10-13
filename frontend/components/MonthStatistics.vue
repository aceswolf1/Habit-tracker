<!--
  MonthStatistics.vue (W1 restyle, V2 Combat Deck).

  Read-only view rendered after a cycle is `finished: true`. Composes
  the eight `stats/*` sections in the order the contract calls for.
  No animations, no pixel font, sharp 1px `--pp-line` rhythm between
  sections.
-->
<template>
  <div class="month-statistics">
    <HeroSection :statistics="statistics" />

    <WeekPerformanceGrid :statistics="statistics" />

    <HighlightsGrid :statistics="statistics" />

    <TaskInsightsGrid :statistics="statistics" />

    <BestWorstHabits :statistics="statistics" />

    <DayOfWeekAnalysis :statistics="statistics" />

    <AchievementsSection :statistics="statistics" />

    <StatsFooter :month="month" />
  </div>
</template>

<script setup lang="ts">
import HeroSection from './stats/HeroSection.vue';
import WeekPerformanceGrid from './stats/WeekPerformanceGrid.vue';
import HighlightsGrid from './stats/HighlightsGrid.vue';
import TaskInsightsGrid from './stats/TaskInsightsGrid.vue';
import BestWorstHabits from './stats/BestWorstHabits.vue';
import DayOfWeekAnalysis from './stats/DayOfWeekAnalysis.vue';
import AchievementsSection from './stats/AchievementsSection.vue';
import StatsFooter from './stats/StatsFooter.vue';

defineProps<{
  month: any;
  statistics: any;
}>();
</script>

<style scoped>
.month-statistics {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  max-width: 1100px;
}
</style>