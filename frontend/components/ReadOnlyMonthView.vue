<template>
  <div class="read-only-month-view">
    <!-- Locked Banner -->
    <div class="locked-banner">
      <span class="lock-icon">🔒</span>
      <span class="lock-text">THIS MONTH IS LOCKED</span>
      <span class="lock-icon">🔒</span>
    </div>

    <!-- Weekly Boss Section -->
    <div class="weekly-boss-section">
      <WeeklyBossPortrait
        v-for="(week, index) in month.weeks"
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

    <!-- Daily Habit Grid -->
    <div
      v-if="currentWeek"
      class="daily-habit-grid"
      style="
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 0.25rem;
        margin-bottom: 1.5rem;
      "
    >
      <Day
        v-for="day in currentWeek.days"
        :key="day.uuid"
        :dayUuid="day.uuid"
        :day="day"
        :weekUuid="currentWeek.uuid"
        :name="day.name"
        :tasks="day.tasks"
        headerColor="#374151"
        headerTextColor="white"
        :readonly="true"
      />
    </div>

    <div class="readonly-watermark">
      <span>📜 ARCHIVED MONTH 📜</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import WeeklyBossPortrait from './WeeklyBossPortrait.vue';
import Day from './Day.vue';

interface Props {
  month: any;
}

const props = defineProps<Props>();
const currentWeek = ref<any>(null);

function getWeekImage(week: any, index: number | string) {
  if (week.backgroundImages && week.backgroundImages[0]) {
    return week.backgroundImages[0];
  }
  const weekNumber = Number(index) + 1;
  return `/images/week-${weekNumber}.png`;
}

function setCurrentWeek(week: any) {
  currentWeek.value = week;
}

onMounted(() => {
  if (props.month?.weeks?.length && !currentWeek.value) {
    currentWeek.value = props.month.weeks[0];
  }
});
</script>

<style scoped lang="scss">
.read-only-month-view {
  position: relative;
  opacity: 0.9;
  pointer-events: none; // Disable all interactions
}

.locked-banner {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  margin-bottom: 2rem;
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.3) 0%, rgba(220, 38, 38, 0.3) 100%);
  border: 3px solid #ef4444;
  box-shadow: 4px 4px 0 rgba(0, 0, 0, 0.8);
  animation: locked-pulse 2s ease-in-out infinite;
}

@keyframes locked-pulse {
  0%, 100% {
    box-shadow: 4px 4px 0 rgba(0, 0, 0, 0.8), 0 0 10px rgba(239, 68, 68, 0.3);
  }
  50% {
    box-shadow: 4px 4px 0 rgba(0, 0, 0, 0.8), 0 0 20px rgba(239, 68, 68, 0.5);
  }
}

.lock-icon {
  font-size: 1.5rem;
}

.lock-text {
  font-family: 'Press Start 2P', cursive;
  font-size: 1rem;
  color: #ef4444;
  text-shadow: 2px 2px 0 #000;
}

.weekly-boss-section {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
  margin-bottom: 2rem;
  filter: grayscale(0.3);
}

.daily-habit-grid {
  min-height: 46vh;
  filter: grayscale(0.2);
}

.readonly-watermark {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) rotate(-15deg);
  font-family: 'Press Start 2P', cursive;
  font-size: 2rem;
  color: rgba(255, 255, 255, 0.1);
  text-shadow: 3px 3px 0 rgba(0, 0, 0, 0.2);
  pointer-events: none;
  z-index: 10;
  white-space: nowrap;
}
</style>
