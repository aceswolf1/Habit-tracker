<template>
  <div class="app-shell" :class="{ 'app-shell--sidebar-open': sidebarOpen }">
    <AppSidebar
      :section="section"
      :open="sidebarOpen"
      :isDesktop="isDesktop"
      :hasMonth="hasMonth"
      :isFinished="isFinished"
      :hasStartDate="hasStartDate"
      :months="months"
      :currentMonthUuid="currentMonthUuid"
      :openSettings="openSettings"
      :newMonth="newMonth"
      :setDates="setDates"
      :finishMonth="finishMonth"
      :refreshData="refreshData"
      @update:section="(v) => emit('update:section', v)"
      @update:open="(v) => (sidebarOpen = v)"
      @close="() => (sidebarOpen = false)"
      @selectMonth="onSelectMonth"
    />

    <div class="app-shell__main" :class="{ 'app-shell__main--with-sidebar': isDesktop }">
      <AppHeader
        :currentMonth="currentMonth"
        :lifetimeScore="lifetimeScore"
        :profile="profile"
        :hasMonth="hasMonth"
        :isFinished="isFinished"
        :compact="!isDesktop"
        :showHamburger="!isDesktop"
        :openCreateTask="openCreateTask"
        :openSettings="openSettings"
        :openChests="openChests"
        :unclaimedCount="unclaimedCount"
        :credits="credits"
        :nextReward="nextReward"
        @toggleMenu="() => (sidebarOpen = !sidebarOpen)"
        @openSettings="openSettings"
      />

      <main class="app-shell__content" :class="mainPaddingClass">
        <slot />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
/*
 * V2 Combat Deck app shell (contract §3) + v2.1 (W3) plumbing.
 *
 * v2.0: owns `section`, `sidebarOpen`, `isDesktop`. Forwards them to
 *       AppSidebar + AppHeader + the page-state slot.
 * v2.1: forwards the optional `profile` object (lifetime display name)
 *       into the header, and a `setDates` callback that opens the
 *       shared NewMonthDialog in "setDates" mode for an un-dated cycle.
 */

import { computed, onMounted, onBeforeUnmount, ref } from "vue";
import AppSidebar from "./AppSidebar.vue";
import AppHeader from "./AppHeader.vue";

const props = defineProps<{
  section: "campaign" | "stats" | "telemetry" | "vault";
  currentMonth: any;
  months: Array<{ uuid: string; name: string; finished: boolean }>;
  currentMonthUuid: string | null;
  lifetimeScore: number;
  /** v2.1 (W3) profile slice — used by AppHeader for the identity line. */
  profile?: { displayName?: string | null; lifetimeScore?: number } | null;
  hasMonth: boolean;
  isFinished: boolean;
  openSettings: () => void;
  newMonth: () => void;
  /** v2.1 (W3): open the New Month dialog in "Set dates" mode. */
  setDates?: () => void;
  /** v2.1 (W3): whether the active cycle has a startDate. Drives the
   *  SET DATES button visibility in the sidebar. */
  hasStartDate?: boolean;
  finishMonth: () => void;
  refreshData: () => void;
  openCreateTask: () => void;
  /** v2.3 (W2) rewards chrome. */
  openChests?: () => void;
  unclaimedCount?: number;
  credits?: number;
  nextReward?: { level: number | null; xpRemaining: number | null };
}>();

const emit = defineEmits<{
  (e: "update:section", v: "campaign" | "stats" | "telemetry" | "vault"): void;
}>();

const sidebarOpen = ref(false);

// `isDesktop` is the standard Tailwind `lg` breakpoint (≥ 1024 px).
// We track it via a single matchMedia listener so SSR doesn't blow up
// and so the sidebar drawer only activates on real narrow viewports.
const isDesktop = ref(true);
let mq: MediaQueryList | null = null;

function updateIsDesktop(e?: MediaQueryListEvent | MediaQueryList) {
  const list = e ?? mq;
  if (!list) return;
  isDesktop.value = list.matches;
  if (isDesktop.value) sidebarOpen.value = false;
}

onMounted(() => {
  if (typeof window === "undefined") return;
  mq = window.matchMedia("(min-width: 1024px)");
  updateIsDesktop(mq);
  // Older Safari uses addListener; modern uses addEventListener. Both
  // are idempotent in this pattern, so try the modern API first.
  if ("addEventListener" in mq) mq.addEventListener("change", updateIsDesktop);
  else (mq as any).addListener(updateIsDesktop);
});

onBeforeUnmount(() => {
  if (mq && "removeEventListener" in mq) mq.removeEventListener("change", updateIsDesktop);
  else if (mq) (mq as any).removeListener?.(updateIsDesktop);
});

const mainPaddingClass = computed(() =>
  isDesktop.value ? "app-shell__content--lg" : "app-shell__content--sm",
);

function onSelectMonth(uuid: string) {
  props.refreshData();
  if (props.currentMonthUuid !== uuid) {
    // The store's setCurrentMonth is invoked by app.vue; refreshData
    // here is a no-op safeguard so the page always reflects the new
    // selection immediately even if the store didn't fire a watch.
  }
}
</script>

<style scoped>
.app-shell {
  position: relative;
  min-height: 100vh;
  background: var(--pp-void);
  color: var(--pp-text);
  z-index: 1;
}

.app-shell__main {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  min-width: 0;
  margin-left: 0;
  transition: margin-left 0.2s ease;
}

.app-shell__main--with-sidebar {
  margin-left: 256px;
}

.app-shell__content {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.app-shell__content--sm {
  padding: 0.5rem;
}

.app-shell__content--lg {
  padding: 1rem 1.5rem 2rem;
}

@media (min-width: 1024px) {
  .app-shell__content--lg {
    padding: 1rem 2rem 2rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .app-shell__main {
    transition: none;
  }
}
</style>
