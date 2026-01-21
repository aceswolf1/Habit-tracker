<template>
  <!-- Monitor Transmission Effects Container -->
  <div class="monitor-effects" aria-hidden="true">
    <!-- CRT Scan Lines -->
    <div class="crt-scanlines"></div>

    <!-- RGB Chromatic Aberration -->
    <div class="rgb-shift"></div>

    <!-- Screen Noise -->
    <div class="screen-noise"></div>

    <!-- Vignette Effect -->
    <div class="screen-vignette"></div>

    <!-- Subtle Flicker -->
    <div class="screen-flicker"></div>
  </div>

  <!-- CRT Overlay -->
  <div class="crt-overlay" aria-hidden="true"></div>

  <!-- Toast Notifications -->
  <ToastNotification ref="toastRef" />

  <!-- Fixed gradient depth background -->
  <div class="background-depth" aria-hidden="true"></div>
  <!-- Ambient particles across whole viewport -->
  <BackgroundParticles :count="120" :link-distance="150" :link-opacity="0.12" />
  <div
    class="main-wrapper relative min-h-screen flex items-start justify-center p-4 z-[2]"
  >
    <div
      :class="[ 'inner-wrapper relative max-w-[92vw] w-full bg-pixel-dark/80 backdrop-blur-[2px] border-4 border-black p-6 shadow-pixel', settingsStore.uiFont === 'cyber' ? 'font-cyber' : 'font-press' ]"
    >
      <!-- Page Content -->
      <header style="margin-bottom: 1.5rem">
        <div
          style="
            display: flex;
            justify-content: space-between;
            align-items: center;
          "
        >
          <h1
            style="
              font-family: 'Press Start 2P', cursive;
              color: white;
              font-size: 1.5rem;
              text-shadow: 2px 2px 0 #000;
            "
          >
            {{ monthName }}
          </h1>
          <div style="display: flex; align-items: center">
            <span
              style="
                color: white;
                margin-right: 0.5rem;
                font-family: 'Press Start 2P', cursive;
                text-shadow: 2px 2px 0 #000;
              "
              >PixelPaladin</span
            >

            <!-- Settings icon next to title -->
            <button
              @click="settingsStore.toggleDrawer(true)"
              style="background: transparent; border: 2px solid black; padding: 0.4rem; margin-right: 0.5rem; cursor: pointer; box-shadow: 2px 2px 0 rgba(0,0,0,0.5);"
              aria-label="Open settings"
            >
              ⚙️
            </button>

            <div
              style="
                background-color: rgb(239, 68, 68);
                padding: 0.5rem;
                border: 2px solid black;
                box-shadow: 2px 2px 0 rgba(0,0,0,0.5);
              "
            >
              <span style="font-size: 1.25rem">🎁</span>
            </div>
          </div>
        </div>
        <MonthSelector v-if="months.length" />
        <div v-if="hasMonth" style="margin-top: 0.5rem">
          <div
            style="
              display: flex;
              justify-content: space-between;
              align-items: center;
              color: white;
              font-family: 'Press Start 2P', cursive;
              font-size: 0.75rem;
              margin-bottom: 0.25rem;
            "
          >
            <span>OVERALL PROGRESS</span>
            <span>{{ displayMonthProgress }}</span>
          </div>
          <div
            :class="['month-progress-wrapper', { completed: isMonthComplete }]"
          >
            <!-- Particle layer -->
            <ProgressParticles :progress="monthProgress" />
            <!-- Fill Bar -->
            <div
              :style="{
                width: Math.min(monthProgress, 100) + '%',
                height: '100%',
                backgroundColor: monthProgressBarColor,
                position: 'absolute',
                top: 0,
                left: 0,
                transition: 'width 0.4s ease',
              }"
            ></div>
            <div class="month-progress-text">
              {{ getTierText }}
            </div>
            <!-- Shimmer overlay -->
            <div v-if="isMonthComplete" class="month-shine" />
          </div>
        </div>
        <div v-else class="flex flex-col items-center gap-2 mt-4 font-mono text-center text-white">
          <div class="text-2xl animate-bounce">👾</div>
          <div class="text-xs font-press animate-pulse">LOADING WORLD...</div>
        </div>
        <div
          v-if="hasMonth"
          style="
            display: flex;
            justify-content: space-between;
            margin-top: 1rem;
          "
        >
          <div style="text-align: center">
            <div
              :style="{
                width: '2.5rem',
                height: '2.5rem',
                backgroundColor: monthProgress >= 25 ? '#f59e0b' : '#374151',
                border: '2px solid black',
                margin: '0 auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.25rem',
                boxShadow: '2px 2px 0 rgba(0,0,0,0.5)'
              }"
            >
              🏆
            </div>
            <div
              :style="{
                color: monthProgress >= 25 ? '#fbbf24' : 'white',
                fontFamily: '\'Press Start 2P\', cursive',
                fontSize: '0.75rem',
                marginTop: '0.25rem',
              }"
            >
              Bronze
            </div>
          </div>
          <div style="text-align: center">
            <div
              :style="{
                width: '2.5rem',
                height: '2.5rem',
                backgroundColor: monthProgress >= 50 ? '#f59e0b' : '#374151',
                border: '2px solid black',
                margin: '0 auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.25rem',
                boxShadow: '2px 2px 0 rgba(0,0,0,0.5)'
              }"
            >
              🏆
            </div>
            <div
              :style="{
                color: monthProgress >= 50 ? '#fbbf24' : 'white',
                fontFamily: '\'Press Start 2P\', cursive',
                fontSize: '0.75rem',
                marginTop: '0.25rem',
              }"
            >
              Silver
            </div>
          </div>
          <div style="text-align: center">
            <div
              :style="{
                width: '2.5rem',
                height: '2.5rem',
                backgroundColor: monthProgress >= 75 ? '#f59e0b' : '#374151',
                border: '2px solid black',
                margin: '0 auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.25rem',
                boxShadow: '2px 2px 0 rgba(0,0,0,0.5)'
              }"
            >
              ⚔️
            </div>
            <div
              :style="{
                color: monthProgress >= 75 ? '#fbbf24' : 'white',
                fontFamily: '\'Press Start 2P\', cursive',
                fontSize: '0.75rem',
                marginTop: '0.25rem',
              }"
            >
              Gold
            </div>
          </div>
          <div style="text-align: center">
            <div
              :style="{
                width: '2.5rem',
                height: '2.5rem',
                backgroundColor: monthProgress >= 90 ? '#f59e0b' : '#374151',
                border: '2px solid black',
                margin: '0 auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.25rem',
                boxShadow: '2px 2px 0 rgba(0,0,0,0.5)'
              }"
            >
              👑
            </div>
            <div
              :style="{
                color: monthProgress >= 90 ? '#fbbf24' : 'white',
                fontFamily: '\'Press Start 2P\', cursive',
                fontSize: '0.75rem',
                marginTop: '0.25rem',
              }"
            >
              Champion
            </div>
          </div>
          <div style="text-align: center">
            <div
              :style="{
                width: '2.5rem',
                height: '2.5rem',
                backgroundColor: monthProgress >= 100 ? '#f59e0b' : '#374151',
                border: '2px solid black',
                margin: '0 auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.25rem',
                boxShadow: '2px 2px 0 rgba(0,0,0,0.5)'
              }"
            >
              ✨
            </div>
            <div
              :style="{
                color: monthProgress >= 100 ? '#fbbf24' : 'white',
                fontFamily: '\'Press Start 2P\', cursive',
                fontSize: '0.75rem',
                marginTop: '0.25rem',
              }"
            >
              Final
            </div>
          </div>
        </div>
      </header>

      <!-- Weekly Boss Section -->
      <div v-if="hasMonth" class="weekly-boss-section">
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
        <div class="selected-week-boos"></div>
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
          :weekUuid="currentWeek ? currentWeek.uuid : null"
          :name="day.name"
          :tasks="day.tasks"
          headerColor="#f59e0b"
          headerTextColor="black"
          @toggle-task="toggleTask"
          @add-task="openCreateTaskForDay"
          @move-task="moveTask"
          @edit-task="openEditTask"
          @delete-task="deleteSingleTask"
        />
      </div>

      <!-- Stats Section -->
      <div
        v-if="hasMonth"
        class="stats-section"
        style="
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1rem;
          margin-bottom: 1.5rem;
        "
      >
        <StreakCounter
          title="MONTHLY STREAK"
          :count="42"
          subtitle="Months Completed"
          color="#4ade80"
        />

        <StreakCounter
          title="WEEK STREAK"
          count="4 Weeks"
          subtitle="Keep it up!"
          icon="🔥"
          color="#fb923c"
        />

        <StreakCounter
          title="CURRENT STREAK"
          count="4 Days"
          subtitle="Keep it up!"
          icon="🔥"
          color="#fb923c"
        />
      </div>

      <!-- Action Buttons -->
      <div
        class="action-buttons"
        style="
          display: flex;
          justify-content: center;
          gap: 1rem;
          flex-wrap: wrap;
        "
      >
        <button
          style="
            font-family: 'Press Start 2P', cursive;
            color: white;
            border: 2px solid black;
            position: relative;
            display: inline-block;
            box-shadow: 4px 4px 0 rgba(0, 0, 0, 0.8);
            transform: translate(-2px, -2px);
            transition: transform 0.1s, box-shadow 0.1s;
            background-color: #1d4ed8;
            font-size: 0.75rem;
            padding: 0.5rem 1rem;
          "
        >
          CERTIFICATE
        </button>
        <button
          @click="refreshDataFromStore"
          style="
            font-family: 'Press Start 2P', cursive;
            color: white;
            border: 2px solid black;
            position: relative;
            display: inline-block;
            box-shadow: 4px 4px 0 rgba(0, 0, 0, 0.8);
            transform: translate(-2px, -2px);
            transition: transform 0.1s, box-shadow 0.1s;
            background-color: #1d4ed8;
            font-size: 0.75rem;
            padding: 0.5rem 1rem;
          "
        >
          REFRESH DATA
        </button>
        <button
          :disabled="isFinished"
          @click="openCreateTask"
          :style="addButtonStyle"
        >
          + ADD HABIT
        </button>
        <button
          v-if="hasMonth"
          :disabled="isFinished"
          @click="finishMonth"
          :style="finishButtonStyle"
        >
          {{ isFinished ? "FINISHED" : "FINISH MONTH" }}
        </button>
      </div>
    </div>
  </div>
  <TaskModal
    :open="taskModalOpen"
    :weekUuid="currentWeek ? currentWeek.uuid : null"
    :prefillDayUuid="selectedDayUuid"
    :editTaskUuid="editingTaskUuid"
    @close="closeTaskModal"
    @created="onTaskCreated"
    @updated="onTaskUpdated"
    @deleted="onTaskDeleted"
  />
  <SettingsDrawer />
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import WeeklyBossPortrait from "./components/WeeklyBossPortrait.vue";
import StreakCounter from "./components/StreakCounter.vue";
import Day from "./components/Day.vue";
import TaskModal from "./components/TaskModal.vue";
import MonthSelector from "./components/MonthSelector.vue";
import ProgressParticles from "./components/ProgressParticles.vue";
import BackgroundParticles from "./components/BackgroundParticles.vue";
import ToastNotification from "./components/ToastNotification.vue";
import SettingsDrawer from "./components/SettingsDrawer.vue";
import { storeToRefs } from "pinia";
import { useMonthStore } from "./stores/monthStore";
import { useSettingsStore } from "./stores/settingsStore";
//import "./assets/css/crt.css";

