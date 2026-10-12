<template>
  <!-- Effects layer (CRT scanlines, RGB shift, noise, vignette, flicker, overlay) -->
  <MonitorEffects />

  <!-- Toast Notifications (bus-driven via useAppEvents) -->
  <ToastNotification ref="toastRef" />

  <!-- Floating Points + Particle Burst components -->
  <FloatingPoints />
  <ParticleBurst />

  <!-- Fixed gradient depth background + ambient particles -->
  <AppBackground />

  <!-- Main wrapper -->
  <div
    class="main-wrapper relative min-h-screen flex items-start justify-center p-2 sm:p-4 z-[2]"
  >
    <div
      :class="[
        'inner-wrapper relative max-w-full sm:max-w-[92vw] w-full bg-pixel-dark/80 backdrop-blur-[2px] border-4 border-black p-3 sm:p-6 shadow-pixel',
        settingsStore.uiFont === 'cyber' ? 'font-cyber' : 'font-press'
      ]"
    >
      <AppHeader
        :currentMonth="currentMonth"
        :months="months"
        :lifetimeScore="lifetimeScore"
        :hasMonth="hasMonth"
        :isFinished="isFinished"
        :openSettings="openSettings"
      />

      <!-- Toggle Button for Finished Months -->
      <FinishedViewToggle
        :isFinished="isFinished"
        :hasMonth="hasMonth"
        :viewMode="viewMode"
        :toggleView="toggleView"
      />

      <!-- Statistics / Read-Only routing for finished months -->
      <StatsOrReadonly
        :isFinished="isFinished"
        :hasMonth="hasMonth"
        :viewMode="viewMode"
        :currentMonth="currentMonth"
      />

      <!-- Normal Editable View for Active Months -->
      <EditableMonthView
        :isFinished="isFinished"
        :hasMonth="hasMonth"
        :weeks="weeks"
        :currentWeek="currentWeek"
        :currentDayUuid="currentDayUuid"
        :hasPrevWeek="hasPrevWeek"
        :hasNextWeek="hasNextWeek"
        :setCurrentWeek="setCurrentWeek"
        :setCurrentDay="setCurrentDay"
        :prevWeek="prevWeek"
        :nextWeek="nextWeek"
        :toggleTask="toggleTask"
        :openCreateTaskForDay="openCreateTaskForDay"
        :moveTask="moveTask"
        :openEditTask="openEditTask"
        :deleteSingleTask="deleteSingleTask"
        :refreshData="refreshDataFromStore"
        :openCreateTask="openCreateTask"
        :finishMonth="finishMonth"
      />
    </div>
  </div>

  <!-- Modal hosts -->
  <ModalsHost
    :taskModalOpen="taskModalOpen"
    :selectedDayUuid="selectedDayUuid"
    :editingTaskUuid="editingTaskUuid"
    :currentWeek="currentWeek"
    :refreshData="refreshDataFromStore"
    :notify="notify"
    :modal="{ close: closeTaskModal }"
  />
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import { storeToRefs } from "pinia";
import { useMonthStore } from "./stores/monthStore";
import { useSettingsStore } from "./stores/settingsStore";
import { onAppEvent } from "./composables/useAppEvents";
import { useMonthPageState } from "./composables/useMonthPageState";
import { useTaskModal } from "./composables/useTaskModal";
import { useMonthViewMode } from "./composables/useMonthViewMode";
import { provideBreakpoints } from "./composables/useBreakpoint";

import MonitorEffects from "./components/app/MonitorEffects.vue";
import AppBackground from "./components/app/AppBackground.vue";
import AppHeader from "./components/app/AppHeader.vue";
import FinishedViewToggle from "./components/app/FinishedViewToggle.vue";
import StatsOrReadonly from "./components/app/StatsOrReadonly.vue";
import EditableMonthView from "./components/app/EditableMonthView.vue";
import ModalsHost from "./components/app/ModalsHost.vue";

import ToastNotification from "./components/ToastNotification.vue";
import FloatingPoints from "./components/FloatingPoints.vue";
import ParticleBurst from "./components/ParticleBurst.vue";

// W4b 404: the app is a single page with no `pages/` router, so Nuxt would
// render this shell for any URL. Anything other than "/" is a real 404 and
// is rendered by `error.vue` (SSR responds with status 404).
const requestPath = useRoute().path;
if (requestPath !== "/" && requestPath !== "") {
  throw createError({ statusCode: 404, statusMessage: "Page not found", fatal: true });
}

