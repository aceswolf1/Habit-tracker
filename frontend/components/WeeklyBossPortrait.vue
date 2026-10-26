<!--
  WeeklyBossPortrait.vue (V2 A10 restyle, W3 owner).

  V2 restyle: sharp 1px line border, static scanline overlay, no
  animated glows/floats/pulses. Legacy read-only month view still uses
  this component (props unchanged). The cockpit mounts the same SFC
  with `compact` so it doesn't repeat the header + progress bar.
-->
<template>
  <div
    class="weekly-boss-container"
    :class="[{ active: isActive, compact: compact }]"
    :data-progress="Math.round(progress / 10) * 10"
    @click="emit('set-current-week', weekUuid)"
  >
    <div v-if="!compact" class="boss-header" :class="{ 'has-rank': hasRank }">
      <div v-if="hasRank" class="rank-banner" :data-rank="rankInfo.rank">
        RANK {{ rankInfo.rank }}
      </div>
    </div>
    <div class="weekly-boss-image">
      <img v-if="renderMode === 'image'" :src="imageSrc" :alt="weekName" decoding="async" />
      <!-- W5 perf: optional boss videos (~8 MB each) play only while visible. -->
      <!-- :key recreates the element per week: browsers don't reload a
           <video> when only its <source> changes (it kept week 1's clip). -->
      <video
        v-if="renderMode === 'video'"
        :key="computedVideoSrc"
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

      <!-- Static scanline overlay (V2) — purely visual, no animation. -->
      <div v-if="!compact" class="boss-scanlines" aria-hidden="true" />

      <BossHolographicOverlay v-if="isActive && !compact" />
      <BossRankBadge v-if="hasRank" :rank="rankInfo" :progress="progress" />
    </div>
    <div v-if="!compact" class="week-label">{{ weekName }}</div>

    <BossProgressBar
      v-if="!compact"
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
  /** V2 A10: when true, hide the header / week-label / progress bar so the
   *  cockpit can mount just the portrait + rank badge in a single card. */
  compact: {
    type: Boolean,
    default: false,
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
/* V2 A10 restyle: sharp 1px line border, static scanlines, no glow/float
 * animations. Reads the V2 design tokens (`--pp-cyan`, `--pp-line`, …) and
 * falls back to a small rank chip in the top corner. The header / label /
 * progress bar stay hidden when `compact` is set (cockpit mount). */
.weekly-boss-container {
  text-align: center;
  position: relative;
  background: var(--pp-card);
  border: 1px solid var(--pp-line);
  padding: 0.5rem;

  /* Legacy (V0/V1) read-only month view keeps using this without `compact`;
   * for that path the "active" gold background + 2px black border is preserved
   * to avoid visual regression in the existing shell. */
  &.active:not(.compact) {
    background: var(--pp-card-active);
    border-color: var(--pp-amber);
  }

  &.compact {
    padding: 0;
    background: transparent;
  }

  /* Cockpit below lg sits under the task list: a wide banner crop keeps
     the boss from filling the whole phone screen. */
  @media (max-width: 1023.98px) {
    &.compact .weekly-boss-image {
      aspect-ratio: 16 / 9;

      img,
      video {
        object-position: center 25%;
      }
    }
  }

  .boss-header {
    height: 2px;
    background: var(--pp-green);
    margin-bottom: 0.5rem;
    border: 0;
    position: relative;
    overflow: visible;

    &.has-rank {
      background: var(--pp-amber);
      height: 2px;
    }

    .rank-banner {
      position: absolute;
      top: -0.875rem;
      left: 0.5rem;
      color: var(--pp-text);
      font-family: "JetBrains Mono", monospace;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      padding: 0.125rem 0.375rem;
      border: 1px solid var(--pp-line);
      background: var(--pp-card);
      z-index: 10;

      &[data-rank="S"] { color: var(--pp-magenta); border-color: var(--pp-magenta); }
      &[data-rank="A"] { color: var(--pp-amber); border-color: var(--pp-amber); }
      &[data-rank="B"] { color: var(--pp-cyan); border-color: var(--pp-cyan); }
      &[data-rank="C"] { color: var(--pp-amber); border-color: var(--pp-amber); }
      &[data-rank="D"] { color: var(--pp-muted); border-color: var(--pp-muted); }
    }
  }

  .weekly-boss-image {
    width: 100%;
    height: auto;
    aspect-ratio: 4 / 5;
    margin: 0 auto;
    border: 1px solid var(--pp-line);
    background: var(--pp-void);
    position: relative;
    overflow: hidden;
    margin-bottom: 0.5rem;
    display: flex;
    align-items: center;
    justify-content: center;

    img,
    video {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    video {
      position: absolute;
      inset: 0;
    }

    /* V2 static scanline overlay: 2px repeat, 30% opacity, no animation. */
    .boss-scanlines {
      position: absolute;
      inset: 0;
      background: repeating-linear-gradient(
        0deg,
        rgba(0, 240, 255, 0.05) 0,
        rgba(0, 240, 255, 0.05) 1px,
        transparent 1px,
        transparent 3px
      );
      pointer-events: none;
      z-index: 3;
    }
  }

  .week-label {
    color: var(--pp-text);
    font-family: "Space Grotesk", sans-serif;
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    margin-bottom: 0.5rem;
  }
}

/* V2 honors `prefers-reduced-motion` even though most animations are gone. */
@media (prefers-reduced-motion: reduce) {
  .weekly-boss-container,
  .weekly-boss-container * {
    animation: none !important;
    transition: none !important;
  }
}
</style>
