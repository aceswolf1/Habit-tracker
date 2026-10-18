<!--
  CampaignView.vue (W2 contract §4 / §5).

  Top-level V2 combat deck screen. Layout:

    ┌─ ViewBar: ZONE | n/7 CLEARED | Spotlight ⇄ Grid | Holo-Deck On/Off
    ├─ WeekTabs  (01 NEURAL GRID — 04 FINAL PROTOCOL)
    ├─ DayStrip  (7-day buttons with ACTIVE / TODAY / STDBY badges)
    └─ Body:
        - Spotlight  →  DaySpotlight (left 8/12 ≥1280, 2/3 1024-1279)
                       + CampaignCockpit (right 4/12 ≥1280, 1/3 1024-1279)
                       Cockpit UNDER the list below lg.
        - Grid       →  WeekGrid (7 columns ≥ lg, scroll-snap 220px tablet,
                       hidden on phone — Spotlight is forced there).

  Reads the active cycle from `useMonthStore()` directly (no need to
  pass `month` from app.vue). Re-uses the existing `useMonthPageState`
  callbacks for week/day selection + task mutations.
-->
<template>
  <div v-if="month" class="campaign-view flex flex-col gap-3 w-full" data-testid="campaign-view">
    <!-- ViewBar
         Phone (< 640): stack zone title on its own line, stats on the
         next line, Holo-Deck toggle only (Spotlight/Grid toggle hidden
         because Spotlight is forced on phone anyway). No cyan glow.
         ≥ 640: row layout with the Grid toggle and the cyan accent
         dot, as in Wave A. -->
    <div
      class="view-bar flex flex-col gap-2 p-3 bg-pp-card border border-pp-line sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
    >
      <div class="flex flex-col gap-1 min-w-0 sm:flex-row sm:items-center sm:gap-3">
        <div class="flex items-center gap-1.5">
          <span
            class="inline-block w-2.5 h-2.5 bg-pp-cyan"
            :style="phoneZoneDotStyle"
            aria-hidden="true"
          ></span>
          <span class="font-display text-headline-md uppercase text-pp-text tracking-wide truncate">
            ZONE: {{ currentWeek?.name || '—' }}
          </span>
        </div>
        <div class="flex items-center gap-2 font-mono text-label-sm text-pp-muted uppercase">
          <span>Cycle {{ cycleLabel }} // Sprint {{ (weekIndex ?? 0) + 1 }}</span>
          <span aria-hidden="true">/</span>
          <span class="text-pp-amber font-bold">{{ clearedCount }}/7 CLEARED ({{ clearedPct }}%)</span>
        </div>
      </div>

      <div class="flex items-center gap-1 bg-pp-panel p-1 self-start sm:self-auto">
        <button
          v-if="!isPhone"
          type="button"
          :aria-pressed="view === 'spotlight'"
          :class="viewBtnClasses('spotlight')"
          @click="setView('spotlight')"
        >
          <span aria-hidden="true">⊡</span>
          <span>Day Spotlight</span>
        </button>
        <button
          v-if="!isPhone"
          type="button"
          :aria-pressed="view === 'grid'"
          :class="viewBtnClasses('grid')"
          @click="setView('grid')"
        >
          <span aria-hidden="true">▦</span>
          <span>7D Grid</span>
        </button>
        <div v-if="!isPhone" class="w-px h-4 bg-pp-line mx-1" aria-hidden="true"></div>
        <button
          type="button"
          :aria-pressed="settings.animateGifs"
          :class="holoBtnClasses"
          @click="toggleAnimateGifs"
          title="Holo-Deck (animate task GIFs)"
        >
          <PpIcon :name="settings.animateGifs ? 'auto_videocam' : 'videocam_off'" :size="16" />
          <span>
            {{ settings.animateGifs ? 'Holo-Deck: On' : 'Holo-Deck: Off' }}
          </span>
        </button>
      </div>
    </div>

    <!-- Week tabs -->
    <WeekTabs
      v-if="month.weeks?.length > 1"
      :weeks="month.weeks"
      :currentWeekUuid="currentWeek?.uuid || null"
      :setCurrentWeek="setCurrentWeek"
    />

    <!-- Day strip -->
    <DayStrip
      v-if="currentWeek"
      :week="currentWeek"
      :weekIndex="weekIndex"
      :currentDayUuid="currentDayUuid"
      :cycle="month"
      :todayIndex="todayIndex"
      :setCurrentDay="setCurrentDay"
    />

    <!-- Body: Spotlight + Cockpit (or WeekGrid) -->
    <div
      v-if="currentWeek && currentDay"
      :class="bodyClasses"
    >
      <!-- Spotlight (default) -->
      <template v-if="view === 'spotlight'">
        <DaySpotlight
          class="lg:col-span-8 xl:col-span-8 min-w-0"
          :day="currentDay"
          :week="currentWeek"
          :weeks="month.weeks"
          :monthProgress="month.progress"
          :isFinished="isFinished"
          :cycle="month"
          :insightHabits="insights?.habits || null"
          :toggleTask="toggleTask"
          :openEditTask="openEditTask"
          :openCreateTaskForDay="openCreateTaskForDay"
          :moveTask="moveTask"
          :deleteSingleTask="deleteSingleTask"
        />
        <CampaignCockpit
          class="lg:col-span-4 xl:col-span-4 min-w-0"
          :month="month"
          :week="currentWeek"
          :weekIndex="weekIndex"
          :currentDayUuid="currentDayUuid"
          :selectDay="setCurrentDay"
          :isFinished="isFinished"
          :insights="insights"
          :monthProgress="month.progress"
        />
      </template>

      <!-- Grid -->
      <template v-else>
        <WeekGrid
          class="col-span-full min-w-0"
          :week="currentWeek"
          :monthProgress="month.progress"
          :isFinished="isFinished"
          :toggleTask="toggleTask"
          :openEditTask="openEditTask"
          :openCreateTaskForDay="openCreateTaskForDay"
          :moveTask="moveTask"
          :deleteSingleTask="deleteSingleTask"
          :currentDayUuid="currentDayUuid"
          :setCurrentDay="setCurrentDay"
          :insightHabits="insights?.habits || null"
        />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { useMonthStore } from "../../stores/monthStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { injectPageState } from "../../composables/useMonthPageState";
