<!--
  SprintQueue.vue (v2.2 split from CampaignCockpit).

  Upcoming days list (days AFTER the currently selected one). Click
  → calls `selectDay(uuid)`. Hidden when no days remain.

  Each row: day label, task count, action label ("LOAD" / "RAID" on
  the heuristic FRI boss day). Pure UI, no store reads.
-->
<template>
  <UiPpPanel v-if="upcomingDays.length > 0" padded>
    <template #header>
      <div class="flex items-center justify-between w-full">
        <div class="flex items-center gap-space-xs">
          <UiPpIcon name="event_repeat" :size="18" />
          <span class="text-headline-sm text-pp-cyan uppercase tracking-wider">Sprint Queue</span>
        </div>
        <span class="text-label-sm text-pp-muted">{{ upcomingDays.length }} DAYS LEFT</span>
      </div>
    </template>
    <div class="flex flex-col gap-space-xs">
      <button
        v-for="day in upcomingDays"
        :key="day.uuid"
        type="button"
        class="flex items-center justify-between px-space-xs py-space-xs text-label-md uppercase border border-pp-line bg-pp-card hover:bg-pp-card-active focus:outline-none"
        :class="day.boss ? 'text-pp-magenta' : 'text-pp-text'"
        @click="onSelectDay(day.uuid)"
      >
        <span class="uppercase">{{ day.label }}</span>
        <span
          class="font-bold"
          :class="day.boss ? 'text-pp-magenta' : 'text-pp-cyan'"
        >{{ day.actionLabel }} &gt;</span>
      </button>
    </div>
  </UiPpPanel>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { getDayStats } from "../../../composables/useCampaignStats";
import type { Week } from "../../../types/index";

const props = defineProps<{
  week: Week;
  monthProgress: number;
  currentDayUuid: string | null;
  selectDay: (uuid: string) => void;
}>();

interface UpcomingDay {
  uuid: string;
  label: string;
  actionLabel: string;
  boss: boolean;
}

const upcomingDays = computed<UpcomingDay[]>(() => {
  const idx = props.week.days.findIndex((d) => d.uuid === props.currentDayUuid);
  if (idx === -1) return [];
  const after = props.week.days.slice(idx + 1);
  return after.map((day) => {
    const stats = getDayStats(day, props.monthProgress);
    const boss = day.uuid === props.week.days[4]?.uuid; // heuristic: FRI = boss
    return {
      uuid: day.uuid,
      label: `${day.name.toUpperCase()}: ${stats.total} ${stats.total === 1 ? "TASK" : "TASKS"}`,
      actionLabel: boss ? "RAID" : "LOAD",
      boss,
    };
  });
});

function onSelectDay(uuid: string) {
  props.selectDay(uuid);
}
</script>
