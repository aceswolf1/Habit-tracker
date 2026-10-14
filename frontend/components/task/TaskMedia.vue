<!--
  TaskMedia.vue (W2 contract §4 / Wave B / B3).

  Shared media tile for tasks. Two variants:
    - `thumb` — used in the Spotlight row (16:9). ~64×36 phone,
                ~128×72 desktop. Hidden when the task has no media AND
                no icon AND the consumer passed `hideOnEmpty` (used on
                phone rows).
    - `tile`  — used in the 7D Grid card (16:9, full width of column);
                never hidden.

  Holds the W5 perf logic (MP4 plays only on screen, JPG poster
  otherwise, falls back to <img loading="lazy"> for older tasks with
  no MP4, falls back to an emoji icon, falls back to a compact
  placeholder when `hideOnEmpty` is false OR when on desktop).

  Phone (`< 640px`) layout rules (W2 Wave B / B3):
    - On phone, the empty placeholder is hidden for `thumb` (so a
      no-media + no-icon task shows nothing in the phone row and the
      title can use 2 lines).
    - Desktop always shows the compact `notes`-icon placeholder at
      40% opacity when the task has neither media nor icon.

  The scanline overlay is a static CSS gradient (no animation, no
  backdrop-filter below lg per W5 perf contract).
-->
<template>
  <div
    v-if="!shouldHide"
    class="task-media relative overflow-hidden bg-pp-card border border-pp-line"
    :class="[
      variant === 'thumb' ? 'task-media-thumb' : 'task-media-tile',
      'aspect-[16/9]',
    ]"
    :aria-hidden="true"
  >
    <!-- Static scanline overlay (CSS gradient, no animation) -->
    <div
      class="absolute inset-0 pointer-events-none z-[1]"
      style="background: repeating-linear-gradient(
        to bottom,
        rgba(0, 0, 0, 0) 0,
        rgba(0, 0, 0, 0) 2px,
        rgba(0, 0, 0, 0.18) 3px,
        rgba(0, 0, 0, 0) 4px
      );"
    ></div>

    <!-- W5 perf: MP4 rendition (hardware-decoded, plays only on screen).
         JPG poster until then. Older tasks without renditions keep the GIF. -->
    <video
      v-if="task.gifVideoUrl && !videoFailed"
      ref="videoEl"
      class="absolute inset-0 w-full h-full object-cover"
      :poster="task.gifStillUrl || undefined"
      muted
      loop
      playsinline
      disablepictureinpicture
      preload="none"
      :aria-label="task.description"
      @error="videoFailed = true"
    >
      <source :src="task.gifVideoUrl" type="video/mp4" @error="videoFailed = true" />
    </video>

    <!-- Lazy GIF/img fallback (no MP4 rendition or MP4 failed) -->
    <img
      v-else-if="task.gifUrl"
      :src="task.gifUrl"
      :alt="task.description"
      class="absolute inset-0 w-full h-full object-cover"
      :class="{ 'opacity-80': !task.completed }"
      loading="lazy"
      decoding="async"
      @error="onImgError"
    />

    <!-- Emoji icon fallback (no GIF at all) -->
    <div
      v-else-if="task.icon"
      class="absolute inset-0 flex items-center justify-center bg-pp-card text-2xl"
      :class="[
        variant === 'thumb' ? 'sm:text-3xl' : 'text-4xl',
      ]"
      :aria-label="task.description"
      role="img"
    >
      {{ task.icon }}
    </div>

    <!-- Empty placeholder (desktop only when hideOnEmpty is on;
         always shown on `tile` so the grid card has the same shape). -->
    <div
      v-else
      class="absolute inset-0 flex items-center justify-center bg-pp-card text-pp-muted"
      :style="{ opacity: 0.4 }"
      :aria-hidden="true"
    >
      <span
        v-if="variant === 'thumb'"
        class="font-mono uppercase tracking-wider text-[10px] sm:text-xs"
      >
        <PpIcon name="notes" :size="14" />
      </span>
      <span
        v-else
        class="font-mono uppercase tracking-wider text-xs"
      >
        <PpIcon name="notes" :size="16" />
      </span>
    </div>

    <!-- v2.1: duration overlay (contract §5). Bottom-right corner of
         the thumb/tile, only when a `durationLabel` is provided. The
         caller (TaskRow / TaskTile) renders the formatted time string
         via the contract display rule: < 60 min → `MM:00`; ≥ 60 →
         `H:MM:00`. The overlay sits above the media but below any
         absolute-positioned control in the parent. -->
    <span
      v-if="durationLabel"
      class="duration-overlay font-mono"
      aria-hidden="true"
    >{{ durationLabel }}</span>
  </div>
  <!-- Spacer when hidden on phone: keeps alignment neutral but costs
       nothing visually since `<div></div>` has no box. -->
  <span v-else aria-hidden="true" class="hidden" />
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import PpIcon from "../ui/PpIcon.vue";
import { useInViewPlayback } from "../../composables/useInViewPlayback";
import { useSettingsStore } from "../../stores/settingsStore";
import type { Task } from "../../types/index";

