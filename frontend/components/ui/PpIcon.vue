<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    role="img"
    :aria-hidden="label == null ? 'true' : undefined"
    :aria-label="label"
    focusable="false"
    class="pp-icon"
  >
    <path
      v-if="path"
      :d="path"
      :fill="filled ? 'currentColor' : 'none'"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="square"
      stroke-linejoin="miter"
    />
  </svg>
</template>

<script setup lang="ts">
/*
 * V2 Combat Deck icon (contract §2).
 *
 * Inline SVG paths copied verbatim from Material Symbols Outlined 24px
 * (the set of <icon-name>.svg files served by fonts.google.com/icons).
 * Material Symbols and the underlying Material Icons are Apache License
 * 2.0 (https://www.apache.org/licenses/LICENSE-2.0). No code is generated
 * by a font or fetched at runtime — the `d` strings are static so the
 * icon renders even when the network is offline.
 *
 * Stroke-only by default (the "outlined" variant of Material Symbols
 * uses thin strokes). Pass `filled` to use a solid fill (for active /
 * completed state). `currentColor` everywhere so colour follows the
 * parent text or class.
 *
 * Accessibility: `aria-hidden` by default (icons next to a label are
 * decorative). Pass `label` to expose the icon as an image with a
 * meaningful name (e.g. standalone search button).
 */

import { computed } from "vue";
import type { IconName } from "./iconNames";

