<!--
  V2 Combat Deck header (contract §3) + v2.1 (W3) player identity
  + v2.3 (W2) rewards chrome.

  v2.0 chrome: month title, tier label, XP, tier icons, NEW HABIT button.
  v2.1 (W3):
    - Player identity line `DISPLAYNAME · LVL n TITLE` (PALADIN fallback).
    - Level progress bar fed by `lifetimeScore` via the shared curve
      (`frontend/utils/sharedLevels.ts#levelInfo`, which re-exports
      `shared/levels.js#levelInfo`).
    - Two stacked meters on ≥ sm (level + month), one compact bar on phone.
    - Credits `◈ n` pinned next to the identity line.
  v2.3 (W2):
    - Chest icon button with an unclaimed-count badge (`inventory_2` icon).
    - NEXT REWARD inline label on the LVL bar row (`LVL n · x XP`).
    All additions stay inline on the existing two-row layout so the
    desktop header doesn't grow taller (the 7-task-row fit rule).

  Two rows:
    1. Month title + identity (incl. credits) + tier/XP block + compact
       inline tier icon strip + NEW HABIT + settings + chest button.
    2. Stacked LVL + MONTH progress bars (NEXT REWARD label sits to
       the left of the LVL bar).
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

        <!-- v2.1 (W3) player identity + v2.3 (W2) credits -->
        <div
          class="app-header__identity font-mono"
          :title="identityTitle"
          aria-label="Player identity"
        >
          <span class="app-header__identity-name" data-pp-player-name>{{ displayName }}</span>
          <span class="app-header__identity-sep">·</span>
          <span class="app-header__identity-level">LVL {{ levelInfo.level }}</span>
          <span class="app-header__identity-title">{{ levelInfo.title }}</span>
          <span
            class="app-header__credits font-mono"
            title="Credits balance"
            data-pp-credits
          >
            <span class="app-header__credits-glyph" aria-hidden="true">◈</span>
            {{ creditsBalance }}
          </span>
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
        <!-- v2.3 (W2) chest button with unclaimed-count badge -->
        <button
          type="button"
          class="app-header__chest"
          :class="{ 'app-header__chest--has': unclaimedCount > 0 }"
          :title="chestButtonTitle"
          :aria-label="chestButtonTitle"
          data-pp-chest-button
          @click="onOpenChests"
        >
          <UiPpIcon name="inventory_2" :size="18" />
          <span
            v-if="unclaimedCount > 0"
            class="app-header__chest-badge"
            data-pp-chest-badge
          >{{ unclaimedBadgeLabel }}</span>
        </button>

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

    <!-- v2.1 (W3) meter rail + v2.3 (W2) NEXT REWARD label -->
    <div
      v-if="hasMonth || levelInfo.xpForNext !== null"
      class="app-header__bars"
      :class="{ 'app-header__bars--compact': compact }"
    >
      <div class="app-header__bar-row" :title="levelBarTitle">
        <span class="app-header__bar-label" data-pp-next-reward>
          <template v-if="nextRewardCopy">
            {{ nextRewardCopy }}
          </template>
          <template v-else>LVL</template>
        </span>
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
import { nextRewardInfo as computeNextRewardInfo } from "../../utils/sharedRewards";

const props = defineProps<{
  currentMonth: any;
  lifetimeScore: number;
  hasMonth: boolean;
  isFinished: boolean;
  compact: boolean;
  showHamburger: boolean;
  /** v2.1: optional profile object. `displayName` falls back to PALADIN. */
  profile?: { displayName?: string | null; lifetimeScore?: number } | null;
  /** v2.3 (W2): unclaimed chest count from the rewards store. */
  unclaimedCount?: number;
  /** v2.3 (W2): current credit balance from the rewards store. */
  credits?: number;
  /** v2.3 (W2): next reward info `{ level, xpRemaining }`. */
  nextReward?: { level: number | null; xpRemaining: number | null };
  openCreateTask: () => void;
  openSettings: () => void;
  /** v2.3 (W2): open the ChestModal. */
  openChests?: () => void;
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

const progressColor = computed<
  "cyan" | "amber" | "green" | "gradient"
>(() => {
  if (monthProgress.value >= 100) return "green";
  if (monthProgress.value >= 90) return "gradient";
  if (monthProgress.value >= 75) return "amber";
  return "cyan";
});

const tierBadges: { key: string; label: string; threshold: number; icon: IconName; colorVar: string }[] = [
  { key: "bronze", label: "Bronze", threshold: 25, icon: "workspace_premium", colorVar: "var(--pp-bronze)" },
  { key: "silver", label: "Silver", threshold: 50, icon: "workspace_premium", colorVar: "var(--pp-silver)" },
  { key: "gold", label: "Gold", threshold: 75, icon: "workspace_premium", colorVar: "var(--pp-amber)" },
  { key: "champion", label: "Champion", threshold: 90, icon: "military_tech", colorVar: "var(--pp-champion)" },
  { key: "final", label: "Final", threshold: 100, icon: "shield", colorVar: "var(--pp-cyan)" },
];

// --- v2.1 (W3) player identity ---

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

// --- v2.3 (W2) chest / credits / next reward --------------------------

const unclaimedCount = computed<number>(() => props.unclaimedCount || 0);

const creditsBalance = computed<number>(() => {
  const c = Number(props.credits);
  return Number.isFinite(c) && c >= 0 ? c : 0;
});

const chestBadgeLabel = computed<string>(() => {
  const n = unclaimedCount.value;
  return n > 99 ? "99+" : String(n);
});
const unclaimedBadgeLabel = computed<string>(() => chestBadgeLabel.value);

const chestButtonTitle = computed(() =>
  unclaimedCount.value > 0
    ? `${unclaimedCount.value} unclaimed chest${unclaimedCount.value === 1 ? "" : "s"} — open the vault`
    : "Chests — open the vault",
);

/**
 * v2.3: NEXT REWARD label sits on the left of the LVL bar — same row,
 * same height. Falls back to just "LVL" for max-level archons or
 * before the rewards store has hydrated.
 */
const nextRewardCopy = computed<string | null>(() => {
  const info = computeNextRewardInfo(props.lifetimeScore || 0);
  const level = info?.level ?? props.nextReward?.level ?? null;
  const remaining = info?.xpRemaining ?? props.nextReward?.xpRemaining ?? null;
  if (level == null || remaining == null) return null;
  return `NEXT REWARD: LVL ${level} · ${remaining} XP`;
});

function onNewHabit() {
  props.openCreateTask();
}

function onOpenChests() {
  if (typeof props.openChests === "function") {
    props.openChests();
  }
}
</script>

<style scoped src="./AppHeader.styles.scss"></style>
