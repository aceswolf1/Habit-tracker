<template>
  <div class="month-statistics">
    <!-- Hero Section -->
    <HeroSection :statistics="statistics" />

    <!-- Week Performance Section -->
    <WeekPerformanceGrid :statistics="statistics" />

    <!-- Week Highlights -->
    <HighlightsGrid :statistics="statistics" />

    <!-- Task Insights Section -->
    <TaskInsightsGrid :statistics="statistics" />

    <!-- Best & Worst Habits -->
    <BestWorstHabits :statistics="statistics" />

    <!-- Day of Week Analysis -->
    <DayOfWeekAnalysis :statistics="statistics" />

    <!-- Achievement Summary -->
    <AchievementsSection :statistics="statistics" />

    <!-- Footer Info -->
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

<style scoped lang="scss">
.month-statistics {
  display: flex;
  flex-direction: column;
  gap: 2rem;
  animation: fadeIn 0.5s ease-in;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>