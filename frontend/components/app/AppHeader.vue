<template>
  <header class="mb-6">
    <!--
      Mobile-first header:
        - phone (<640): three stacked rows — title, then XP totals, then
          settings/gift buttons.
        - tablet/desktop: single row with the same items side-by-side.
      Same inline color/font/shadow as the original markup so desktop
      parity is preserved.
    -->
    <div
      class="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center sm:gap-0"
    >
      <h1
        class="font-press text-pixel-text text-2xl m-1"
        style="text-shadow: 2px 2px 0 var(--pp-black)"
      >
        {{ monthName }}
        <span
          v-if="isFinished"
          class="text-xs sm:ml-4"
          style="color: var(--pp-danger)"
        >🔒 LOCKED</span>
      </h1>
      <!-- XP totals row (own line on phone) -->
      <div
        v-if="hasMonth"
        class="flex flex-row items-center gap-2 sm:flex-col sm:items-end sm:gap-1"
      >
        <div class="flex items-center gap-2">
          <span style="color: var(--pp-gold); font-family: 'Press Start 2P', cursive; font-size: 0.7rem; text-shadow: 2px 2px 0 var(--pp-black)">MONTH</span>
          <span style="color: var(--pp-text); font-family: 'Press Start 2P', cursive; font-size: 0.9rem; text-shadow: 2px 2px 0 var(--pp-black)">{{ currentMonth?.score || 0 }} XP</span>
        </div>
        <div class="flex items-center gap-2">
          <span style="color: var(--pp-danger-lt); font-family: 'Press Start 2P', cursive; font-size: 0.7rem; text-shadow: 2px 2px 0 var(--pp-black)">TOTAL</span>
          <span style="color: var(--pp-text); font-family: 'Press Start 2P', cursive; font-size: 0.9rem; text-shadow: 2px 2px 0 var(--pp-black)">{{ lifetimeScore }} XP</span>
        </div>
      </div>
      <!-- Settings + gift buttons row (own line on phone) -->
      <div class="flex items-center gap-3">
        <span
          class="hidden sm:inline font-press text-pixel-text mr-2"
          style="text-shadow: 2px 2px 0 var(--pp-black)"
        >PixelPaladin</span>
        <button
          @click="onOpenSettings"
          class="pp-tap"
          style="background: transparent; border: 2px solid var(--pp-black); padding: 0.4rem; margin-right: 0.5rem; cursor: pointer; box-shadow: 2px 2px 0 rgba(0,0,0,0.5);"
          aria-label="Open settings"
        >
          ⚙️
        </button>
        <div
          class="pp-tap"
          style="background-color: var(--pp-danger); padding: 0.5rem; border: 2px solid var(--pp-black); box-shadow: 2px 2px 0 rgba(0,0,0,0.5);"
        >
          <span style="font-size: 1.25rem">🎁</span>
        </div>
      </div>
    </div>

    <MonthSelector v-if="months.length" />

    <div v-if="hasMonth" class="mt-2">
      <div
        class="flex justify-between items-center font-press text-white"
        style="font-size: 0.75rem; margin-bottom: 0.25rem"
      >
        <span>OVERALL PROGRESS</span>
        <span>{{ displayMonthProgress }}</span>
      </div>
      <div
        :class="['month-progress-wrapper', { completed: isMonthComplete }]"
      >
        <ProgressParticles :progress="monthProgress" />
        <div
          :style="{
            width: Math.min(monthProgress, 100) + '%',
            height: '100%',
            backgroundColor: monthProgressBarColor,
            position: 'absolute',
            top: 0,
            left: 0,
            transition: 'width 0.4s ease',
          }"
        ></div>
        <div class="month-progress-text">
          {{ tierText }}
        </div>
        <div v-if="isMonthComplete" class="month-shine" />
      </div>
    </div>
    <div
      v-else
      class="flex flex-col items-center gap-2 mt-4 font-mono text-center text-white"
    >
      <div class="text-2xl animate-bounce">👾</div>
      <div class="text-xs font-press animate-pulse">LOADING WORLD...</div>
    </div>
    <!--
      Tier ladder row.
        - phone: icons-only row so labels don't run together at 375 px;
          tier name shows under each icon, line-broken if needed.
        - tablet/desktop: original 5-up row with full labels.
    -->
    <div
      v-if="hasMonth"
      class="mt-4 flex justify-between gap-1 sm:gap-2"
    >
      <TierBadge
        v-for="badge in tierBadges"
        :key="badge.label"
        :threshold="badge.threshold"
        :label="badge.label"
        :icon="badge.icon"
        :monthProgress="monthProgress"
      />
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from "vue";
import MonthSelector from "../MonthSelector.vue";
import ProgressParticles from "../ProgressParticles.vue";
import TierBadge from "./TierBadge.vue";

const props = defineProps<{
  currentMonth: any;
  months: any[];
  lifetimeScore: number;
  hasMonth: boolean;
  isFinished: boolean;
  openSettings: () => void;
}>();

function onOpenSettings() {
  props.openSettings();
}