import { injectCampaignBreakpoints } from "../../composables/campaignBreakpoints";
import WeekTabs from "./WeekTabs.vue";
import DayStrip from "./DayStrip.vue";
import DaySpotlight from "./DaySpotlight.vue";
import WeekGrid from "./WeekGrid.vue";
import CampaignCockpit from "./CampaignCockpit.vue";
import PpIcon from "../ui/PpIcon.vue";
import type { Cycle, Insights } from "../../types/index";

const props = defineProps<{
  isFinished: boolean;
  hasMonth: boolean;
}>();

const monthStore = useMonthStore();
const settings = useSettingsStore();
const storeRefs: any = storeToRefs(monthStore as any);
const month = computed<Cycle | null>(() => storeRefs.currentMonth?.value ?? null);
const insights = computed<Insights | null>(() => storeRefs.insights?.value ?? null);

// v2.2: trigger an insights refresh on mount if the store has none yet
// (e.g. user navigated directly to the campaign page). Failures are
// swallowed by `fetchInsights()` so this never throws.
onMounted(() => {
  if (!insights.value) {
    monthStore.fetchInsights();
  }
});

// W2-integration / page-state-sharing: read the SINGLE app.vue-owned
// state via inject (M-1). Calling `useMonthPageState()` here would
// have created a duplicate graph with its own `currentWeek` +
// `currentDayUuid`, and `openCreateTaskForDay` / `openEditTask`
// returned `undefined` from this composable, breaking modal opens.
const {
  currentWeek,
  currentDay,
  currentDayUuid,
  weekIndex,
  setCurrentWeek,
  setCurrentDay,
  toggleTask,
  moveTask,
  deleteSingleTask,
  openCreateTaskForDay,
  openEditTask,
} = injectPageState();