// Get the month store
const monthStore = useMonthStore();
const settingsStore = useSettingsStore();

const currentWeek = ref<any>(null);
const taskModalOpen = ref(false);
const selectedDayUuid = ref<string | null>(null);
const editingTaskUuid = ref<string | null>(null);
const toastRef = ref<InstanceType<typeof ToastNotification> | null>(null);

function openEditTask(taskUuid: string) {
  editingTaskUuid.value = taskUuid;
  taskModalOpen.value = true;
}

function openCreateTask() {
  if (!currentWeek.value) {
    return;
  }
  selectedDayUuid.value = null;
  editingTaskUuid.value = null;
  taskModalOpen.value = true;
}
function openCreateTaskForDay(dayUuid: string) {
  if (!currentWeek.value) return;
  selectedDayUuid.value = dayUuid;
  editingTaskUuid.value = null;
  taskModalOpen.value = true;
}
function closeTaskModal() {
  taskModalOpen.value = false;
  selectedDayUuid.value = null;
  editingTaskUuid.value = null;
}

function onTaskCreated() {
  refreshDataFromStore();
  toastRef.value?.add({
    title: "HABIT ADDED",
    message: "New quest accepted!",
    type: "success",
  });
}

function onTaskUpdated() {
  refreshDataFromStore();
  toastRef.value?.add({
    title: "HABIT UPDATED",
    message: "Quest parameters modified.",
    type: "info",
  });
}

