<template>
  <!-- Monitor Transmission Effects Container -->
  <div class="monitor-effects" aria-hidden="true">
    <!-- CRT Scan Lines -->
    <div class="crt-scanlines"></div>

    <!-- RGB Chromatic Aberration -->
    <div class="rgb-shift"></div>

    <!-- Screen Noise -->
    <div class="screen-noise"></div>

    <!-- Vignette Effect -->
    <div class="screen-vignette"></div>

    <!-- Subtle Flicker -->
    <div class="screen-flicker"></div>
  </div>

  <!-- CRT Overlay -->
  <div class="crt-overlay" aria-hidden="true"></div>
</template>

<script setup lang="ts">
// Pure presentational — no logic. Effects live at the page root and
// are pointer-events: none, so they never intercept input.
</script>

<style lang="scss">
.monitor-effects {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 9998;
  overflow: hidden;
}

/* Subtle CRT Scanlines */
.crt-scanlines {
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    0deg,
    rgba(0, 0, 0, 0.03) 0px,
    rgba(0, 0, 0, 0.03) 1px,
    transparent 1px,
    transparent 2px
  );
  animation: scanlines-scroll 8s linear infinite;
  opacity: 0.5;
  z-index: 1;
}

@keyframes scanlines-scroll {
  0% {
    transform: translateY(0);
  }
  100% {
    transform: translateY(4px);
  }
}

/* RGB Chromatic Aberration */
.rgb-shift {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse at 30% 30%, rgba(255, 0, 0, 0.015) 0%, transparent 50%),
    radial-gradient(ellipse at 70% 70%, rgba(0, 255, 0, 0.015) 0%, transparent 50%),
    radial-gradient(ellipse at 50% 50%, rgba(0, 0, 255, 0.015) 0%, transparent 50%);
  mix-blend-mode: screen;
  animation: rgb-drift 10s ease-in-out infinite;
  z-index: 2;
}

@keyframes rgb-drift {
  0%, 100% {
    opacity: 0.3;
  }
  50% {
    opacity: 0.5;
  }
}

/* Screen Noise/Static */
.screen-noise {
  position: absolute;
  inset: 0;
  background-image:
    repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255, 255, 255, 0.01) 2px, rgba(255, 255, 255, 0.01) 4px),
    repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(255, 255, 255, 0.01) 2px, rgba(255, 255, 255, 0.01) 4px);
  animation: noise-shift 0.5s steps(4) infinite;
  opacity: 0.4;
  z-index: 3;
}

@keyframes noise-shift {
  0%, 100% {
    background-position: 0 0, 0 0;
  }
  25% {
    background-position: 1px 1px, -1px 0;
  }
  50% {
    background-position: -1px 0, 1px -1px;
  }
  75% {
    background-position: 0 -1px, -1px 1px;
  }
}

/* Vignette Effect */
.screen-vignette {
  position: absolute;
  inset: 0;
  background: radial-gradient(
    ellipse at center,
    transparent 0%,
    transparent 60%,
    rgba(0, 0, 0, 0.15) 100%
  );
  z-index: 4;
}

/* Subtle Screen Flicker */
.screen-flicker {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.02);
  animation: flicker-effect 5s ease-in-out infinite;
  z-index: 5;
}

@keyframes flicker-effect {
  0%, 100% {
    opacity: 0;
  }
  5% {
    opacity: 1;
  }
  10% {
    opacity: 0;
  }
  15% {
    opacity: 0.5;
  }
  20% {
    opacity: 0;
  }
  80% {
    opacity: 0;
  }
  85% {
    opacity: 0.3;
  }
  90% {
    opacity: 0;
  }
}

/* Enhance the existing CRT overlay */
.crt-overlay {
  position: fixed;
  inset: 0;
  background:
    repeating-linear-gradient(
      0deg,
      rgba(0, 0, 0, 0.15),
      rgba(0, 0, 0, 0.15) 1px,
      transparent 1px,
      transparent 2px
    );
  pointer-events: none;
  z-index: 9999;
  opacity: 0.2;
  mix-blend-mode: multiply;
  animation: crt-flicker 0.15s infinite;
}

@keyframes crt-flicker {
  0% {
    opacity: 0.2;
  }
  50% {
    opacity: 0.22;
  }
  100% {
    opacity: 0.2;
  }
}

/*
  UB-56 / W4b reduced motion + phone lightening:
    - On phones (< 640 px) drop the noise + flicker overlays entirely.
    - On `prefers-reduced-motion: reduce` disable every CRT animation
      so the static base effect still paints but nothing moves.
*/
@media (max-width: 639px) {
  .screen-noise,
  .screen-flicker,
  .crt-overlay {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .crt-scanlines,
  .rgb-shift,
  .screen-noise,
  .screen-flicker,
  .crt-overlay {
    animation: none !important;
  }
  .screen-flicker {
    opacity: 0;
  }
}
</style>