const bp = injectCampaignBreakpoints();
const isPhone = computed(() => !!bp.isPhone?.value);

// View: spotlight (default) | grid. Persisted via settings store.
const view = computed<"spotlight" | "grid">(() => {
  if (isPhone.value) return "spotlight"; // phone always spotlight
  return (settings.campaignView === "grid" ? "grid" : "spotlight") as "spotlight" | "grid";
});
function setView(v: "spotlight" | "grid") {
  if (isPhone.value) return; // can't switch on phone
  settings.setCampaignView(v);
}
function toggleAnimateGifs() {
  settings.setAnimateGifs(!settings.animateGifs);
}

const bodyClasses = computed(() => {
  if (view.value === "grid") {
    return "grid grid-cols-1 gap-3";
  }
  // Spotlight + cockpit: stack on < lg, side-by-side at lg+
  return "grid grid-cols-1 gap-3 lg:grid-cols-12";
});

function viewBtnClasses(name: "spotlight" | "grid"): string {
  const base = "px-3 min-h-[40px] sm:min-h-0 sm:py-1 font-display text-label-md uppercase tracking-wider flex items-center gap-1 transition-colors";
  return view.value === name
    ? `${base} bg-pp-card-active text-pp-cyan shadow-[0_0_8px_rgba(0,240,255,0.3)]`
    : `${base} text-pp-muted hover:text-pp-text hover:bg-pp-card`;
}

/**
 * Cyan zone-accent dot: full neon glow at ≥ sm, flat fill on phone
 * (the lead flagged the Spotlight toggle glow as oversized on phone,
 * so we drop the glow on the ViewBar dot too to match that calmer
 * phone layout). Re-evaluates when `isPhone` flips.
 */
const phoneZoneDotStyle = computed(() =>
  isPhone.value
    ? "background-color: var(--pp-cyan);"
    : "box-shadow: 0 0 8px rgba(0, 240, 255, 0.95);",
);

const holoBtnClasses = computed(() => {
  const base = "px-2 min-h-[40px] sm:min-h-0 sm:py-1 font-mono text-label-md uppercase flex items-center gap-1 transition-colors";
  return settings.animateGifs
    ? `${base} text-pp-cyan hover:text-pp-text`
    : `${base} text-pp-muted hover:text-pp-text`;
});

const cycleLabel = computed(() => {
  if (!month.value) return "—";
  const idx = (monthStore.months || []).findIndex((m) => m.uuid === month.value!.uuid);
  return String(idx >= 0 ? idx + 1 : 1).padStart(2, "0");
});

const clearedCount = computed(() => {
  if (!currentWeek.value) return 0;
  return currentWeek.value.days.filter((d: any) => {
    if (!d.tasks || d.tasks.length === 0) return false;
    const required = d.tasks.filter((t: any) => !t.optional);
    if (required.length === 0) return false;
    return required.every((t: any) => t.completed);
  }).length;
});
const clearedPct = computed(() => Math.round((clearedCount.value / 7) * 100));

/**
 * `todayIndex` rule from contract §4: "the first unfinished week whose
 * progress < 100 that contains the current weekday position". Falls back
 * to null when no week satisfies.
 */
const todayIndex = computed<number | null>(() => {
  if (!month.value) return null;
  const today = new Date();
  // Mon = 0, Sun = 6 (matches Day names array order in the backend).
  const weekday = (today.getDay() + 6) % 7;
  for (const week of month.value.weeks) {
    if (!week) continue;
    if ((week.progress ?? 0) >= 100) continue;
    if (Array.isArray(week.days) && week.days[weekday]) {
      return weekday;
    }
  }
  return null;
});

// Keep `currentWeek` in lockstep with the store. useMonthPageState's own
// watcher covers the initial load; this extra pass guarantees that when
// the user toggles to a different week via WeekTabs, the day strip
// re-renders the new week's days.
watch(
  () => month.value?.uuid,
  () => {
    if (!currentWeek.value && month.value?.weeks?.length) {
      setCurrentWeek(month.value.weeks[0]);
    }
  },
  { immediate: true },
);
</script>
