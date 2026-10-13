<template>
  <!--
    V2 Combat Deck background (contract §3, §7).
    Static `--pp-void` canvas + a dot-matrix + scanline overlay capped at
    ≤ 4% opacity. CSS-only, no animation, no canvas. Pointer-events:
    none so it never intercepts input.
  -->
  <div class="app-bg" aria-hidden="true">
    <div class="app-bg__dots"></div>
    <div class="app-bg__scan"></div>
  </div>
</template>

<script setup lang="ts">
// Presentational; no props. The two overlays are static CSS — no
// particle field, no animation, no canvas — so the page idle frame
// count is exactly 0 (down from the W4a BackgroundParticles canvas).
</script>

<style scoped>
.app-bg {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background: var(--pp-void);
  /* W4a: a soft cyan radial wash on the centre so the panels "glow"
     without any animation. Kept tiny (≤ 4 % luma) so it never blurs
     the content above. */
  background-image:
    radial-gradient(
      circle at 50% 35%,
      rgba(0, 240, 255, 0.04) 0%,
      transparent 55%
    );
}

.app-bg__dots {
  position: absolute;
  inset: 0;
  opacity: 0.04;
  background-image: radial-gradient(
    circle at 1px 1px,
    var(--pp-cyan) 1px,
    transparent 1px
  );
  background-size: 16px 16px;
}

.app-bg__scan {
  position: absolute;
  inset: 0;
  opacity: 0.035;
  background-image: repeating-linear-gradient(
    0deg,
    rgba(255, 255, 255, 0.5) 0,
    rgba(255, 255, 255, 0.5) 1px,
    transparent 1px,
    transparent 3px
  );
}

@media (prefers-reduced-motion: reduce) {
  .app-bg__dots,
  .app-bg__scan {
    /* already static, but the rule documents intent */
  }
}
</style>
