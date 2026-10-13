<!--
  SettingsDrawer.vue (W1 restyle, V2 Combat Deck).

  Right-side settings sheet, ≤ lg becomes a full-width sheet pinned to
  the viewport edge. Two settings remain — both with V2 label naming:
    - "Use videos in week avatars"
    - "Holo-Deck: animate task GIFs"
  The legacy arcade-font radio section was removed; V2 uses Space
  Grotesk + JetBrains Mono and there's nothing to pick.
-->
<template>
  <!--
    Clip layer: fixed, full-viewport, overflow hidden. The drawer slides
    in and out INSIDE this box, so its off-canvas translateX(110%) can
    never widen the page.
  -->
  <div class="drawer-root" :class="{ open: store.drawerOpen }">
    <!-- Overlay: click-to-dismiss scrim behind the drawer. Only mounts
         when the drawer is open so it can't trap clicks while closed. -->
    <div
      v-if="store.drawerOpen"
      class="drawer-overlay"
      @click="close"
    ></div>

    <aside
      :class="['settings-drawer', { open: store.drawerOpen }]"
      :aria-hidden="!store.drawerOpen"
      :inert="!store.drawerOpen ? true : undefined"
      :style="store.drawerOpen ? null : { visibility: 'hidden' }"
    >
      <header class="drawer-header">
        <span class="drawer-title">SETTINGS</span>
        <button
          type="button"
          class="drawer-close font-mono"
          aria-label="Close settings"
          @click="close"
        >✕</button>
      </header>

      <div class="drawer-content">
        <div class="setting-row">
          <span class="setting-label">USE VIDEOS IN WEEK AVATARS</span>
          <input
            type="checkbox"
            class="setting-toggle"
            :checked="store.useWeekVideos"
            @change="onToggleVideos($event)"
            :aria-label="'Use videos in week avatars'"
          />
        </div>

        <div class="setting-row">
          <span class="setting-label">HOLO-DECK: ANIMATE TASK GIFS</span>
          <input
            id="animate-gifs"
            type="checkbox"
            class="setting-toggle"
            :checked="store.animateGifs"
            @change="store.setAnimateGifs(($event.target as HTMLInputElement).checked)"
            aria-label="Holo-Deck: animate task GIFs"
          />
        </div>
      </div>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { useSettingsStore } from "../stores/settingsStore";

const store = useSettingsStore();

function close() {
  store.toggleDrawer(false);
}

function onToggleVideos(e: Event) {
  const checked = (e.target as HTMLInputElement).checked;
  store.setUseWeekVideos(checked);
}
</script>

<style scoped>
.drawer-root {
  position: fixed;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  z-index: 60;
}

.drawer-overlay {
  position: absolute;
  inset: 0;
  background: rgba(9, 11, 16, 0.45);
  pointer-events: auto;
}

/*
  Drawer chrome:
    - >= lg: 320 px right-anchored sheet, slides in from translateX(110%).
    - <  sm: full-width sheet anchored to the right edge.
*/
.settings-drawer {
  position: absolute;
  top: 0;
  right: 0;
  height: 100%;
  width: 100%;
  max-width: 320px;
  overflow-y: auto;
  pointer-events: auto;
  background: var(--pp-panel);
  border-left: 1px solid var(--pp-line);
  transform: translateX(110%);
  transition: transform 220ms ease;
  color: var(--pp-text);
  padding: 1rem;
  font-family: "JetBrains Mono", ui-monospace, monospace;
}

.settings-drawer.open {
  transform: translateX(0%);
}

.drawer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 0.75rem;
  margin-bottom: 0.5rem;
  border-bottom: 1px solid var(--pp-line);
}

.drawer-title {
  font-family: "Space Grotesk", system-ui, sans-serif;
  font-weight: 700;
  font-size: 0.9rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--pp-cyan);
}

.drawer-close {
  background: transparent;
  border: 1px solid var(--pp-line);
  color: var(--pp-muted);
  font-size: 0.85rem;
  width: 32px;
  height: 32px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: color 0.15s ease, border-color 0.15s ease;
}

.drawer-close:hover,
.drawer-close:focus-visible {
  color: var(--pp-cyan);
  border-color: var(--pp-cyan);
  outline: none;
}

.drawer-content {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.setting-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem 0;
  border-bottom: 1px solid var(--pp-line);
}

.setting-row:last-child {
  border-bottom: 0;
}

.setting-label {
  font-size: 0.7rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--pp-text);
  font-weight: 700;
}

.setting-toggle {
  width: 1.1rem;
  height: 1.1rem;
  accent-color: var(--pp-cyan);
  flex-shrink: 0;
}

@media (max-width: 639.98px) {
  .settings-drawer {
    max-width: none;
    width: 100%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .settings-drawer {
    transition: none;
  }
}
</style>