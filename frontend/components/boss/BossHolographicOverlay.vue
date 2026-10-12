<!--
  BossHolographicOverlay.vue (W4 split, UB-55).

  Active-week HUD: scanlines, glitch, frame, signal/battery HUD, corner
  brackets, grid lines, data streams, parallax layers. Templates only;
  styles co-located in `BossHolographicOverlay.styles.scss` and pulled
  in via `<style scoped src>`.
-->
<template>
  <div class="holo-overlay">
    <div class="holo-scanlines"></div>
    <div class="holo-glitch"></div>

    <div class="holo-frame">
      <div class="holo-top-bar">
        <div class="holo-signal">
          <span class="signal-dot"></span>
          <span class="signal-dot"></span>
          <span class="signal-dot"></span>
          <span class="holo-text">SIGNAL</span>
        </div>
        <div class="holo-battery">
          <div class="battery-level"></div>
          <span class="holo-text">85%</span>
        </div>
      </div>

      <div class="holo-corner top-left"></div>
      <div class="holo-corner top-right"></div>
      <div class="holo-corner bottom-left"></div>
      <div class="holo-corner bottom-right"></div>

      <div class="holo-grid-lines"></div>

      <div class="holo-data-stream">
        <div class="data-line"></div>
        <div class="data-line"></div>
        <div class="data-line"></div>
      </div>
    </div>

    <div class="holo-parallax-layer layer-1"></div>
    <div class="holo-parallax-layer layer-2"></div>
  </div>
</template>

<script setup lang="ts">
// No props — the parent decides whether to render this component (v-if="isActive").
</script>

<style scoped src="./BossHolographicOverlay.styles.scss"></style>
