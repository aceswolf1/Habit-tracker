<template>
  <div>
    <!-- Overlay -->
    <div
      v-if="store.drawerOpen"
      class="drawer-overlay"
      @click="close"
    ></div>

    <!-- Drawer -->
    <aside :class="['settings-drawer', { open: store.drawerOpen }]">
      <div class="drawer-header">
        <div class="drawer-title">Settings</div>
        <button class="close-btn" @click="close">✖</button>
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
.drawer-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 50;
}

.settings-drawer {
  position: fixed;
  top: 0;
  right: 0;
  height: 100vh;
  width: 320px;
  background: #0b1220;
  border-left: 3px solid black;
  transform: translateX(110%);
  transition: transform 300ms ease;
  z-index: 60;
  color: white;
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
.close-btn { background: transparent; border: none; color:white; font-size: 1rem; cursor: pointer }

.drawer-content { margin-top: 8px }
.setting-row { display:flex; justify-content:space-between; align-items:center; padding: 0.5rem 0 }
.setting-label { font-size: 0.8rem }
</style>
