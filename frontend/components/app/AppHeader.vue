<!--
  V2 Combat Deck header (contract §3) + v2.1 (W3) player identity.

  v2.0 chrome: month title, tier label, XP, tier icons, NEW HABIT button.
  v2.1 (W3):
    - Player identity line `DISPLAYNAME · LVL n TITLE` (PALADIN fallback).
    - Level progress bar fed by `lifetimeScore` via the shared curve
      (`frontend/utils/sharedLevels.ts#levelInfo`, which re-exports
      `shared/levels.js#levelInfo`).
    - Two stacked meters on ≥ sm (level + month), one compact bar on phone.

  Two rows:
    1. Month title + identity + tier/XP block + compact inline tier
       icon strip + NEW HABIT button + hamburger (phone) / settings (≥lg).
    2. Stacked LVL + MONTH progress bars.

  Below lg the header lives at the top edge of `<main>`'s column (no
  sidebar), so its horizontal padding matches the main content.
  ≥ lg the sidebar takes 256px; we add horizontal padding so the title
  no longer touches x = 256.
-->
<template>
  <header
    class="app-header"
    :data-pp-cycle-uuid="hasMonth ? currentMonth?.uuid : ''"
    :data-pp-ready="hasMonth ? 'true' : 'false'"
  >
    <div class="app-header__row">
      <button
        v-if="showHamburger"
        class="app-header__menu pp-btn pp-btn--ghost pp-btn--micro"
        type="button"
        title="Open menu"
        aria-label="Open menu"
        @click="emit('toggleMenu')"
      >
        <UiPpIcon name="menu" :size="20" />
      </button>

      <div class="app-header__title">
        <div class="app-header__month">
          <span class="app-header__month-name">
            {{ monthTitle }}
          </span>
          <span class="app-header__month-protocol">
            <template v-if="hasMonth">// PROTOCOL CYCLE</template>
            <template v-else>// NO CYCLE</template>
          </span>
          <UiPpBadge v-if="isFinished" kind="boss">LOCKED</UiPpBadge>
        </div>

        <!-- v2.1 (W3): player identity. -->
        <div
          class="app-header__identity font-mono"
          :title="identityTitle"
          aria-label="Player identity"
        >
          <span class="app-header__identity-name" data-pp-player-name>{{ displayName }}</span>
          <span class="app-header__identity-sep">·</span>
          <span class="app-header__identity-level">LVL {{ levelInfo.level }}</span>
          <span class="app-header__identity-title">{{ levelInfo.title }}</span>
        </div>

        <div
          v-if="hasMonth && !compact"
          class="app-header__tier font-mono"
          :title="`Bronze 25 · Silver 50 · Gold 75 · Champion 90 · Final 100`"
        >
          <span class="app-header__tier-label">
            {{ tierText }}
          </span>
          <span class="app-header__tier-xp">
            MONTH: {{ currentMonth?.score || 0 }} XP
            <span class="app-header__tier-xp-sep">|</span>
            TOTAL: {{ lifetimeScore }} XP
          </span>

          <span class="app-header__tier-icons" aria-hidden="true">
            <UiPpIcon
              v-for="badge in tierBadges"
              :key="badge.label"
              :name="badge.icon"
              :size="14"
              :filled="monthProgress >= badge.threshold"
              :style="{
                color: monthProgress >= badge.threshold ? badge.colorVar : 'var(--pp-muted)'
              }"
            />
          </span>
        </div>
      </div>

      <div class="app-header__actions">
        <PpButton
          variant="primary"
          icon="add_box"
          :title="'NEW HABIT'"
          @click="onNewHabit"
        >
          NEW HABIT
        </PpButton>
        <PpButton
          v-if="!compact"
          variant="ghost"
          icon="settings"
          :title="'Settings'"
          aria-label="Open settings"
          @click="emit('openSettings')"
        />
      </div>
    </div>

    <!-- v2.1 (W3): LVL + MONTH meter rail. -->
    <div
      v-if="hasMonth || levelInfo.xpForNext !== null"
      class="app-header__bars"
      :class="{ 'app-header__bars--compact': compact }"
    >
      <div class="app-header__bar-row" :title="levelBarTitle">
        <span class="app-header__bar-label">LVL</span>
        <UiPpSegmentedProgress
          :value="levelInfo.progress"
          color="amber"
          :height="compact ? 4 : 5"
        />
      </div>
      <div v-if="hasMonth" class="app-header__bar-row">
        <span class="app-header__bar-label">MONTH</span>
        <UiPpSegmentedProgress
          :value="monthProgress"
          :color="progressColor"
          :height="compact ? 4 : 5"
        />
      </div>
    </div>

    <!-- Hidden marker so headless screenshot tools (and devtools) can
         confirm the cycle data is loaded even when visual chrome
         hasn't settled yet. -->
    <span hidden data-pp-week-name>{{ weekName }}</span>
  </header>