function onTaskDeleted() {
  refreshDataFromStore();
  toastRef.value?.add({
    title: "HABIT REMOVED",
    message: "Quest abandoned.",
    type: "warning",
  });
}

// Use storeToRefs to maintain reactivity when accessing store state
const storeRefs: any = storeToRefs(monthStore as any);
const currentMonth = storeRefs.currentMonth;
const isLoading = storeRefs.isLoading;
const months = storeRefs.months;
const isFinished = computed(() => currentMonth.value?.finished || false);

const baseBtn = {
  fontFamily: "'Press Start 2P', cursive",
  color: "white",
  border: "2px solid black",
  position: "relative",
  display: "inline-block",
  boxShadow: "4px 4px 0 rgba(0,0,0,0.8)",
  transform: "translate(-2px,-2px)",
  transition: "transform 0.1s, box-shadow 0.1s",
  fontSize: "0.75rem",
  padding: "0.5rem 1rem",
};
const addButtonStyle = computed(
  () =>
    ({
      ...(baseBtn as any),
      backgroundColor: "#1d4ed8",
      opacity: isFinished.value ? 0.5 : 1,
      cursor: isFinished.value ? "not-allowed" : "pointer",
    } as any)
);
const finishButtonStyle = computed(
  () =>
    ({
      ...(baseBtn as any),
      backgroundColor: "#dc2626",
      opacity: isFinished.value ? 0.5 : 1,
      cursor: isFinished.value ? "not-allowed" : "pointer",
    } as any)
);

