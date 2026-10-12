<template>
  <!--
    Weekly boss portrait strip, responsive:
      - phone  (<640): 2x2 grid so the four portraits are still legible
      - tablet (640-1023): keep the 4-column row (the tablet width fits
        them at a smaller size)
      - desktop (>=1024): the original 4-column row
  -->
  <div
    class="weekly-boss-section"
    :class="[
      'grid gap-4 grid-cols-2 grid-rows-2',
      'sm:grid-cols-4 sm:grid-rows-1',
      'lg:gap-4',
    ]"
    style="margin-bottom: 2rem"
  >
    <WeeklyBossPortrait
      v-for="(week, index) in weeks"
      :key="week.uuid"
      :weekUuid="week.uuid"
      :weekIndex="index"
      :imageSrc="getWeekImage(week, index)"
      :weekName="week.name"
      :progress="week.progress"
      :subtitle="week.subtitle"
      :conquered="week.conquered"
      :isActive="currentWeek && currentWeek.uuid === week.uuid"
      @set-current-week="setCurrentWeek(week)"
    />
  </div>
</template>

<script setup lang="ts">
import WeeklyBossPortrait from "../WeeklyBossPortrait.vue";

defineProps<{
  weeks: any[];
  currentWeek: any;
  setCurrentWeek: (week: any) => void;
}>();

function getWeekImage(week: any, index: number | string) {
  // If week has a custom background image, use it
  if (week.backgroundImages && week.backgroundImages[0]) {
    return week.backgroundImages[0];
  }
  // Otherwise, use default week images (week-1.webp, week-2.webp, etc. — W5: 600px WebP)
  const weekNumber = Number(index) + 1;
  return `/images/week-${weekNumber}.webp`;
}
</script>