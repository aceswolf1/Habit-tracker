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
    :profile="profile"
    :hasMonth="hasMonth"
    :isFinished="isFinished"
    :hasStartDate="hasStartDate"
    :openSettings="openSettings"
    :newMonth="onSidebarNewMonth"
    :setDates="onSidebarSetDates"
    :finishMonth="finishMonth"
    :refreshData="refreshDataFromStore"
    :openCreateTask="openCreateTask"
    :openChests="onOpenChests"
    :unclaimedCount="rewardsStore.unclaimedCount"
    :credits="rewardsStore.credits"
    :nextReward="rewardsStore.nextReward"
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
        :onSetDates="onSidebarSetDates"
      />
      <ReadOnlyMonthView
        v-else-if="isFinished && hasMonth"
        :month="currentMonth"
      />
    </template>

    <!-- Stats section: full statistics for finished months;
         progress + "unlock on finish" + finished-months list for
         unfinished months. -->
    <template v-else-if="section === 'stats'">
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

    <!-- v2.2 (W3): Telemetry page — cross-month insights, weekday rates,
         top habits with strike combos, streak rollups. -->
    <template v-else-if="section === 'telemetry'">
      <TelemetryView />
    </template>
    <!-- v2.3 (W3): Trophy Vault page — achievements, certificate gallery,
         chest history. Reads from rewardsStore + monthStore.months. -->
    <template v-else-if="section === 'vault'">
      <VaultView />
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

  <!-- v2.1 (W3): New month / Set dates / Clear dates dialog. -->
  <NewMonthDialog
    :open="newMonthDialogOpen"
    :cycle="dialogCycle"
    :mode="newMonthDialogMode"
    @close="newMonthDialogOpen = false"
    @created="onMonthCreated"
  />
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { storeToRefs } from "pinia";
import { useMonthStore } from "./stores/monthStore";
import { useSettingsStore, hydrateSettingsFromLocalStorage } from "./stores/settingsStore";
// v2.3 (W2): rewards store — chest badge, credits, achievements.
import { useRewardsStore } from "./stores/rewardsStore";
import { useAppToasts } from "./composables/useAppToasts";
import { emitAppEvent } from "./composables/useAppEvents";
import {
  providePageState,
  useMonthPageState,
} from "./composables/useMonthPageState";
import { useTaskModal } from "./composables/useTaskModal";
import { useMonthViewMode } from "./composables/useMonthViewMode";
import { provideBreakpoints } from "./composables/useBreakpoint";
// v2.1 (W3): synth-sound module. Mounted once here.
import { useSoundFx } from "./composables/useSoundFx";

import AppShell from "./components/app/AppShell.vue";
import AppBackground from "./components/app/AppBackground.vue";
import AppHeader from "./components/app/AppHeader.vue";
import EditableMonthView from "./components/app/EditableMonthView.vue";
import ReadOnlyMonthView from "./components/ReadOnlyMonthView.vue";
import StatsOrReadonly from "./components/app/StatsOrReadonly.vue";
import StatsUnfinishedPanel from "./components/app/StatsUnfinishedPanel.vue";
import ModalsHost from "./components/app/ModalsHost.vue";
import NewMonthDialog from "./components/app/NewMonthDialog.vue";
// v2.2 (W3): Telemetry page — read-only insights panels.
import TelemetryView from "./components/telemetry/TelemetryView.vue";
// v2.3 (W3): Trophy Vault page — achievements, certificate gallery,
// chest history. Reads from rewardsStore + monthStore.months.
import VaultView from "./components/vault/VaultView.vue";

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
// v2.3 (W2): rewards store — drives the AppHeader chest badge, the
// credits balance readout, and the chest/achievement toasts.
const rewardsStore = useRewardsStore();

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
// v2.2 (W3): adds `'telemetry'` (cross-month insights page).
// v2.3 (W3): adds `'vault'` (Trophy Vault: achievements + certs + chests).
const section = ref<"campaign" | "stats" | "telemetry" | "vault">("campaign");

