<template>
  <!-- Static Combat Deck background (CSS-only, no canvas). -->
  <AppBackground />

  <!-- Toast Notifications (bus-driven via useAppEvents) -->
  <ToastNotification ref="toastRef" />

  <!-- FloatingPoints stays per contract §6 (W1 restyles in Wave B). -->
  <FloatingPoints />

  <!--
    Shell: sidebar + header + <main> with section-aware content.
    AppShell owns the local 'campaign'/'stats' section state and the
    sidebar open/close state; the page content (slot below) reacts to
    the current section via v-model.
  -->
  <AppShell
    v-model:section="section"
    :currentMonth="currentMonth"
    :months="months"
    :currentMonthUuid="currentMonthUuid"
    :lifetimeScore="lifetimeScore"
    :hasMonth="hasMonth"
    :isFinished="isFinished"
    :openSettings="openSettings"
    :newMonth="newMonth"
    :finishMonth="finishMonth"
    :refreshData="refreshDataFromStore"
    :openCreateTask="openCreateTask"
  >
    <!-- Campaign section: EditableMonthView for active months,
         ReadOnlyMonthView for finished months. -->
    <template v-if="section === 'campaign'">
      <EditableMonthView
        v-if="!isFinished && hasMonth"
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
      <ReadOnlyMonthView
        v-else-if="isFinished && hasMonth"
        :month="currentMonth"
      />
    </template>

    <!-- Stats section: full statistics for finished months;
         progress + "unlock on finish" + finished-months list for
         unfinished months. -->
    <template v-else>
      <StatsOrReadonly
        v-if="hasMonth && isFinished"
        :isFinished="isFinished"
        :hasMonth="hasMonth"
        :viewMode="viewMode"
        :currentMonth="currentMonth"
      />
      <StatsUnfinishedPanel
        v-else
        :currentMonth="currentMonth"
        :months="months"
        :currentMonthUuid="currentMonthUuid"
        @selectMonth="onSelectMonthFromPanel"
      />
    </template>
  </AppShell>

  <!-- Modal hosts (create/edit task + settings drawer). -->
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
import {
  providePageState,
  useMonthPageState,
} from "./composables/useMonthPageState";
import { useTaskModal } from "./composables/useTaskModal";
import { useMonthViewMode } from "./composables/useMonthViewMode";
import { provideBreakpoints } from "./composables/useBreakpoint";

import AppShell from "./components/app/AppShell.vue";
import AppBackground from "./components/app/AppBackground.vue";
import AppHeader from "./components/app/AppHeader.vue";
import EditableMonthView from "./components/app/EditableMonthView.vue";
import ReadOnlyMonthView from "./components/ReadOnlyMonthView.vue";
import StatsOrReadonly from "./components/app/StatsOrReadonly.vue";
import StatsUnfinishedPanel from "./components/app/StatsUnfinishedPanel.vue";
import ModalsHost from "./components/app/ModalsHost.vue";

import ToastNotification from "./components/ToastNotification.vue";
import FloatingPoints from "./components/FloatingPoints.vue";

// W4b 404: the app is a single page with no `pages/` router, so Nuxt
// would render this shell for any URL. Anything other than "/" is a
// real 404 and is rendered by `error.vue` (SSR responds with 404).
const requestPath = useRoute().path;
if (requestPath !== "/" && requestPath !== "") {
  throw createError({
    statusCode: 404,
    statusMessage: "Page not found",
    fatal: true,
  });
}

// Stores
const monthStore = useMonthStore();
const settingsStore = useSettingsStore();

// Page state composables
const {
  currentWeek,
  currentDay,
  currentDayUuid,
  weeks,
  currentMonth,
  weekIndex,
  hasPrevWeek,
  hasNextWeek,
  setCurrentWeek,
  setCurrentDay,
  prevWeek,
  nextWeek,
  refreshDataFromStore,
  toggleTask,
  moveTask,
  deleteSingleTask,
} = useMonthPageState();

// W4b additions: provide reactive breakpoint state to deep descendants
// (kept for any Wave-B descendant that still needs it).
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

// W2-integration / page-state-sharing: app.vue is the SINGLE owner of
// the page state. We provide the merged state (page-state refs +
// task-modal openers) so that any descendant — most importantly
// `CampaignView.vue` — calls `injectPageState()` instead of creating
// its own copy via `useMonthPageState()`. Fixes M-1 (TaskModal never
// opens because `openEditTask` was undefined on the duplicate state).
const pageStateBundle = {
  currentWeek,
  currentDay,
  currentDayUuid,
  weeks,
  currentMonth,
  weekIndex,
  hasPrevWeek,
  hasNextWeek,
  setCurrentWeek,
  setCurrentDay,
  nextWeek,
  prevWeek,
  refreshDataFromStore,
  toggleTask,
  moveTask,
  deleteSingleTask,
};
providePageState({
  ...pageStateBundle,
  taskModalOpen,
  selectedDayUuid,
  editingTaskUuid,
  openCreateTask,
  openCreateTaskForDay,
  openEditTask,
  closeTaskModal,
});

// V2 shell: local section state owned here, bound v-model to AppShell.
const section = ref<"campaign" | "stats">("campaign");

// Toast + reactive slices
const toastRef = ref<InstanceType<typeof ToastNotification> | null>(null);
const storeRefs: any = storeToRefs(monthStore as any);
const months = storeRefs.months;
const lifetimeScore = storeRefs.lifetimeScore;
const currentMonthUuid = storeRefs.currentMonthUuid;
const isFinished = computed(() => currentMonth.value?.finished || false);
const hasMonth = computed(() => !!currentMonth.value);

function openSettings() {
  settingsStore.toggleDrawer(true);
}

function newMonth() {
  const defaultName = new Date().toLocaleString("default", {
    month: "long",
    year: "numeric",
  });
  monthStore.createMonth(defaultName);
  section.value = "campaign";
}

function finishMonth() {
  if (isFinished.value) return;
  const score = currentMonth.value?.score || 0;
  if (
    confirm(
      `Finish this month? You achieved ${score} XP.\n\nThis will lock all tasks and calculate statistics.`,
    )
  ) {
    monthStore.finishCurrentMonth().then((result) => {
      if (result?.cycle) {
        toastRef.value?.add({
          title: "MONTH COMPLETED!",
          message: `${score} XP added to your legacy!`,
          type: "success",
        });
        viewMode.value = "stats";
        section.value = "stats";
      }
    });
  }
}

function onSelectMonthFromPanel(uuid: string) {
  if (uuid !== currentMonthUuid.value) {
    monthStore.setCurrentMonth(uuid);
  }
  section.value = "stats";
}

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
/* V2: no page-wide colour drift / filter animation. The Combat Deck
   background is a static `--pp-void` with a tiny CSS dot/scanline
   overlay. The FloatingPoints component (kept per contract §6) is
   the only animated element on the page. */
</style>
