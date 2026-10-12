<!--
  WeeklyBossPortrait.vue (W4 split, UB-55).

  Thin orchestrator. Three heavy subtrees are extracted:
  - `components/boss/BossHolographicOverlay.vue` (active-week HUD)
  - `components/boss/BossRankBadge.vue`          (rank-tier overlay)
  - `components/boss/BossProgressBar.vue`       (RPG-style progress bar)
  Same DOM hierarchy for everything else: header + boss image shell + week
  label. SCSS for the shell + active-glow stays here.
-->
<template>
  <div
    class="weekly-boss-container"
    :class="{ active: isActive }"
    :data-progress="Math.round(progress / 10) * 10"
    @click="emit('set-current-week', weekUuid)"
  >
    <div class="boss-header" :class="{ 'has-rank': hasRank }">
      <div v-if="hasRank" class="rank-banner" :data-rank="rankInfo.rank">
        RANK {{ rankInfo.rank }}
      </div>
    </div>
    <div class="weekly-boss-image">
      <img v-if="renderMode === 'image'" :src="imageSrc" :alt="weekName" decoding="async" />
      <!-- W5 perf: optional boss videos (~8 MB each) play only while visible. -->
      <video
        v-if="renderMode === 'video'"
        ref="bossVideoEl"
        class="boss-subtitle-video"
        loop
        muted
        playsinline
        disablepictureinpicture
        preload="none"
        :poster="imageSrc"
      >
        <source :src="computedVideoSrc" type="video/mp4" />
      </video>

      <BossHolographicOverlay v-if="isActive" />
      <BossRankBadge v-if="hasRank" :rank="rankInfo" :progress="progress" />
    </div>
    <div class="week-label">{{ weekName }}</div>

    <BossProgressBar
      :progress="progress"
      :conquered="conquered"
      :hasRank="hasRank"
      :rankInfo="rankInfo"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useInViewPlayback } from "../composables/useInViewPlayback";
import { useSettingsStore } from "../stores/settingsStore";
import BossHolographicOverlay from "./boss/BossHolographicOverlay.vue";
import BossRankBadge, { type RankInfo } from "./boss/BossRankBadge.vue";
import BossProgressBar from "./boss/BossProgressBar.vue";

const bossVideoEl = ref<HTMLVideoElement | null>(null);
useInViewPlayback(bossVideoEl);

const props = defineProps({
  weekUuid: {
    type: String,
    required: true,
  },
  mode: {
    type: String,
    default: "image",
  },
  imageSrc: {
    type: String,
    required: true,
  },
  videoSrc: {
    type: String,
    default: "",
  },
  weekName: {
    type: String,
    required: true,
  },
  weekIndex: {
    type: [Number, String],
    required: false,
  },
  isActive: {
    type: Boolean,
    default: false,
  },
  progress: {
    type: Number,
    default: 0,
    validator: (value) => value >= 0 && value <= 100,
  },
  conquered: {
    type: Boolean,
    default: false,
  },
  subtitle: {
    type: String,
    default: "",
  },
});

const emit = defineEmits(["set-current-week"]);

