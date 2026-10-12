<template>
  <!-- Fixed gradient depth background -->
  <div class="background-depth" aria-hidden="true"></div>
  <!-- Ambient particles across whole viewport -->
  <BackgroundParticles :count="120" :link-distance="150" :link-opacity="0.12" />
</template>

<script setup lang="ts">
import BackgroundParticles from "../BackgroundParticles.vue";
// Background lives behind everything (z-index 0); pointer-events: none.
// Counts and link distance were tuned by w3; keep them stable.
</script>

<style lang="scss">
.background-depth {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background: radial-gradient(
      circle at 65% 50%,
      rgba(60, 95, 150, 0.35) 0%,
      rgba(10, 18, 32, 0.05) 55%,
      rgba(4, 8, 16, 0.9) 85%
    ),
    radial-gradient(
      circle at 25% 70%,
      rgba(120, 150, 200, 0.18) 0%,
      rgba(10, 18, 32, 0) 60%
    ),
    linear-gradient(
      140deg,
      var(--pp-bg-mid) 0%,
      var(--pp-bg-up) 40%,
      var(--pp-bg-deep) 70%,
      var(--pp-bg-deepest) 100%
    );
  background-repeat: no-repeat;
  background-attachment: fixed, fixed, fixed;
  animation: bg-slow-shift 34s ease-in-out infinite alternate;
  /* subtle star speckle overlay */
  mask-image: radial-gradient(
    circle at 50% 50%,
    var(--pp-black) 0%,
    var(--pp-black) 75%,
    rgba(0, 0, 0, 0.85) 100%
  );
}

@keyframes bg-slow-shift {
  0% {
    filter: brightness(1) contrast(1);
  }
  45% {
    filter: brightness(1.05) contrast(1.04);
  }
  100% {
    filter: brightness(1) contrast(1.02);
  }
}

/* UB-56: static background for reduced-motion users. */
@media (prefers-reduced-motion: reduce) {
  .background-depth {
    animation: none;
  }
}
</style>