</template>

<script setup lang="ts">
import { computed } from "vue";
import UiPpIcon from "../ui/PpIcon.vue";
import UiPpBadge from "../ui/PpBadge.vue";
import PpButton from "../ui/PpButton.vue";
import UiPpSegmentedProgress from "../ui/PpSegmentedProgress.vue";
import type { IconName } from "../ui/iconNames";
import { levelInfo as computeLevelInfo } from "../../utils/sharedLevels";

const props = defineProps<{
  currentMonth: any;
  lifetimeScore: number;
  hasMonth: boolean;
  isFinished: boolean;
  compact: boolean;
  showHamburger: boolean;
  /** v2.1: optional profile object. `displayName` falls back to PALADIN. */
  profile?: { displayName?: string | null; lifetimeScore?: number } | null;
  openCreateTask: () => void;
  openSettings: () => void;
}>();

const emit = defineEmits<{
  (e: "toggleMenu"): void;
  (e: "openSettings"): void;
}>();

const monthTitle = computed(() => {
  const name = props.currentMonth?.name;
  return (name || "READY").toUpperCase();
});

const weekName = computed(() => {
  const weeks = props.currentMonth?.weeks;
  return weeks?.[0]?.name || "";
});

const monthProgress = computed(() => props.currentMonth?.progress || 0);

const tierText = computed(() => {
  const p = monthProgress.value;
  if (p >= 100) return "CHAMPION TIER";
  if (p >= 90) return "CHAMPION TIER";
  if (p >= 75) return "GOLD TIER";
  if (p >= 50) return "SILVER TIER";
  if (p >= 25) return "BRONZE TIER";
  return "BEGINNER TIER";
});

// Progress bar colour follows the active tier. Below 25 % uses cyan as
// a neutral base. ≥ 75 % turns amber (rewards), ≥ 90 % turns magenta
// (champion) — keeps the header visually tied to the tier ladder.
const progressColor = computed<
  "cyan" | "amber" | "green" | "gradient"
>(() => {
  if (monthProgress.value >= 100) return "green";
  if (monthProgress.value >= 90) return "gradient";
  if (monthProgress.value >= 75) return "amber";
  return "cyan";
});

// Tier icon strip — Bronze / Silver / Gold / Champion / Final.
// Order matches the screen.png mockup.
const tierBadges: { key: string; label: string; threshold: number; icon: IconName; colorVar: string }[] = [
  { key: "bronze", label: "Bronze", threshold: 25, icon: "workspace_premium", colorVar: "var(--pp-bronze)" },
  { key: "silver", label: "Silver", threshold: 50, icon: "workspace_premium", colorVar: "var(--pp-silver)" },
  { key: "gold", label: "Gold", threshold: 75, icon: "workspace_premium", colorVar: "var(--pp-amber)" },
  { key: "champion", label: "Champion", threshold: 90, icon: "military_tech", colorVar: "var(--pp-champion)" },
  { key: "final", label: "Final", threshold: 100, icon: "shield", colorVar: "var(--pp-cyan)" },
];

// --- v2.1 (W3) player identity -----------------------------------------

const displayName = computed(() => {
  const dn = props.profile?.displayName;
  if (dn && typeof dn === "string" && dn.trim()) return dn.trim().toUpperCase();
  return "PALADIN";
});

const levelInfo = computed(() => computeLevelInfo(props.lifetimeScore || 0));

const identityTitle = computed(
  () =>
    `${levelInfo.value.xpIntoLevel} XP into this level · ${levelInfo.value.level} ${levelInfo.value.title}`,
);

const levelBarTitle = computed(() =>
  levelInfo.value.xpForNext
    ? `${levelInfo.value.xpIntoLevel} / ${levelInfo.value.xpForNext} XP to next level`
    : "MAX LEVEL — ARCHON",
);

function onNewHabit() {
  props.openCreateTask();
}
</script>

<style scoped src="./AppHeader.styles.scss"></style>