// Stores
const monthStore = useMonthStore();
const settingsStore = useSettingsStore();

// Page state composables
const {
  currentWeek,
  currentDayUuid,
  weeks,
  currentMonth,
  setCurrentWeek,
  setCurrentDay,
  prevWeek,
  nextWeek,
  hasPrevWeek,
  hasNextWeek,
  refreshDataFromStore,
  toggleTask,
  moveTask,
  deleteSingleTask,
} = useMonthPageState();

// W4b additions: provide reactive breakpoint state to deep descendants
// (AppHeader's TierBadge switches to compact mode on phones).
provideBreakpoints();
const {
  taskModalOpen,
  selectedDayUuid,
  editingTaskUuid,
  openCreateTask,
  openCreateTaskForDay,
  openEditTask,
  closeTaskModal,
} = useTaskModal();
const { viewMode, toggleView } = useMonthViewMode();

// Toast + reactive slices
const toastRef = ref<InstanceType<typeof ToastNotification> | null>(null);
const storeRefs: any = storeToRefs(monthStore as any);
const months = storeRefs.months;
const lifetimeScore = storeRefs.lifetimeScore;
const isFinished = computed(() => currentMonth.value?.finished || false);
const hasMonth = computed(() => !!currentMonth.value);

// Notify adapter object — ModalsHost calls these on create/edit/delete.
const notify = {
  created: () =>
    toastRef.value?.add({
      title: "HABIT ADDED",
      message: "New quest accepted!",
      type: "success",
    }),
  updated: () =>
    toastRef.value?.add({
      title: "HABIT UPDATED",
      message: "Quest parameters modified.",
      type: "info",
    }),
  deleted: () =>
    toastRef.value?.add({
      title: "HABIT REMOVED",
      message: "Quest abandoned.",
      type: "warning",
    }),
  singleDelete: () =>
    toastRef.value?.add({
      title: "HABIT REMOVED",
      message: "Quest abandoned.",
      type: "warning",
    }),
};

function openSettings() {
  settingsStore.toggleDrawer(true);
}

function finishMonth() {
  if (isFinished.value) return;
  const tier = tierText.value;
  const score = currentMonth.value?.score || 0;
  if (
    confirm(
      `Finish this month? You achieved ${tier} with ${score} XP.\n\nThis will lock all tasks and calculate statistics.`
    )
  ) {
    monthStore.finishCurrentMonth().then((result) => {
      if (result?.cycle) {
        toastRef.value?.add({
          title: "MONTH COMPLETED!",
          message: `${tier} earned! ${score} XP added to your legacy!`,
          type: "success",
        });
        viewMode.value = "stats";
      }
    });
  }
}

const tierText = computed(() => {
  const progress = currentMonth.value?.progress || 0;
  if (progress >= 90) return "CHAMPION TIER!";
  if (progress >= 75) return "GOLD TIER!";
  if (progress >= 50) return "SILVER TIER!";
  if (progress >= 25) return "BRONZE TIER!";
  return "BEGINNER TIER!";
});

// --- Typed event bus + legacy window listener (UB-54) ---
function handleToast(detail: {
  type: "success" | "error" | "info" | "warning";
  title: string;
  message: string;
}) {
  toastRef.value?.add({
    type: detail.type,
    title: detail.title,
    message: detail.message,
  });
}

// Typed-bus subscription (UB-54). Returned fn unsubscribes in onBeforeUnmount.
const toastFromBus = onAppEvent("toast", handleToast);

onMounted(async () => {
  await monthStore.fetchMonthData();
  if (!currentWeek.value && weeks.value.length) {
    setCurrentWeek(weeks.value[0]);
  }
});

onBeforeUnmount(() => {
  toastFromBus();
});
</script>

<style lang="scss">
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
}

.main-wrapper {
  transform: perspective(1000px) rotateX(0deg);
  filter: contrast(1.02) brightness(0.98);
}

body {
  animation: color-temperature 20s ease-in-out infinite;
}

/* UB-56: no page-wide colour drift for reduced-motion users. */
@media (prefers-reduced-motion: reduce) {
  body {
    animation: none;
  }
}

@keyframes color-temperature {
  0%, 100% {
    filter: hue-rotate(0deg) saturate(1);
  }
  50% {
    filter: hue-rotate(1deg) saturate(1.02);
  }
}
</style>