// Rank thresholds — table preserved verbatim from the original computed,
// but gold/blue/orange endpoints and endpoints now resolve via the
// `pp-*` design tokens (B-T6). Custom purple/pink tokens for the S-rank
// gradient and the D-rank gray aren't covered by tokens.css and stay
// literal there.
const RANK_LEGENDS: ReadonlyArray<RankInfo> = [
  // S — purple → pink → gold; the purple+pink stops are not in tokens.css.
  { rank: 'S', threshold: 100,
    color: '#a855f7',
    gradient: 'linear-gradient(135deg, #a855f7, #ec4899, var(--pp-gold-dk))',
    glow: 'rgba(168, 85, 247, 0.6)' },
  { rank: 'A', threshold: 95,
    color: 'var(--pp-gold-acc)',
    gradient: 'linear-gradient(135deg, var(--pp-gold-acc), var(--pp-gold-dk))',
    glow: 'rgb(var(--pp-gold-acc-rgb, 251 191 36) / 0.6)' },
  { rank: 'B', threshold: 90,
    color: 'var(--pp-blue-light)',
    gradient: 'linear-gradient(135deg, var(--pp-blue-light), var(--pp-blue-mid))',
    glow: 'rgb(var(--pp-blue-rgb, 29 78 216) / 0.6)' },
  { rank: 'C', threshold: 85,
    color: 'var(--pp-orange)',
    gradient: 'linear-gradient(135deg, var(--pp-orange), #ea580c)',
    glow: 'rgb(var(--pp-orange-rgb, 249 115 22) / 0.6)' },
  // D — gray; `--pp-text-muted` (#9ca3af) matches the first stop.
  { rank: 'D', threshold: 80,
    color: 'var(--pp-text-muted)',
    gradient: 'linear-gradient(135deg, var(--pp-text-muted), #6b7280)',
    glow: 'rgba(156, 163, 175, 0.6)' },
];

const rankInfo = computed<RankInfo | null>(() => {
  for (const r of RANK_LEGENDS) {
    if (props.progress >= r.threshold) return r;
  }
  return null;
});

const hasRank = computed(() => rankInfo.value !== null);

// Settings-driven render mode and computed video src
const settings = useSettingsStore();

const renderMode = computed(() => {
  if (settings.useWeekVideos) return "video";
  return props.mode || "image";
});

const computedVideoSrc = computed(() => {
  if (settings.useWeekVideos) {
    if (props.weekIndex !== undefined && props.weekIndex !== null) {
      const idx = Number(props.weekIndex) + 1;
      return `/videos/week-${idx}.mp4`;
    }
    const slug = String(props.weekName)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    return `/videos/${slug}.mp4`;
  }
  return props.videoSrc || "";
});
</script>

