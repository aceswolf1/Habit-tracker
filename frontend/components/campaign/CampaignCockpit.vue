<!--
  CampaignCockpit.vue (V2 Combat Deck — v2.2 split).

  Right-column tactical cockpit in the V2 combat deck. Composed of
  small sub-components in ./cockpit/* so this file stays ≤ 400 lines:
    1. BossCard        — boss portrait + week sync (XP bar).
    2. XpChart         — daily XP trajectory (SVG polyline).
    3. SprintQueue     — upcoming days list (selectDay triggers).
    4. CombatLog       — today's completions, expandable to 7 days (v2.2).
    5. PerfectStreak   — "PERFECT STREAK n · BEST m" line (v2.2).

  W2 contract §5 keeps the cockpit as a single visual block; the
  dividers between panels are absent (each panel already has its own
  1px `--pp-line` border).
-->
<template>
  <aside class="flex flex-col gap-space-md w-full" aria-label="Campaign cockpit">
    <BossCard
      :week="week"
      :weekIndex="weekIndex"
      :monthProgress="monthProgress"
    />

    <PerfectStreak :insights="insights" />

    <XpChart
      :week="week"
      :monthProgress="monthProgress"
      :currentDayUuid="currentDayUuid"
    />

    <CombatLog :insights="insights" />

    <SprintQueue
      :week="week"
      :monthProgress="monthProgress"
      :currentDayUuid="currentDayUuid"
      :selectDay="selectDay"
    />
  </aside>
</template>

<script setup lang="ts">
/*
 * V2 Combat Deck app shell. The cockpit is now a thin composer that
 * delegates each panel to its own component. The store-flavoured glue
 * (e.g. ensuring `insights` is fetched on first mount) lives in
 * CampaignView so the cockpit itself stays a pure renderer of props.
 */
import BossCard from "./cockpit/BossCard.vue";
import XpChart from "./cockpit/XpChart.vue";
import SprintQueue from "./cockpit/SprintQueue.vue";
import CombatLog from "./cockpit/CombatLog.vue";
import PerfectStreak from "./cockpit/PerfectStreak.vue";
import type { Insights, Week } from "../../types/index";

interface Props {
  week: Week;
  weekIndex: number;
  currentDayUuid: string | null;
  selectDay: (uuid: string) => void;
  isFinished: boolean;
  month: any;
  /** v2.2: insights read by CombatLog + PerfectStreak. May be null
   * during the first fetch; both child components render an explicit
   * empty state when this happens. */
  insights: Insights | null;
  monthProgress: number;
}

const props = defineProps<Props>();
// `isFinished` + `month` are kept on the Props surface so existing call
// sites don't need to change; the cockpit delegates boss / sprint / xp
// rendering to sub-components that don't need them today.
void props.isFinished;
void props.month;
</script>