// Material Symbols Outlined 24px paths (Apache-2.0). Each entry is the
// `d` attribute of the only <path> in the source SVG.
const PATHS: Record<IconName, string> = {
  grid_view: "M3 3h8v8H3V3m10 0h8v8h-8V3m-10 10h8v8H3v-8m10 0h8v8h-8v-8Z",
  insights:
    "M3 21V11h4v10H3m6 0V3h4v18H9m6 0V8h4v13h-4m-9-3h2v-5H6v5m6 0h2V5h-2v13m6 0h2v-8h-2v8Z",
  settings:
    "M19.14 12.94a7.49 7.49 0 0 0 .05-.94 7.49 7.49 0 0 0-.05-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.03 7.03 0 0 0-1.62-.94l-.36-2.54A.5.5 0 0 0 13.9 2h-3.84a.5.5 0 0 0-.5.42l-.36 2.54c-.59.24-1.13.56-1.62.94l-2.39-.96a.5.5 0 0 0-.6.22L2.67 8.48a.5.5 0 0 0 .12.64l2.03 1.58a7.49 7.49 0 0 0-.05.94c0 .31.02.62.05.94l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32a.5.5 0 0 0 .6.22l2.39-.96c.49.38 1.03.7 1.62.94l.36 2.54a.5.5 0 0 0 .5.42h3.84a.5.5 0 0 0 .5-.42l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96a.5.5 0 0 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58M12 15.5A3.5 3.5 0 1 1 15.5 12 3.5 3.5 0 0 1 12 15.5Z",
  add: "M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6Z",
  add_box: "M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2m-7 7h3v2h-3v3h-2v-3H7v-2h3V7h2Z",
  content_copy:
    "M16 1H4a2 2 0 0 0-2 2v14h2V3h12V1m3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2m0 16H8V7h11Z",
  check: "M21 7L9 19l-5.5-5.5 1.41-1.41L9 16.17 19.59 5.59Z",
  close: "M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12Z",
  edit: "M20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.84 1.83 3.75 3.75M3 17.25V21h3.75L17.81 9.93l-3.75-3.75Z",
  edit_note:
    "M3 10h11v2H3v-2m0-2h11V6H3v2m0 8h7v-2H3v2m15.01-3.13l1.42-1.42a.996.996 0 1 0-1.41-1.41l-1.42 1.42 1.41 1.41m-1.42 1.42L11.13 18.5 8 19l.5-3.13 5.51-5.51 2.42 2.42Z",
  delete: "M19 4h-3.5l-1-1h-5l-1 1H5v2h14V4m-2 4v12a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V8h10Z",
  filter_list:
    "M3 5h18v2H3V5m3 6h12v2H6v-2m4 6h4v2h-4v-2Z",
  sync_alt: "M7.5 5.6L10 3 8.6 1.6 2.8 7.4l5.8 5.8L10 11.8 7.5 9.2 7.5 11H4V7.5h3.5m9 12.4L14 21l1.4 1.4 5.8-5.8-5.8-5.8L14 12.2l2.5 2.6V12.5H20V16h-3.5Z",
  alt_route:
    "M9 4.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5M4 7a5 5 0 1 1 9.4 2c-.6.5-1.4 1-2.4 1.5l-2 1A11 11 0 0 0 5 16H3a13 13 0 0 1 5.5-7.5A5 5 0 0 1 4 7m11 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5m5-2.5a5 5 0 1 1-9.4-2c.6-.5 1.4-1 2.4-1.5l2-1A11 11 0 0 0 19 8h2a13 13 0 0 1-5.5 7.5 5 5 0 0 1-.5 4.5Z",
  terminal:
    "M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2m0 2v12h14V6H5m2 3l4 3-4 3v-2l3-1-3-1V9m6 5h3v2h-3v-2Z",
  radar: "M19.07 4.93A10 10 0 0 0 4.93 19.07l1.41 1.41A8 8 0 0 1 4 12a8 8 0 0 1 12.66-6.54l-1.42 1.42A6 6 0 0 0 6 12a6 6 0 0 0 .34 2.07l1.41-1.41A4 4 0 0 1 7 11.65V11l4.34-4.34 1.41 1.41L8.6 12.21l1.42 1.42L14.27 9.4l1.41 1.41-4.34 4.34h-.65a4 4 0 0 1-.92-.26l-1.41 1.41A6 6 0 0 0 12 18a6 6 0 0 0 5.07-2.93l1.41 1.41A8 8 0 0 1 4.93 19.07 10 10 0 0 0 19.07 4.93Z",
  center_focus_strong:
    "M12 8a4 4 0 1 0 4 4 4 4 0 0 0-4-4m0 10a6 6 0 1 1 6-6 6 6 0 0 1-6 6M5 3a2 2 0 0 0-2 2v4h2V5h4V3H5m12 0v2h4v4h2V5a2 2 0 0 0-2-2h-4M3 19a2 2 0 0 0 2 2h4v-2H5v-4H3v4m18-4h-2v4h-4v2h4a2 2 0 0 0 2-2v-4Z",
  grid_4x4:
    "M4 4h4v4H4V4m6 0h4v4h-4V4m6 0h4v4h-4V4M4 10h4v4H4v-4m6 0h4v4h-4v-4m6 0h4v4h-4v-4M4 16h4v4H4v-4m6 0h4v4h-4v-4m6 0h4v4h-4v-4Z",
  auto_videocam:
    "M21 7v10l-5-3v-4l5-3m-7-1H4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2m-5 8H7v-2h2v2m0-3H7v-2h2v2m3 3h-2v-2h2v2m0-3h-2v-2h2v2Z",
  videocam_off:
    "M3.27 1L2 2.27 4.73 5H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12.73L20 22.46 21.27 21M21 7v10l-5-3v-4l5-3M5.27 5l11.73 11.73V17H6.27L5.27 5Z",
  workspace_premium:
    "M9 2v2H7l4 4 4-4h-2V2H9m5 5.5L12 9.5 10 7.5 7 17h10l-3-9.5M12 12.5a1 1 0 0 1-1-1 1 1 0 0 1 1-1 1 1 0 0 1 1 1 1 1 0 0 1-1 1Z",
  military_tech:
    "M7.5 3H4v3.5L7.5 4.5V3M20 3h-3.5v1.5L20 6.5V3m-7 0h-2v2L9 6.5V3H4l5 4 5-4m-5 7L7 17h2.5L9 20l3-2 3 2-.5-3H17l-4-7m5 4l3-3v8l-4-2-2 2v-7l3 2Z",
  shield:
    "M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4m0 6a3 3 0 1 1-3 3 3 3 0 0 1 3-3m5.5 7.5a1 1 0 0 0-1.4-.2 4.5 4.5 0 0 1-3.1 1.2 4.5 4.5 0 0 1-3.1-1.2 1 1 0 0 0-1.2 1.6 6.5 6.5 0 0 0 4.3 1.6 6.5 6.5 0 0 0 4.3-1.6 1 1 0 0 0 .2-1.4Z",
  security:
    "M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4m0 2.18L18.82 7 12 9.18 5.18 7 12 3.18M12 11a3 3 0 1 1-3 3 3 3 0 0 1 3-3m-1 5h2v6h-2v-6Z",
  event_repeat:
    "M19 4h-2V2h-2v2H9V2H7v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h9v-2H5V10h14v3h2V6a2 2 0 0 0-2-2m-7 11l-1.41-1.41L13.17 17H8v-2h5.17l-2.58-2.59L12 11l4 4-4 4Z",
  menu: "M3 6h18v2H3V6m0 5h18v2H3v-2m0 5h18v2H3v-2Z",
  chevron_left: "M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12Z",
  chevron_right: "M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6Z",
  star: "M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21Z",
  drag_indicator:
    "M11 18a2 2 0 1 0 2 2 2 2 0 0 0-2-2m0-16a2 2 0 1 0 2 2 2 2 0 0 0-2-2m0 7a2 2 0 1 0 2 2 2 2 0 0 0-2-2m6 9a2 2 0 1 0 2 2 2 2 0 0 0-2-2m0-16a2 2 0 1 0 2 2 2 2 0 0 0-2-2m0 7a2 2 0 1 0 2 2 2 2 0 0 0-2-2Z",
  calendar_month:
    "M19 4h-2V2h-2v2H9V2H7v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2m0 16H5V10h14v10M5 8V6h14v2H5m5 4h2v2h-2v-2m4 0h2v2h-2v-2m-4 4h2v2h-2v-2m4 0h2v2h-2v-2Z",
  more_horiz:
    "M16 12a2 2 0 1 0 2 2 2 2 0 0 0-2-2m-8 0a2 2 0 1 0 2 2 2 2 0 0 0-2-2m4 0a2 2 0 1 0 2 2 2 2 0 0 0-2-2Z",
  refresh:
    "M17.65 6.35A7.96 7.96 0 0 0 12 4a8 8 0 1 0 7.73 10h-2.08A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35Z",
  flag: "M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6Z",
  swap_horiz:
    "M21 9l-4-4v3h-7v2h7v3l4-4m-9 6l-4 4v-3h7v-2H8v-3l-4 4Z",
  notes:
    "M3 18h12v-2H3v2m0-5h12v-2H3v2m0-5v2h12V6H3m16 14l-4-4h3V8l4 4-3 6Z",
};

const props = withDefaults(
  defineProps<{
    name: IconName;
    size?: number;
    filled?: boolean;
    label?: string;
  }>(),
  { size: 18, filled: false },
);

const path = computed<string>(() => PATHS[props.name] ?? "");
</script>

<style scoped>
.pp-icon {
  /* Icons are decorative by default; this lets text-align / flex centre
     them with a single `inline-flex` wrapper. */
  display: inline-block;
  flex-shrink: 0;
  vertical-align: middle;
  line-height: 0;
}
</style>