const hasMonth = computed(() => !!currentMonth.value);

// Create computed properties for relevant data (guarded)
const monthName = computed(() => currentMonth.value?.name || "");
const monthSubtitle = computed(() => currentMonth.value?.subtitle || "");
const monthProgress = computed(() => currentMonth.value?.progress || 0);
// Month considered complete at >=100 (base) even if bonus pushes higher
const isMonthComplete = computed(() => monthProgress.value >= 100);
// Display clamps at 100 for primary percent but shows bonus indicator if >100
const displayMonthProgress = computed(() => {
  if (monthProgress.value <= 100) return monthProgress.value + "%";
  return `100% +${monthProgress.value - 100}%`;
});

const monthProgressBarColor = computed(() => {
  const p = monthProgress.value;
  if (p >= 100) return "#f59e0b"; // gold for completed (even bonus)
  if (p >= 75) return "#fbbf24";
  if (p >= 50) return "#fbbf24";
  if (p >= 25) return "#fbbf24";
  return "#ef4444";
});

const weeks = computed(() => currentMonth.value?.weeks || []);

// Computed property for the tier text based on progress
const getTierText = computed(() => {
  const progress = monthProgress.value;
  if (progress >= 90) return "CHAMPION TIER!";
  if (progress >= 75) return "GOLD TIER!";
  if (progress >= 50) return "SILVER TIER!";
  if (progress >= 25) return "BRONZE TIER!";
  return "BEGINNER TIER!";
});

