<!--
  BossHolographicOverlay.vue (V2 A10 restyle, W3 owner).

  Static HUD chrome overlaid on the active boss portrait. No animations
  (V2 contract). Just four corner brackets + a top-bar signal indicator.
  Co-located SCSS in `BossHolographicOverlay.styles.scss`.
-->
<template>
  <div class="holo-overlay" aria-hidden="true">
    <div class="holo-frame">
      <div class="holo-top-bar">
        <div class="holo-signal">
          <span class="signal-dot" />
          <span class="signal-dot" />
          <span class="signal-dot" />
          <span class="holo-text">SIGNAL</span>
        </div>
      </div>
      <div class="holo-corner top-left" />
      <div class="holo-corner top-right" />
      <div class="holo-corner bottom-left" />
      <div class="holo-corner bottom-right" />
    </div>
  </div>
</template>

<script setup lang="ts">
// No props — the parent decides whether to render this component (v-if="isActive").
</script>

<style scoped src="./BossHolographicOverlay.styles.scss" />
