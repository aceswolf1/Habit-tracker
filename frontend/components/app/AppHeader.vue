<!--
  V2 Combat Deck header (contract §3).

  Two rows:
    1. Month title + tier/XP block + compact inline tier icon strip +
       NEW HABIT button + hamburger (phone) / settings (≥lg).
    2. Tier-ladder progress bar (the segmented track).

  Inline tier icons are next to the tier/XP block — see
  `.claude/v2/screen.png`. On phone the title row stacks tighter and
  the action cluster collapses to a hamburger + primary NEW HABIT.

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

          <!--
            Compact inline tier icon strip. Each icon mirrors the
            TierBadge colourway but stripped to a single glyph so it
            fits next to the tier/XP block instead of sitting on a
            separate row. Order = Bronze → Final.
            The colour is applied via the `--tier-color` custom property
            on the wrapper; unearned = muted slate, earned = tier colour.
          -->
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

    <div v-if="hasMonth" class="app-header__progress">
      <UiPpSegmentedProgress
        :value="monthProgress"
        :color="progressColor"
        :height="6"
      />
    </div>

    <!--
      Hidden marker so headless screenshot tools (and devtools) can confirm
      the cycle data is loaded even when visual chrome hasn't settled yet.
    -->
    <span hidden data-pp-week-name>{{ weekName }}</span>
  </header>
</template>

<script setup lang="ts">
/*
 * V2 Combat Deck header (contract §3).
 *
 * The header is a thin chrome strip. It owns the month title, the
 * current tier label, the month-vs-lifetime XP readout, the XP
 * progress bar, the inline tier icon strip, and the primary NEW HABIT
 * button. The standalone tier-ladder row (Wave A) was removed in Wave
 * B to satisfy the lead review (W4 feedback: tier ladder was a tall
 * separate row; the mockup places the icons next to the tier/XP block).
 */

import { computed } from "vue";
import UiPpIcon from "../ui/PpIcon.vue";
import UiPpBadge from "../ui/PpBadge.vue";
import PpButton from "../ui/PpButton.vue";
import UiPpSegmentedProgress from "../ui/PpSegmentedProgress.vue";
import type { IconName } from "../ui/iconNames";

const props = defineProps<{
  currentMonth: any;
  lifetimeScore: number;
  hasMonth: boolean;
  isFinished: boolean;
  compact: boolean;
  showHamburger: boolean;
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

function onNewHabit() {
  props.openCreateTask();
}
</script>

<style scoped>
.app-header {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.5rem 0.5rem 0.5rem 0.5rem;
  border-bottom: 1px solid var(--pp-line);
  position: relative;
  z-index: 5;
}

@media (min-width: 1024px) {
  /*
    Lead fix: header content had no left padding next to the sidebar
    (title touched x = 256). Match the main content padding (2rem at lg)
    so the header and main align horizontally.
  */
  .app-header {
    padding: 0.5rem 2rem;
  }
}

.app-header__row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.app-header__menu {
  width: 40px;
  height: 40px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.app-header__title {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.app-header__month {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.app-header__month-name {
  font-family: "Space Grotesk", system-ui, sans-serif;
  font-weight: 700;
  font-size: 1.125rem;
  line-height: 1.2;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--pp-cyan);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.app-header__month-protocol {
  font-family: "JetBrains Mono", ui-monospace, monospace;
  font-weight: 700;
  font-size: 0.75rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--pp-muted);
}

.app-header__tier {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.app-header__tier-label {
  font-family: "JetBrains Mono", ui-monospace, monospace;
  font-weight: 700;
  font-size: 0.75rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--pp-gold-acc);
}

.app-header__tier-xp {
  font-family: "JetBrains Mono", ui-monospace, monospace;
  font-weight: 500;
  font-size: 0.625rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--pp-muted);
}

.app-header__tier-xp-sep {
  color: var(--pp-line);
  margin: 0 0.25rem;
}

/*
  Inline tier icon strip — the compact, mockup-aligned replacement for
  the standalone TierBadge row. Each icon's `color` is bound in the
  template (earned = tier colour, unearned = --pp-muted).
*/
.app-header__tier-icons {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
}

.app-header__actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

.app-header__progress {
  margin-top: 0.125rem;
  /* Pinned width to keep the segmented track feeling like a terminal
     level meter; on wide screens it stretches to the column width. */
  max-width: 640px;
}

@media (max-width: 639.98px) {
  .app-header__month-name {
    font-size: 0.95rem;
  }
  .app-header__month-protocol {
    font-size: 0.65rem;
  }
  .app-header__tier-label,
  .app-header__tier-xp {
    font-size: 0.6rem;
  }
  /* Compact tier icon strip on phone — keep visible, tighter gap. */
  .app-header__tier-icons {
    gap: 0.15rem;
  }
}
</style>