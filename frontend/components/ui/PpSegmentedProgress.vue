<template>
  <div
    class="pp-segprog"
    role="progressbar"
    :aria-valuenow="clamped"
    aria-valuemin="0"
    aria-valuemax="100"
    :style="containerStyle"
  >
    <div class="pp-segprog__fill" :style="fillStyle"></div>
    <div v-if="segments > 0" class="pp-segprog__notches" :style="notchStyle"></div>
  </div>
</template>

<script setup lang="ts">
/*
 * V2 Combat Deck segmented progress (contract §2).
 *
 * Static progress bar with a stepped fill. Three colours:
 *   - cyan      (default) — base XP.
 *   - gradient  — cyan → magenta, used for the boss sync threshold.
 *   - amber     — today / optional reward meters.
 *   - green     — completed / verified state.
 *
 * Pass `segments` to draw vertical notches dividing the bar into N
 * equal columns (the design calls for "stepped block fills" — e.g. a
 * 4-week tracker gets 4 segments). Omit `segments` for a continuous
 * fill. The bar is never animated: the caller re-renders with the new
 * value when state changes.
 *
 * The `value` prop accepts 0–110; values above 100 still fill the bar
 * (the design allows up to a 10 % bonus band on top of 100 %).
 */

import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    value: number;
    segments?: number;
    color?: "cyan" | "gradient" | "amber" | "green";
    height?: number;
  }>(),
  { segments: 0, color: "cyan", height: 4 },
);

const clamped = computed(() => Math.max(0, Math.min(props.value, 100)));

const containerStyle = computed(() => ({
  height: `${props.height}px`,
}));

const fillStyle = computed(() => {
  const width = `${clamped.value}%`;
  if (props.color === "gradient") {
    return {
      width,
      background:
        "linear-gradient(90deg, var(--pp-cyan) 0%, var(--pp-cyan) 50%, var(--pp-magenta) 100%)",
    };
  }
  if (props.color === "amber") {
    return { width, background: "var(--pp-amber)" };
  }
  if (props.color === "green") {
    return { width, background: "var(--pp-green)" };
  }
  return { width, background: "var(--pp-cyan)" };
});

// Notches: a repeating linear gradient with `segments` columns. We use
// one notch per segment boundary, so 4 segments = 3 interior notches.
// The notch is the same colour as the track border, so it reads as
// "the fill is split into blocks" without an animated effect.
const notchStyle = computed(() => {
  if (props.segments <= 1) return { display: "none" } as Record<string, string>;
  const step = 100 / props.segments;
  const stops: string[] = [];
  for (let i = 1; i < props.segments; i++) {
    stops.push(
      `${(i * step).toFixed(4)}px var(--pp-line)`,
      `${(i * step).toFixed(4)}px transparent 1px`,
    );
  }
  return {
    backgroundImage: `linear-gradient(90deg, ${stops.join(", ")})`,
  };
});
</script>

<style scoped>
.pp-segprog {
  position: relative;
  width: 100%;
  background: var(--pp-void);
  border: 1px solid var(--pp-line);
  overflow: hidden;
}

.pp-segprog__fill {
  height: 100%;
  transition: none;
  box-shadow: inset 0 0 4px rgba(0, 0, 0, 0.4);
}

.pp-segprog__notches {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-repeat: no-repeat;
}
</style>