// Function to get week image with default fallback
function getWeekImage(week: any, index: number | string) {
  // If week has a custom background image, use it
  if (week.backgroundImages && week.backgroundImages[0]) {
    return week.backgroundImages[0];
  }
  // Otherwise, use default week images (week-1.png, week-2.png, etc.)
  const weekNumber = Number(index) + 1;
  return `/images/week-${weekNumber}.png`;
}

// Function to refresh all reactive data from the store
function refreshDataFromStore() {
  console.log("Refreshing UI data from store...");
  if (currentWeek.value) {
    const updatedWeek = monthStore.getWeekByUuid(currentWeek.value.uuid);
    if (updatedWeek) {
      currentWeek.value = { ...updatedWeek };
    }
  }
}

// Function to handle toggling task completion
function toggleTask(taskUuid: string) {
  monthStore.toggleTaskCompletion(taskUuid);
  refreshDataFromStore();
}

function addTask() {
  toastRef.value?.add({
    title: "COMING SOON",
    message: "Feature under construction",
    type: "info",
  });
}

const setCurrentWeek = (weekOrUuid: any) => {
  const uuid = typeof weekOrUuid === "string" ? weekOrUuid : weekOrUuid.uuid;
  const storeWeek = monthStore.getWeekByUuid(uuid);
  if (storeWeek) {
    currentWeek.value = storeWeek;
  }
};

watch(
  () => currentMonth.value,
  (newMonth) => {
    if (!newMonth) return;
    if (currentWeek.value) {
      const updatedWeek = newMonth.weeks.find(
        (w: any) => w.uuid === currentWeek.value.uuid
      );
      if (updatedWeek) {
        currentWeek.value = { ...updatedWeek };
      }
    } else if (newMonth.weeks?.length) {
      setCurrentWeek(newMonth.weeks[0]);
    }
  },
  { deep: true }
);

onMounted(async () => {
  await monthStore.fetchMonthData();
  if (!currentWeek.value && weeks.value.length) {
    setCurrentWeek(weeks.value[0]);
  }
});

function finishMonth() {
  if (isFinished.value) return;
  if (confirm("Finish this month? This will lock all tasks.")) {
    monthStore.finishCurrentMonth();
    toastRef.value?.add({
      title: "MONTH COMPLETED",
      message: "Your journey is recorded in history.",
      type: "success",
    });
  }
}

function moveTask(payload: { taskUuid: string; toDayUuid: string }) {
  if (isFinished.value) return;
  monthStore.moveTask(payload.taskUuid, payload.toDayUuid);
  refreshDataFromStore();
}
function deleteSingleTask(taskUuid: string) {
  if (isFinished.value) return;
  monthStore.deleteTask(taskUuid, "single");
  refreshDataFromStore();
  toastRef.value?.add({
    title: "HABIT REMOVED",
    message: "Quest abandoned.",
    type: "warning",
  });
}
</script>