// Toast + reactive slices
const toastRef = ref<InstanceType<typeof ToastNotification> | null>(null);
const storeRefs: any = storeToRefs(monthStore as any);
const months = storeRefs.months;
const lifetimeScore = storeRefs.lifetimeScore;
const currentMonthUuid = storeRefs.currentMonthUuid;
const profile = storeRefs.profile;
const isFinished = computed(() => currentMonth.value?.finished || false);
const hasMonth = computed(() => !!currentMonth.value);
const hasStartDate = computed(() => {
  const m: any = currentMonth.value;
  return !!(m && (m.startDate || m.cycleStartDate));
});

function openSettings() {
  settingsStore.toggleDrawer(true);
}

// --- v2.3 (W2) rewards wiring ----------------------------------------

/**
 * Open the chest modal in `ModalsHost` by dispatching the `openChests`
 * app event. Going through the bus keeps the header agnostic of where
 * the modal is mounted; the W3 Trophy Vault uses the same path.
 */
function onOpenChests() {
  emitAppEvent("openChests", {});
}

// --- v2.1 (W3) NewMonthDialog wiring ------------------------------------

const newMonthDialogOpen = ref(false);
const newMonthDialogMode = ref<"newMonth" | "setDates" | "clearDatesOnly">(
  "newMonth",
);

/**
 * Snapshot of the active cycle for the dialog (the dialog expects a
 * plain `{ uuid, name, startDate, finished }`; the store's currentMonth
 * has a lot more fields that we'd otherwise drag into the prop type).
 */
const dialogCycle = computed(() => {
  const m = currentMonth.value;
  if (!m) return null;
  return {
    uuid: m.uuid,
    name: m.name,
    startDate: (m as any).startDate ?? null,
    finished: !!m.finished,
  };
});

function openNewMonthDialog(
  mode: "newMonth" | "setDates" | "clearDatesOnly",
) {
  newMonthDialogMode.value = mode;
  newMonthDialogOpen.value = true;
}

function onSidebarNewMonth() {
  // No active cycle → fresh new month; with an active cycle the same
  // handler rolls forward (the dialog handles "set dates" if there's
  // no startDate, otherwise the user can clear dates from inside).
  openNewMonthDialog(hasMonth.value ? "newMonth" : "newMonth");
}

function onSidebarSetDates() {
  if (!hasMonth.value) {
    openNewMonthDialog("newMonth");
  } else {
    openNewMonthDialog("setDates");
  }
}

function onMonthCreated() {
  // Ensure the page reflects whatever just happened; the dialog itself
  // dispatches the toast.
  refreshDataFromStore();
  section.value = "campaign";
}

useSoundFx();

// -----------------------------------------------------------------------

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

// Toasts: ModalsHost notify adapter + app-event toasts (toast, chestEarned,
// achievementUnlocked). Subscriptions are released on unmount inside.
const { notify } = useAppToasts(toastRef);

onMounted(async () => {
  // Pinia SSR-deserialised state ignores `typeof window` branches, so
  // the settings persisted in `localStorage` need a client-side refresh
  // before the UI reflects them on reload.
  hydrateSettingsFromLocalStorage();
  await monthStore.fetchMonthData();
  if (!currentWeek.value && weeks.value.length) {
    setCurrentWeek(weeks.value[0]);
  }
  // v2.3 (W2): kick off an initial rewards fetch so the header badge /
  // credits readout aren't blank on first paint.
  rewardsStore.fetchRewards().catch(() => undefined);
});

</script>

<style lang="scss">
/* V2: no page-wide colour drift / filter animation. The Combat Deck
   background is a static `--pp-void` with a tiny CSS dot/scanline
   overlay. The FloatingPoints component (kept per contract §6) is
   the only animated element on the page. */
</style>
