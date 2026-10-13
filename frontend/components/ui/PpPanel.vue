<template>
  <component
    :is="tag"
    :class="classes"
  >
    <header v-if="$slots.header" class="pp-panel__header">
      <slot name="header" />
    </header>
    <div v-if="padded" class="pp-panel__body">
      <slot />
    </div>
    <slot v-else />
  </component>
</template>

<script setup lang="ts">
/*
 * V2 Combat Deck panel (contract §2).
 *
 * Sharp container with a 1px line border. Pass `chamfer` for the
 * 8-px diagonal corner trim that DESIGN.md uses for highlighted HUD
 * blocks (the main level tracker, weekly hero banners, etc.).
 * `glow` adds a static neon glow under the panel (cyan / magenta /
 * amber); it is never animated.
 *
 * The element tag defaults to <section> but can be overridden (`tag`)
 * for cases where semantics call for a <div> or <article>. The default
 * slot is the body; an optional `header` slot lives at the top.
 */

import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    chamfer?: boolean;
    glow?: "cyan" | "magenta" | "amber" | null;
    tag?: string;
    padded?: boolean;
  }>(),
  {
    chamfer: false,
    glow: null,
    tag: "section",
    padded: true,
  },
);

const classes = computed(() => [
  "pp-panel",
  {
    "pp-panel--chamfer": props.chamfer,
    "pp-panel--glow-cyan": props.glow === "cyan",
    "pp-panel--glow-magenta": props.glow === "magenta",
    "pp-panel--glow-amber": props.glow === "amber",
  },
]);
</script>

<style scoped>
.pp-panel {
  position: relative;
  background: var(--pp-panel);
  border: 1px solid var(--pp-line);
  color: var(--pp-text);
}

.pp-panel--chamfer {
  /* 8-px chamfer: clip two opposing corners via clip-path. The corners
     still render the 1px line border thanks to the same clip-path on a
     ::before pseudo-element that paints the border. */
  --pp-chamfer: 8px;
  clip-path: polygon(
    var(--pp-chamfer) 0,
    100% 0,
    100% calc(100% - var(--pp-chamfer)),
    calc(100% - var(--pp-chamfer)) 100%,
    0 100%,
    0 var(--pp-chamfer)
  );
  border: 0;
}
.pp-panel--chamfer::before {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  border: 1px solid var(--pp-line);
  clip-path: polygon(
    var(--pp-chamfer) 0,
    100% 0,
    100% calc(100% - var(--pp-chamfer)),
    calc(100% - var(--pp-chamfer)) 100%,
    0 100%,
    0 var(--pp-chamfer)
  );
}

.pp-panel--glow-cyan {
  box-shadow: var(--pp-glow-cyan);
}
.pp-panel--glow-magenta {
  box-shadow: var(--pp-glow-magenta);
}
.pp-panel--glow-amber {
  box-shadow: var(--pp-glow-amber);
}

.pp-panel__header {
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--pp-line);
  background: var(--pp-card);
  font-family: "Space Grotesk", system-ui, sans-serif;
  font-weight: 700;
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--pp-text);
}

.pp-panel__body {
  padding: 0.75rem;
}
</style>