const props = withDefaults(
  defineProps<{
    task: Task;
    variant: "thumb" | "tile";
    /**
     * When true the component renders nothing for tasks with no media
     * AND no icon. Used on phone spotlight rows so a media-less task
     * has no row thumb (and the title can use 2 lines instead of
     * flowing around a 64×36 empty box).
     *
     * On desktop we always render the compact placeholder so the row
     * keeps a uniform left-hand column (visual rhythm of the list).
     */
    hideOnEmpty?: boolean;
    /**
     * v2.1: pre-formatted duration label rendered as a bottom-right
     * overlay (contract §5). The parent (TaskRow / TaskTile) decides
     * the format: < 60 min → `MM:00`; ≥ 60 → `H:MM:00`.
     */
    durationLabel?: string | null;
  }>(),
  { hideOnEmpty: false, durationLabel: null },
);

const settings = useSettingsStore();
const videoEl = ref<HTMLVideoElement | null>(null);
const videoFailed = ref(false);
useInViewPlayback(videoEl, () => settings.animateGifs);

function onImgError(e: Event) {
  // If the lazy <img> fails, hide it so the scanline overlay + placeholder
  // underneath are the only thing showing.
  const t = e.target as HTMLImageElement;
  t.style.display = "none";
}

const hasMediaOrIcon = computed(
  () => !!(props.task.gifUrl || props.task.gifVideoUrl || props.task.icon),
);

/**
 * `shouldHide` is true only on phone `thumb` rows where the task has
 * neither media nor an icon and the caller asked us to hide the empty
 * placeholder. Desktop rows always render (with the 40% notes-icon
 * placeholder).
 */
const shouldHide = computed(() => {
  if (!props.hideOnEmpty) return false;
  if (props.variant !== "thumb") return false;
  if (typeof window === "undefined") return false; // SSR-safe
  if (window.innerWidth >= 640) return false; // desktop: always show
  return !hasMediaOrIcon.value;
});
</script>

<style scoped>
/* Thumb variant — narrow inline thumbnail next to the row text.
   Phone (≤ 640): 64×36 (16:9) so 2-line titles fit.
   ≥ sm: 96×54 — compact desktop thumb that pairs with the compact
   72px-tall row to fit 7 tasks in a 1440×900 spotlight without
   scrolling. (Wave B / B3 acceptance criterion 3.) */
.task-media-thumb {
  width: 64px;
}
@media (min-width: 640px) {
  .task-media-thumb {
    width: 96px;
  }
}

/* Tile variant — fills the card top, scales with the card. */
.task-media-tile {
  width: 100%;
}

/*
 * v2.1 duration overlay — bottom-right corner of the thumb/tile.
 * Sharp 1px line border with a 60% opaque panel background so it
 * reads against any media. Mono body, very small, uppercase.
 * Sits above the media and any scanline overlay (z-index 2 vs 1).
 */
.duration-overlay {
  position: absolute;
  right: 4px;
  bottom: 4px;
  z-index: 2;
  padding: 1px 4px;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.05em;
  color: var(--pp-cyan);
  background: rgba(15, 20, 31, 0.78);
  border: 1px solid var(--pp-cyan);
  line-height: 1.4;
  pointer-events: none;
}

@media (min-width: 640px) {
  .duration-overlay {
    font-size: 10px;
    padding: 1px 5px;
  }
}
</style>
