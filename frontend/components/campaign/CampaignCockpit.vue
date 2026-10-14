<!--
  CampaignCockpit.vue (V2 A10 — owner W3).

  Right-column tactical cockpit in the V2 combat deck. Three panels
  built with W1's <UiPpPanel> / <UiPpBadge> / <UiPpIcon> /
  <UiPpSegmentedProgress> primitives:
    1. Boss card (compact WeeklyBossPortrait, ACTIVE/CONQUERED badge,
       <UiPpSegmentedProgress color="gradient" /> for the sync bar).
    2. Daily XP trajectory (inline SVG polyline + dots, 7 points from
       getWeekDayXp; hidden when every value is 0).
    3. Upcoming days list (days after the selected one; click → selectDay).
-->
<template>
  <aside class="flex flex-col gap-space-md w-full" aria-label="Campaign cockpit">
    <!-- Boss card -->
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

    <!-- Daily XP trajectory chart -->
    <UiPpPanel v-if="hasAnyXp" padded>
      <template #header>
        <div class="flex items-center justify-between w-full">
          <span class="text-headline-sm text-pp-cyan uppercase tracking-wider">
            Daily XP Trajectory
          </span>
          <span class="text-label-sm text-pp-muted">AVG {{ avgXp }} XP/DAY</span>
        </div>
      </template>
      <svg
        class="w-full"
        :viewBox="`0 0 ${chartWidth} ${chartHeight}`"
        preserveAspectRatio="none"
        role="img"
        aria-label="Daily XP chart"
      >
        <path
          v-if="chartPath"
          :d="chartPath"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          class="text-pp-cyan"
          style="filter: drop-shadow(0 0 4px rgba(0,240,255,0.6))"
        />
        <g>
          <circle
            v-for="(point, i) in chartPoints"
            :key="i"
            :cx="point.x"
            :cy="point.y"
            :r="point.isHighlight ? 4 : 3"
            :fill="point.isHighlight ? 'var(--pp-magenta)' : 'var(--pp-cyan)'"
          />
        </g>
        <text
          v-for="(label, i) in xAxisLabels"
          :key="`x-${i}`"
          :x="label.x"
          :y="chartHeight - 2"
          text-anchor="middle"
          class="text-label-sm"
          fill="currentColor"
          style="font-size: 9px; color: var(--pp-muted)"
        >{{ label.text }}</text>
      </svg>
    </UiPpPanel>

    <!-- Upcoming days list -->
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
  </aside>
</template>

<script setup lang="ts">
import { computed } from "vue";
import WeeklyBossPortrait from "../WeeklyBossPortrait.vue";
import { getDayStats, getWeekDayXp } from "../../composables/useCampaignStats";
// v2.1 (W3): boss roster / week picker. W1 ships `sharedBosses.ts`
// alongside the cockpit's TODO; we import the canonical helper now so
// the title stays in sync with WeekTabs's pick when W2 wires that.
import { bossForWeek } from "../../utils/sharedBosses";
import type { Week } from "../../types/index";

interface Props {
  week: Week;
  weekIndex: number;
  currentDayUuid: string | null;
  selectDay: (uuid: string) => void;
  isFinished: boolean;
}

const props = defineProps<Props>();
void props.isFinished; // kept for parity with contract; week.conquered is the visual signal

const weekName = computed(() => (props.week.name || `WEEK ${props.weekIndex + 1}`).toUpperCase());
const weekConquered = computed(() => !!props.week.conquered);

const boss = computed(() => bossForWeek(props.weekIndex));

// Weekly XP totals (earned vs potential) — sums of `getDayStats` over the
// 7 days. Approximate (uses current month tier per the contract).
const weekDayStats = computed(() =>
  props.week.days.map((d) => getDayStats(d, 0))
);
const earnedXp = computed(() =>
  weekDayStats.value.reduce((sum, s) => sum + s.xpEarned, 0)
);
const potentialXp = computed(() =>
  weekDayStats.value.reduce((sum, s) => sum + s.xpEarned + s.xpPending, 0)
);
const weekProgressPct = computed(() => {
  if (potentialXp.value === 0) return 0;
  return Math.round((earnedXp.value / potentialXp.value) * 100);
});
const avgXp = computed(() => {
  if (weekDayStats.value.length === 0) return 0;
  return Math.round(earnedXp.value / weekDayStats.value.length);
});

const bossImageSrc = computed(
  () => `/images/week-${Number(props.weekIndex) + 1}.webp`
);

// Chart geometry — fixed viewBox so the SVG scales with its container
// without re-flowing dots/paths. Horizontal padding is generous enough that
// the first ("MON") and last ("SUN") text labels — rendered with
// text-anchor="middle" — sit fully inside the viewBox at every responsive
// width; the previous 6-unit inset clipped the leading "M" of MON and made
// the trailing "SUN" overlap with SAT at narrow panel widths.
const chartWidth = 280;
const chartHeight = 56;
const chartPaddingX = 18; // horizontal inset for first/last labels
const chartPaddingY = 6;  // vertical inset for the top of the polyline
const chartLabelBand = 14; // bottom band reserved for the day labels

const weekXpValues = computed(() => getWeekDayXp(props.week, 0));
const hasAnyXp = computed(() => weekXpValues.value.some((v) => v > 0));

const chartPoints = computed(() => {
  const values = weekXpValues.value;
  const max = Math.max(1, ...values);
  const step = (chartWidth - chartPaddingX * 2) / 6;
  return values.map((xp, i) => {
    const x = chartPaddingX + step * i;
    // Plot above a reserved label band so a zero-XP day never sits on its label.
    const plotBottom = chartHeight - chartLabelBand;
    const y = plotBottom - (xp / max) * (plotBottom - chartPaddingY);
    const day = props.week.days[i];
    const isHighlight = !!day && day.uuid === props.currentDayUuid;
    return { x, y, isHighlight };
  });
});

const chartPath = computed(() => {
  if (chartPoints.value.length < 2) return "";
  return chartPoints.value
    .map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`))
    .join(" ");
});

const xAxisLabels = computed(() => {
  return chartPoints.value.map((p, i) => {
    const day = props.week.days[i];
    const text = day ? day.name.slice(0, 3).toUpperCase() : "";
    return { x: p.x, text };
  });
});

interface UpcomingDay {
  uuid: string;
  label: string;
  actionLabel: string;
  boss: boolean;
}

const upcomingDays = computed<UpcomingDay[]>(() => {
  const idx = props.week.days.findIndex((d) => d.uuid === props.currentDayUuid);
  if (idx === -1) return [];
  // Days AFTER the selected one (not before).
  const after = props.week.days.slice(idx + 1);
  return after.map((day) => {
    const stats = getDayStats(day, 0);
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
