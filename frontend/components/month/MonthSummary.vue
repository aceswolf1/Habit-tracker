<template>
  <div class="month-summary">
    <h1 class="text-2xl font-bold mb-4">
      {{ month.name }} - {{ month.subtitle }}
    </h1>
    <div class="progress-bar mb-6">
      <div class="bg-gray-200 rounded-full h-4 w-full">
        <div
          class="bg-green-500 h-4 rounded-full"
          :style="{ width: `${month.progress}%` }"
        ></div>
      </div>
      <p class="text-sm mt-1">{{ month.progress }}% Complete</p>
    </div>

    <div class="weeks-grid">
      <div
        v-for="week in month.weeks"
        :key="week.uuid"
        class="week-card mb-6 p-4 bg-gray-100 rounded-lg"
      >
        <h2 class="text-lg font-bold">{{ week.name }} - {{ week.subtitle }}</h2>
        <div class="progress-bar my-2">
          <div class="bg-gray-300 rounded-full h-3 w-full">
            <div
              class="bg-blue-500 h-3 rounded-full"
              :style="{ width: `${week.progress}%` }"
            ></div>
          </div>
          <p class="text-xs mt-1">{{ week.progress }}% Complete</p>
        </div>

        <!-- Days summary - just showing counts to keep it simple -->
        <p class="text-sm mt-2">
          {{ week.days.length }} days, {{ getTotalTasksInWeek(week) }} total
          tasks, {{ getCompletedTasksInWeek(week) }} completed
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from "pinia";
import { useMonthStore } from "../../stores/monthStore";
import { Week } from "../../types";

const monthStore = useMonthStore();
const { currentMonth: month } = storeToRefs(monthStore);

// Helper function to count total tasks in a week
const getTotalTasksInWeek = (week: Week): number => {
  return week.days.reduce((total, day) => total + day.tasks.length, 0);
};

// Helper function to count completed tasks in a week
const getCompletedTasksInWeek = (week: Week): number => {
  return week.days.reduce((total, day) => {
    return total + day.tasks.filter((task) => task.completed).length;
  }, 0);
};
</script>

<style scoped>
.month-summary {
  max-width: 800px;
  margin: 0 auto;
}

.weeks-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1rem;
}

.week-card {
  transition: transform 0.2s ease;
}

.week-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}
</style>