<style lang="scss" scoped>
.weekly-boss-container {
  text-align: center;
  position: relative;

  .boss-header {
    height: 0.25rem;
    background-color: var(--pp-emerald);
    margin-bottom: 0.5rem;
    border: 2px solid black;
    position: relative;
    overflow: visible;

    &.has-rank {
      background-color: var(--pp-gold-acc);
      height: 0.5rem;
    }

    .rank-banner {
      position: absolute;
      top: -1.5rem;
      left: 50%;
      transform: translateX(-50%);
      color: white;
      font-family: "Press Start 2P", cursive;
      font-size: 0.7rem;
      padding: 0.25rem 1rem;
      border: 3px solid black;
      z-index: 10;
      text-shadow: 2px 2px 0 black;
      animation: rank-float 3s ease-in-out infinite, rank-pulse 2s ease-in-out infinite;

      &[data-rank="S"] {
        /* S — purple/pink stops have no token; the gold endpoint swaps. */
        background: linear-gradient(135deg, #a855f7, #ec4899, var(--pp-gold-dk));
        box-shadow: 0 0 20px rgba(168, 85, 247, 0.8), 0 0 40px rgba(236, 72, 153, 0.5);
        animation: rank-float 3s ease-in-out infinite, rank-pulse 2s ease-in-out infinite, rainbow-shift 3s linear infinite;
      }
      &[data-rank="A"] {
        background: linear-gradient(135deg, var(--pp-gold-acc), var(--pp-gold-dk));
        box-shadow: 0 0 20px rgba(251, 191, 36, 0.8);
      }
      &[data-rank="B"] {
        background: linear-gradient(135deg, var(--pp-blue-light), var(--pp-blue-mid));
        box-shadow: 0 0 20px rgba(96, 165, 250, 0.8);
      }
      &[data-rank="C"] {
        /* C — orange-darker endpoint (#ea580c) has no token; keep literal. */
        background: linear-gradient(135deg, var(--pp-orange), #ea580c);
        box-shadow: 0 0 20px rgba(249, 115, 22, 0.8);
      }
      &[data-rank="D"] {
        background: linear-gradient(135deg, var(--pp-text-muted), #6b7280);
        box-shadow: 0 0 20px rgba(156, 163, 175, 0.6);
      }
    }
  }

  &.active {
    background-color: var(--pp-gold-dk);
    border-bottom-right-radius: 20px;
    border-bottom-left-radius: 20px;
  }

  .weekly-boss-image {
    /* B-T3: scale the portrait into whatever cell the shell gives us.
     * The fixed `height: 30rem` made narrower cells (phones 2×2, tablet
     * row-of-4) render either too tall or with bad cropping. Now the
     * image area follows container width with a 4:5 portrait aspect
     * ratio, and falls back to a sensible max-height at very wide cells.
     */
    width: 100%;
    height: auto;
    aspect-ratio: 4 / 5;
    margin: 0 auto;
    border: 2px solid black;
    background-color: var(--pp-gray);
    position: relative;
    overflow: hidden;
    margin-bottom: 0.75rem;
    display: flex;
    align-items: baseline;
    justify-content: center;

    img {
      width: 100%;
      height: 100%;
      max-width: 100%;
      max-height: 100%;
      object-fit: cover;
    }
    video {
      width: 100%;
      height: 100%;
      max-width: 100%;
      max-height: 100%;
      object-fit: cover;
      position: absolute;
      inset: 0;
    }
  }

  .week-label {
    color: white;
    font-family: "Press Start 2P", cursive;
    font-size: 0.75rem;
    margin-bottom: 0.75rem;
  }
}

/* Banner / active-glow animations only — bar / overlay animations live
 * in their respective subcomponents' co-located styles. */
@keyframes rank-float {
  0% {
    transform: translateX(-50%) translateY(0);
  }
  50% {
    transform: translateX(-50%) translateY(-8px);
  }
  100% {
    transform: translateX(-50%) translateY(0);
  }
}

@keyframes rank-pulse {
  0%, 100% {
    transform: translateX(-50%) scale(1);
  }
  50% {
    transform: translateX(-50%) scale(1.05);
  }
}

@keyframes rainbow-shift {
  0% {
    filter: hue-rotate(0deg) brightness(1.1);
  }
  50% {
    filter: hue-rotate(20deg) brightness(1.2);
  }
  100% {
    filter: hue-rotate(0deg) brightness(1.1);
  }
}

/* Enhanced active state with holographic glow */
.weekly-boss-container.active .weekly-boss-image {
  box-shadow:
    0 0 20px rgba(0, 255, 255, 0.4),
    0 0 40px rgba(0, 255, 255, 0.2),
    inset 0 0 20px rgba(0, 255, 255, 0.1);
  border-color: rgba(0, 255, 255, 0.5);
  animation: holo-glow 2s ease-in-out infinite;
}

@keyframes holo-glow {
  0%, 100% {
    box-shadow:
      0 0 20px rgba(0, 255, 255, 0.4),
      0 0 40px rgba(0, 255, 255, 0.2),
      inset 0 0 20px rgba(0, 255, 255, 0.1);
  }
  50% {
    box-shadow:
      0 0 30px rgba(0, 255, 255, 0.6),
      0 0 60px rgba(0, 255, 255, 0.3),
      inset 0 0 30px rgba(0, 255, 255, 0.15);
  }
}

/* B-T5 — honor `prefers-reduced-motion` for all boss animations. The
 * banner and active glow become static; the rainbow shift, pulse, and
 * float stop entirely so users who opted out don't get motion-stacked
 * overlays on top of their (already motion-heavy) screen. */
@media (prefers-reduced-motion: reduce) {
  .weekly-boss-container.active .weekly-boss-image,
  .boss-header .rank-banner {
    animation: none !important;
  }
  .boss-header .rank-banner,
  .boss-header .rank-banner[data-rank] {
    transform: translateX(-50%) !important;
    filter: none !important;
  }
}
</style>