<style lang="scss">
.background-depth {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background: radial-gradient(
      circle at 65% 50%,
      rgba(60, 95, 150, 0.35) 0%,
      rgba(10, 18, 32, 0.05) 55%,
      rgba(4, 8, 16, 0.9) 85%
    ),
    radial-gradient(
      circle at 25% 70%,
      rgba(120, 150, 200, 0.18) 0%,
      rgba(10, 18, 32, 0) 60%
    ),
    linear-gradient(140deg, #0a101b 0%, #0d1625 40%, #070b14 70%, #05080e 100%);
  background-repeat: no-repeat;
  background-attachment: fixed, fixed, fixed;
  animation: bg-slow-shift 34s ease-in-out infinite alternate;
  /* subtle star speckle overlay */
  mask-image: radial-gradient(
    circle at 50% 50%,
    #000 0%,
    #000 75%,
    rgba(0, 0, 0, 0.85) 100%
  );
}

.main-wrapper {
  width: 100%;
  z-index: 2;

  .inner-wrapper {
    min-height: 92vh;
    display: flex;
    flex-direction: column;
    justify-content: center;
    grid-template-areas:
      "header header"
      "weekly-boss weekly-boss"
      "daily-habit daily-habit"
      "stats stats"
      "actions actions";
  }

  .daily-habit-grid {
    min-height: 46vh;
  }

  .weekly-boss-section {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1rem;
    margin-bottom: 2rem;
  }
}

@keyframes bg-slow-shift {
  0% {
    filter: brightness(1) contrast(1);
  }
  45% {
    filter: brightness(1.05) contrast(1.04);
  }
  100% {
    filter: brightness(1) contrast(1.02);
  }
}

/* Month progress bar completion effect (mirrors task completion aesthetic) */
.month-progress-wrapper {
  width: 100%;
  height: 1.5rem;
  background-color: #374151;
  position: relative;
  border: 2px solid black;
  overflow: hidden;
  box-shadow: 0 0 0 0 #000 inset;
  transition: box-shadow 0.4s;
}
.month-progress-wrapper.completed {
  background: linear-gradient(#374151, #374151) padding-box,
    linear-gradient(
        130deg,
        #6d5206,
        #b8860b,
        #ffd700,
        #fff7c2,
        #ffd700,
        #b8860b,
        #6d5206
      )
      border-box;
  animation: month-border-shine 8s linear infinite,
    month-glow-pulse 2.5s ease-in-out infinite;
  box-shadow: 0 0 6px 2px #ffd70055, 0 0 18px 4px #ffeb8a44,
    0 0 32px 10px #ffd70022;
}
.month-progress-wrapper.completed::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(
    115deg,
    transparent 0%,
    rgba(255, 255, 255, 0.15) 45%,
    rgba(255, 255, 255, 0.6) 50%,
    rgba(255, 255, 255, 0.15) 55%,
    transparent 100%
  );
  background-size: 250% 250%;
  mix-blend-mode: screen;
  pointer-events: none;
  animation: month-sweep 4.5s linear infinite;
}
.month-progress-text {
  position: relative;
  text-align: center;
  padding: 0.25rem 0;
  color: white;
  font-family: "Press Start 2P", cursive;
  font-size: 0.75rem;
  z-index: 2;
}
.month-shine {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(
    circle at center,
    #ffd70033 0%,
    #ffd70005 70%,
    transparent 80%
  );
  animation: month-backdrop-fade 1.6s ease-out infinite;
  mix-blend-mode: screen;
}
@keyframes month-border-shine {
  0% {
    background-position: 0% 0%, 0% 50%;
  }
  50% {
    background-position: 100% 100%, 50% 50%;
  }
  100% {
    background-position: 0% 0%, 100% 50%;
  }
}
@keyframes month-glow-pulse {
  0% {
    box-shadow: 0 0 4px 1px #ffd70066, 0 0 14px 3px #ffec8f55,
      0 0 26px 6px #ffd70022;
  }
  50% {
    box-shadow: 0 0 10px 2px #ffd700aa, 0 0 26px 8px #ffec8f66,
      0 0 42px 14px #ffd70033;
  }
  100% {
    box-shadow: 0 0 4px 1px #ffd70066, 0 0 14px 3px #ffec8f55,
      0 0 26px 6px #ffd70022;
  }
}
@keyframes month-sweep {
  0% {
    background-position: 200% 0%;
    opacity: 0;
  }
  8% {
    opacity: 1;
  }
  23% {
    background-position: 0% 100%;
    opacity: 0.9;
  }
  30% {
    opacity: 0;
  }
  100% {
    background-position: 0% 100%;
    opacity: 0;
  }
}
@keyframes month-backdrop-fade {
  0% {
    opacity: 0;
  }
  35% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}

/* ==================== MONITOR TRANSMISSION EFFECTS ==================== */

.monitor-effects {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 9998;
  overflow: hidden;
}

/* Subtle CRT Scanlines */
.crt-scanlines {
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    0deg,
    rgba(0, 0, 0, 0.03) 0px,
    rgba(0, 0, 0, 0.03) 1px,
    transparent 1px,
    transparent 2px
  );
  animation: scanlines-scroll 8s linear infinite;
  opacity: 0.5;
  z-index: 1;
}

