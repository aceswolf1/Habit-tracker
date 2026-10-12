<template>
  <!--
    Clip layer: fixed, full-viewport, overflow hidden. The drawer slides
    in and out INSIDE this box, so its off-canvas translateX(110%) can never
    widen the page (a `filter`/`transform` on an ancestor such as `body`
    turns `position: fixed` into ancestor-relative positioning, which made
    the closed drawer add horizontal scroll on phones/tablets).
    pointer-events: none so the layer never blocks clicks; the overlay and
    the drawer opt back in.
  -->
  <div class="drawer-root" :class="{ open: store.drawerOpen }">
    <!--
      Overlay: click-to-dismiss scrim behind the drawer. Only mounts when
      the drawer is open so it can't trap clicks while closed.
    -->
    <div
      v-if="store.drawerOpen"
      class="drawer-overlay"
      @click="close"
    ></div>

    <!--
      Drawer:
        - closed: visibility: hidden + inert + aria-hidden so it can't be
          tabbed into and headless screenshots don't include it.
        - open (>= lg): right-side sheet, 320 px wide.
        - open (<  sm): full-width bottom sheet pinned to the viewport.
    -->
    <aside
      :class="['settings-drawer', { open: store.drawerOpen }]"
      :aria-hidden="!store.drawerOpen"
      :inert="!store.drawerOpen ? true : undefined"
      :style="store.drawerOpen ? null : { visibility: 'hidden' }"
    >
      <div class="drawer-header">
        <div class="drawer-title">Settings</div>
        <button class="close-btn pp-tap" @click="close">✖</button>
      </div>

      <div class="drawer-content">
        <div class="setting-row">
          <label class="setting-label">Use videos in week avatars</label>
          <input
            type="checkbox"
            :checked="store.useWeekVideos"
            @change="onToggleVideos($event)"
          />
        </div>

        <div class="setting-row">
          <label class="setting-label" for="animate-gifs">Animate task GIFs</label>
          <input
            id="animate-gifs"
            type="checkbox"
            :checked="store.animateGifs"
            @change="store.setAnimateGifs(($event.target as HTMLInputElement).checked)"
          />
        </div>

        <div class="setting-row" style="margin-top:0.75rem; flex-direction:column; align-items:flex-start; gap:0.5rem;">
          <div class="setting-label">UI Font</div>
          <div style="display:flex; gap:0.5rem; align-items:center;">
            <label style="display:flex; gap:0.25rem; align-items:center;">
              <input type="radio" name="uiFont" value="press" :checked="store.uiFont === 'press'" @change="onSetUiFont('press')" />
              <span style="margin-left:0.25rem">Classic (Press Start)</span>
            </label>
            <label style="display:flex; gap:0.25rem; align-items:center;">
              <input type="radio" name="uiFont" value="cyber" :checked="store.uiFont === 'cyber'" @change="onSetUiFont('cyber')" />
              <span style="margin-left:0.25rem">Cyberpunk (Orbitron)</span>
            </label>
          </div>
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

function onSetUiFont(choice: string) {
  // Defensive: ensure method exists, otherwise set directly
  if (typeof (store as any).setUiFont === 'function') {
    (store as any).setUiFont(choice);
  } else {
    (store as any).uiFont = choice;
    if (typeof window !== 'undefined') localStorage.setItem('uiFont', choice);
  }
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
  background: rgba(0, 0, 0, 0.45);
  pointer-events: auto;
}

/*
  Drawer chrome:
    - >= lg: 320 px right-anchored sheet, slides in from translateX(110%).
    - <  sm: full-width sheet anchored to the right edge; identical
      off-canvas hide via translateX(110%) so the closed state is never
      tabbable / painted (visibility: hidden + inert set inline).
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
  background: var(--pp-bg-deep);
  border-left: 3px solid var(--pp-black);
  transform: translateX(110%);
  transition: transform 300ms ease;
  color: var(--pp-text);
  padding: 1rem;
  box-shadow: -8px 0 24px rgba(0,0,0,0.6);
}

.settings-drawer.open {
  transform: translateX(0%);
}

.drawer-header {
  display:flex;
  justify-content:space-between;
  align-items:center;
  margin-bottom: 1rem;
}

.drawer-title { font-family: 'Press Start 2P', cursive; }
.close-btn { background: transparent; border: none; color: var(--pp-text); font-size: 1rem; cursor: pointer }

.drawer-content { margin-top: 8px }
.setting-row { display:flex; justify-content:space-between; align-items:center; padding: 0.5rem 0 }
.setting-label { font-size: 0.8rem }

@media (max-width: 639px) {
  /*
    Phone: full-width sheet. On phones (< 640 px) we lift the 320 px
    max-width cap so the drawer fills the viewport — matches the contract:
    "on phones it opens as a full-width sheet".
  */
  .settings-drawer {
    max-width: none;
    width: 100%;
  }
}
</style>