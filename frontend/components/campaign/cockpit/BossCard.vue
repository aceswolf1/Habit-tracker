<!--
  BossCard.vue (v2.2 split from CampaignCockpit).

  Compact boss card: portrait, week name, ACTIVE/CONQUERED badge and the
  "week sync" XP progress. Kept under 200 lines so the cockpit can
  compose it without exceeding the file cap.

  Pure UI: takes the boss descriptor from `bossForWeek()` at the call
  site (kept here as a prop so the parent decides which week to show).
-->
<template>
  <UiPpPanel padded>
    <template #header>
      <div class="flex items-center justify-between w-full">
        <div class="flex items-center gap-space-xs">
          <UiPpIcon name="security" :size="18" />
          <span
            class="text-headline-sm text-pp-magenta uppercase tracking-wider"
            data-pp-boss-title
          >
            {{ weekName }} // {{ boss.name }} // {{ boss.codename }}
          </span>
        </div>
        <UiPpBadge :kind="weekConquered ? 'done' : 'boss'">
          {{ weekConquered ? 'CONQUERED' : 'ACTIVE BOSS' }}
        </UiPpBadge>
      </div>
    </template>

    <div class="flex flex-col gap-space-md">
      <WeeklyBossPortrait
        :weekUuid="week.uuid"
        :weekIndex="weekIndex"
        :imageSrc="bossImageSrc"
        :weekName="week.name"
        :progress="week.progress"
        :conquered="!!week.conquered"
        :isActive="true"
        :compact="true"
      />

      <!-- "<WEEK NAME> SYNC" progress line + XP totals -->
      <div class="flex flex-col gap-space-xs">
        <div class="flex items-center justify-between text-label-md text-pp-text uppercase">
          <span>{{ weekName }} Sync</span>
          <span class="text-pp-cyan">{{ earnedXp }} / {{ potentialXp }} XP</span>
        </div>
        <UiPpSegmentedProgress
          :value="weekProgressPct"
          color="gradient"
          :height="8"
        />
        <div class="flex items-center justify-between text-label-sm text-pp-muted uppercase">
          <span>{{ weekProgressPct }}% CLEARED</span>
          <span>{{ potentialXp - earnedXp }} XP REMAINING</span>
        </div>
      </div>
    </div>
  </UiPpPanel>
</template>

<script setup lang="ts">
import { computed } from "vue";
import WeeklyBossPortrait from "../../WeeklyBossPortrait.vue";
import { getDayStats } from "../../../composables/useCampaignStats";
import { bossForWeek } from "../../../utils/sharedBosses";
import type { Week } from "../../../types/index";

interface BossDescriptor {
  name: string;
  codename: string;
}

const props = defineProps<{
  week: Week;
  weekIndex: number;
  monthProgress: number;
}>();

const weekName = computed(() => (props.week.name || `WEEK ${props.weekIndex + 1}`).toUpperCase());
const weekConquered = computed(() => !!props.week.conquered);

const boss = computed<BossDescriptor>(() => bossForWeek(props.weekIndex));

const weekDayStats = computed(() => props.week.days.map((d) => getDayStats(d, props.monthProgress)));
const earnedXp = computed(() => weekDayStats.value.reduce((sum, s) => sum + s.xpEarned, 0));
const potentialXp = computed(() => weekDayStats.value.reduce((sum, s) => sum + s.xpEarned + s.xpPending, 0));
const weekProgressPct = computed(() => {
  if (potentialXp.value === 0) return 0;
  return Math.round((earnedXp.value / potentialXp.value) * 100);
});

const bossImageSrc = computed(() => `/images/week-${Number(props.weekIndex) + 1}.webp`);
</script>