@keyframes scanlines-scroll {
  0% {
    transform: translateY(0);
  }
  100% {
    transform: translateY(4px);
  }
}

/* RGB Chromatic Aberration */
.rgb-shift {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse at 30% 30%, rgba(255, 0, 0, 0.015) 0%, transparent 50%),
    radial-gradient(ellipse at 70% 70%, rgba(0, 255, 0, 0.015) 0%, transparent 50%),
    radial-gradient(ellipse at 50% 50%, rgba(0, 0, 255, 0.015) 0%, transparent 50%);
  mix-blend-mode: screen;
  animation: rgb-drift 10s ease-in-out infinite;
  z-index: 2;
}

@keyframes rgb-drift {
  0%, 100% {
    opacity: 0.3;
  }
  50% {
    opacity: 0.5;
  }
}

/* Screen Noise/Static */
.screen-noise {
  position: absolute;
  inset: 0;
  background-image:
    repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255, 255, 255, 0.01) 2px, rgba(255, 255, 255, 0.01) 4px),
    repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(255, 255, 255, 0.01) 2px, rgba(255, 255, 255, 0.01) 4px);
  animation: noise-shift 0.5s steps(4) infinite;
  opacity: 0.4;
  z-index: 3;
}

@keyframes noise-shift {
  0%, 100% {
    background-position: 0 0, 0 0;
  }
  25% {
    background-position: 1px 1px, -1px 0;
  }
  50% {
    background-position: -1px 0, 1px -1px;
  }
  75% {
    background-position: 0 -1px, -1px 1px;
  }
}

/* Vignette Effect */
.screen-vignette {
  position: absolute;
  inset: 0;
  background: radial-gradient(
    ellipse at center,
    transparent 0%,
    transparent 60%,
    rgba(0, 0, 0, 0.15) 100%
  );
  z-index: 4;
}

/* Subtle Screen Flicker */
.screen-flicker {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.02);
  animation: flicker-effect 5s ease-in-out infinite;
  z-index: 5;
}

@keyframes flicker-effect {
  0%, 100% {
    opacity: 0;
  }
  5% {
    opacity: 1;
  }
  10% {
    opacity: 0;
  }
  15% {
    opacity: 0.5;
  }
  20% {
    opacity: 0;
  }
  80% {
    opacity: 0;
  }
  85% {
    opacity: 0.3;
  }
  90% {
    opacity: 0;
  }
}

/* Add subtle screen curvature to main content */
.main-wrapper {
  transform: perspective(1000px) rotateX(0deg);
  filter: contrast(1.02) brightness(0.98);
}

/* Add subtle color shift to simulate old monitor */
body {
  animation: color-temperature 20s ease-in-out infinite;
}

@keyframes color-temperature {
  0%, 100% {
    filter: hue-rotate(0deg) saturate(1);
  }
  50% {
    filter: hue-rotate(1deg) saturate(1.02);
  }
}

/* Enhance the existing CRT overlay */
.crt-overlay {
  position: fixed;
  inset: 0;
  background:
    repeating-linear-gradient(
      0deg,
      rgba(0, 0, 0, 0.15),
      rgba(0, 0, 0, 0.15) 1px,
      transparent 1px,
      transparent 2px
    );
  pointer-events: none;
  z-index: 9999;
  opacity: 0.2;
  mix-blend-mode: multiply;
  animation: crt-flicker 0.15s infinite;
}

@keyframes crt-flicker {
  0% {
    opacity: 0.2;
  }
  50% {
    opacity: 0.22;
  }
  100% {
    opacity: 0.2;
  }
}
</style>