const monthName = computed(() => props.currentMonth?.name || "");
const monthProgress = computed(() => props.currentMonth?.progress || 0);
const isMonthComplete = computed(() => monthProgress.value >= 100);
const displayMonthProgress = computed(() => {
  if (monthProgress.value <= 100) return monthProgress.value + "%";
  return `100% +${monthProgress.value - 100}%`;
});
const monthProgressBarColor = computed(() => {
  const p = monthProgress.value;
  if (p >= 100) return "var(--pp-gold-dk)"; // gold for completed (even bonus)
  if (p >= 75) return "var(--pp-gold-acc)";
  if (p >= 50) return "var(--pp-gold-acc)";
  if (p >= 25) return "var(--pp-gold-acc)";
  return "var(--pp-danger)";
});
const tierText = computed(() => {
  const progress = monthProgress.value;
  if (progress >= 90) return "CHAMPION TIER!";
  if (progress >= 75) return "GOLD TIER!";
  if (progress >= 50) return "SILVER TIER!";
  if (progress >= 25) return "BRONZE TIER!";
  return "BEGINNER TIER!";
});

// Tier badges row — extracted to keep this template flat.
const tierBadges = [
  { threshold: 25, label: "Bronze", icon: "🏆" },
  { threshold: 50, label: "Silver", icon: "🏆" },
  { threshold: 75, label: "Gold", icon: "⚔️" },
  { threshold: 90, label: "Champion", icon: "👑" },
  { threshold: 100, label: "Final", icon: "✨" },
];
</script>

<style lang="scss">
/* Month progress bar completion effect (mirrors task completion aesthetic) */
.month-progress-wrapper {
  width: 100%;
  height: 1.5rem;
  background-color: var(--pp-gray);
  position: relative;
  border: 2px solid var(--pp-black);
  overflow: hidden;
  box-shadow: 0 0 0 0 var(--pp-black) inset;
  transition: box-shadow 0.4s;
}
.month-progress-wrapper.completed {
  background: linear-gradient(var(--pp-gray), var(--pp-gray)) padding-box,
    linear-gradient(
        130deg,
        var(--pp-gold-dk2),
        var(--pp-gold-bd),
        var(--pp-gold),
        var(--pp-gold-pale),
        var(--pp-gold),
        var(--pp-gold-bd),
        var(--pp-gold-dk2)
      )
      border-box;
  animation: month-border-shine 8s linear infinite,
    month-glow-pulse 2.5s ease-in-out infinite;
  box-shadow: 0 0 6px 2px rgb(var(--pp-gold-rgb) / 0.33),
    0 0 18px 4px rgb(var(--pp-gold-eb-rgb) / 0.27),
    0 0 32px 10px rgb(var(--pp-gold-rgb) / 0.13);
}
.month-progress-wrapper.completed::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(
    115deg,
    transparent 0%,
    rgba(255, 255, 255, 0.15) 45%,
    rgba(255, 255, 255, 0.6) 50%,
    rgba(255, 255, 255, 0.15) 55%,
    transparent 100%
  );
  background-size: 250% 250%;
  mix-blend-mode: screen;
  pointer-events: none;
  animation: month-sweep 4.5s linear infinite;
}
.month-progress-text {
  position: relative;
  text-align: center;
  padding: 0.25rem 0;
  color: var(--pp-text);
  font-family: "Press Start 2P", cursive;
  font-size: 0.75rem;
  z-index: 2;
}
.month-shine {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(
    circle at center,
    rgb(var(--pp-gold-rgb) / 0.2) 0%,
    rgb(var(--pp-gold-rgb) / 0.02) 70%,
    transparent 80%
  );
  animation: month-backdrop-fade 1.6s ease-out infinite;
  mix-blend-mode: screen;
}
@keyframes month-border-shine {
  0% {
    background-position: 0% 0%, 0% 50%;
  }
  50% {
    background-position: 100% 100%, 50% 50%;
  }
  100% {
    background-position: 0% 0%, 100% 50%;
  }
}
@keyframes month-glow-pulse {
  0% {
    box-shadow: 0 0 4px 1px rgb(var(--pp-gold-rgb) / 0.4),
      0 0 14px 3px rgb(var(--pp-gold-mid-rgb) / 0.33),
      0 0 26px 6px rgb(var(--pp-gold-rgb) / 0.13);
  }
  50% {
    box-shadow: 0 0 10px 2px rgb(var(--pp-gold-rgb) / 0.67),
      0 0 26px 8px rgb(var(--pp-gold-mid-rgb) / 0.4),
      0 0 42px 14px rgb(var(--pp-gold-rgb) / 0.2);
  }
  100% {
    box-shadow: 0 0 4px 1px rgb(var(--pp-gold-rgb) / 0.4),
      0 0 14px 3px rgb(var(--pp-gold-mid-rgb) / 0.33),
      0 0 26px 6px rgb(var(--pp-gold-rgb) / 0.13);
  }
}
@keyframes month-sweep {
  0% {
    background-position: 200% 0%;
    opacity: 0;
  }
  8% {
    opacity: 1;
  }
  23% {
    background-position: 0% 100%;
    opacity: 0.9;
  }
  30% {
    opacity: 0;
  }
  100% {
    background-position: 0% 100%;
    opacity: 0;
  }
}
@keyframes month-backdrop-fade {
  0% {
    opacity: 0;
  }
  35% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}
</style>