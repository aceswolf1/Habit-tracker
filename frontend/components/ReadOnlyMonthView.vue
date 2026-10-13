<!--
  ReadOnlyMonthView.vue (W1 restyle, V2 Combat Deck).

  Read-only view of a finished cycle. Renders the locked-banner header,
  the four-week boss strip via `WeeklyBossPortrait`, then the campaign
  components (`WeekTabs` + `DayStrip` + `TaskRow`) in their existing
  read-only modes (no toggle/edit/delete/drag handlers wired). No more
  imports of the legacy `Day.vue` / `Task.vue` / `WeekStrip.vue` —
  everything ships from `components/campaign/*`.

  The boss strip uses the read-only state ("honest because the row is
  archived"); no panel toggles. The day strip is the same V2 component
  used in `CampaignView`, just with all write callbacks no-op'd.
-->
<template>
  <div class="read-only-month-view">
    <!-- Locked Banner -->
    <div class="readonly-banner">
      <span class="readonly-banner__label font-display">THIS MONTH IS LOCKED</span>
      <span class="readonly-banner__hint font-mono">ARCHIVED — STATS UNLOCKED</span>
    </div>

    <!-- Weekly Boss Section (boss portraits still render their full
         header + week label + progress bar; the V2 compact:false prop
         preserves the original treatment). -->
    <div class="readonly-bosses">
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
        :isActive="currentWeekUuid === week.uuid"
        :compact="false"
        @set-current-week="onSetCurrentWeek(week)"
      />
    </div>

    <!-- Campaign week + day + task read-only block. We reuse the V2
         campaign components and just no-op the write callbacks so the
         rows render as archived (no toggle/edit/delete). -->
    <div v-if="currentWeek" class="readonly-campaign">
      <CampaignWeekTabs
        :weeks="month.weeks"
        :currentWeekUuid="currentWeekUuid"
        :setCurrentWeek="onSetCurrentWeek"
      />

      <CampaignDayStrip
        :week="currentWeek"
        :weekIndex="currentWeekIndex"
        :currentDayUuid="currentDayUuid"
        :todayIndex="null"
        :setCurrentDay="onSetCurrentDay"
      />

      <ol
        v-if="currentDay"
        class="readonly-task-list"
        :aria-label="`${currentDay.name} tasks`"
      >
        <li
          v-for="(task, index) in currentDay.tasks"
          :key="task.uuid"
          class="readonly-task-list__item"
        >
          <CampaignTaskRow
            :task="task"
            :day="{ uuid: currentDay.uuid }"
            :week="currentWeek"
            :monthProgress="monthProgress"
            :index="index"
            :isFinished="true"
            :showDragHandle="false"
          />
        </li>
      </ol>

      <div v-if="currentDay && currentDay.tasks.length === 0" class="readonly-task-list__empty font-mono">
        NO TASKS LOGGED FOR THIS DAY
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from "vue";
import WeeklyBossPortrait from "./WeeklyBossPortrait.vue";
import CampaignWeekTabs from "./campaign/WeekTabs.vue";
import CampaignDayStrip from "./campaign/DayStrip.vue";
import CampaignTaskRow from "./campaign/TaskRow.vue";
import type { Week } from "../types/index";

interface Props {
  month: any;
}

const props = defineProps<Props>();

const currentWeek = ref<Week | null>(null);
const currentDayUuid = ref<string | null>(null);

const currentWeekIndex = computed(() => {
  if (!props.month?.weeks || !currentWeek.value) return 0;
  return props.month.weeks.findIndex((w: Week) => w.uuid === currentWeek.value!.uuid);
});

const currentDay = computed(() => {
  if (!currentWeek.value || !currentDayUuid.value) return null;
  return currentWeek.value.days.find((d) => d.uuid === currentDayUuid.value) || null;
});

const currentWeekUuid = computed(() => currentWeek.value?.uuid ?? null);

const monthProgress = computed(() => Math.max(0, Math.min(100, props.month?.progress || 0)));

function getWeekImage(week: any, index: number | string) {
  if (week.backgroundImages && week.backgroundImages[0]) {
    return week.backgroundImages[0];
  }
  const weekNumber = Number(index) + 1;
  return `/images/week-${weekNumber}.webp`;
}

function onSetCurrentWeek(week: Week) {
  currentWeek.value = week;
  // Default to first day of the new week so the strip + list surface
  // immediately on click.
  currentDayUuid.value = week.days?.[0]?.uuid ?? null;
}

function onSetCurrentDay(uuid: string) {
  currentDayUuid.value = uuid;
}

onMounted(() => {
  const first = props.month?.weeks?.[0];
  if (first) {
    currentWeek.value = first;
    currentDayUuid.value = first.days?.[0]?.uuid ?? null;
  }
});
</script>

<style scoped>
.read-only-month-view {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  opacity: 0.95;
  max-width: 1200px;
}

.readonly-banner {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.25rem;
  padding: 0.85rem 1rem;
  background: var(--pp-card);
  border: 1px solid var(--pp-danger);
  color: var(--pp-text);
}

.readonly-banner__label {
  font-family: "Space Grotesk", system-ui, sans-serif;
  font-weight: 700;
  font-size: 0.95rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--pp-danger);
}

.readonly-banner__hint {
  font-size: 0.65rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--pp-muted);
}

.readonly-bosses {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

@media (min-width: 1024px) {
  .readonly-bosses {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

.readonly-campaign {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.readonly-task-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.readonly-task-list__item {
  /* Campaign TaskRow owns its own border / hover treatment; nothing
     to add here. */
}

.readonly-task-list__empty {
  font-size: 0.7rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--pp-muted);
  padding: 1rem;
  text-align: center;
  border: 1px dashed var(--pp-line);
  background: var(--pp-card);
}
</style>