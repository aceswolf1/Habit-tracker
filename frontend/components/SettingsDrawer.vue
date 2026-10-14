<!--
  SettingsDrawer.vue (V2 Combat Deck + v2.1 W3 additions).

  Right-side settings sheet, ≤ lg becomes a full-width sheet pinned to
  the viewport edge. Settable items:
    - "Display name"          (v2.1 W3 — save on blur/Enter; 1..24 chars)
    - "Use videos in week avatars"
    - "Holo-Deck: animate task GIFs"
    - "Sound FX"              (v2.1 W3 — localStorage `soundFx`, default off)

  The legacy arcade-font radio section was removed; V2 uses Space
  Grotesk + JetBrains Mono and there's nothing to pick.
-->
<template>
  <div class="drawer-root" :class="{ open: store.drawerOpen }">
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
        <!-- v2.1 (W3): display name. Save on blur OR Enter; empty
             string clears the field (we send `null` server-side).
             1..24 chars; the html `maxlength` enforces the cap. -->
        <div class="setting-row setting-row--column">
          <span class="setting-label">DISPLAY NAME</span>
          <input
            v-model="nameDraft"
            type="text"
            class="setting-input font-mono"
            maxlength="24"
            autocomplete="off"
            spellcheck="false"
            placeholder="LEAVE BLANK TO RESET"
            aria-label="Player display name"
            data-pp-display-name-input
            @keydown.enter="commitName"
            @blur="commitName"
            @input="onNameInput"
          />
          <span
            v-if="nameError"
            class="setting-error"
            role="alert"
            data-pp-display-name-error
          >{{ nameError }}</span>
          <span
            v-else-if="savedTick"
            class="setting-saved"
            data-pp-display-name-saved
          >SAVED</span>
        </div>

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

        <!-- v2.1 (W3): sound FX toggle. -->
        <div class="setting-row">
          <span class="setting-label">SOUND FX</span>
          <input
            id="sound-fx"
            type="checkbox"
            class="setting-toggle"
            :checked="store.soundFx"
            @change="store.setSoundFx(($event.target as HTMLInputElement).checked)"
            aria-label="Sound FX"
            data-pp-sound-fx-toggle
          />
        </div>
      </div>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, computed } from "vue";
import { storeToRefs } from "pinia";
import { useSettingsStore } from "../stores/settingsStore";
import { useMonthStore } from "../stores/monthStore";
import { emitAppEvent } from "../composables/useAppEvents";

const store = useSettingsStore();
const monthStore = useMonthStore();
const storeRefs = storeToRefs(monthStore as any);

/* v2.1 (W3): local draft so we can show "SAVED" + validate before
   committing. The store / BE write happens on blur or Enter. */
const nameDraft = ref<string>("");
const savedTick = ref<number>(0);
const nameError = ref<string | null>(null);
let lastSaved: string | null = null;

const remoteDisplayName = computed<string>(() => {
  const dn = storeRefs.profile?.value?.displayName;
  return typeof dn === "string" ? dn : "";
});

// Seed the input when the drawer opens or the remote value changes
// (e.g. another tab patched the profile).
watch(
  () => [store.drawerOpen, remoteDisplayName.value] as const,
  ([open]) => {
    if (!open) return;
    nameDraft.value = remoteDisplayName.value || "";
    lastSaved = remoteDisplayName.value || null;
    savedTick.value = 0;
    nameError.value = null;
    nextTick(() => {
      // no-op for now — keeps the focus restoration hook available.
    });
  },
  { immediate: true },
);

function onNameInput() {
  if (nameError.value) nameError.value = null;
  savedTick.value = 0;
}

async function commitName() {
  const next = nameDraft.value.trim();
  if (nameError.value) nameError.value = null;
  // Empty → send null. Whitespace-only also clears.
  if (next.length > 24) {
    nameError.value = "Max 24 characters.";
    return;
  }
  if (next === (lastSaved ?? "")) {
    return; // no-op
  }
  const payload = next.length === 0 ? null : next;
  try {
    if (typeof (monthStore as any).updateDisplayName === "function") {
      await (monthStore as any).updateDisplayName(payload);
    } else {
      // W1 hasn't shipped `updateDisplayName` yet. Surface a soft
      // error so the user knows their edit isn't persisting yet.
      throw new Error("Display name not yet wired (waiting for W1 data layer).");
    }
    lastSaved = next;
    savedTick.value = Date.now();
    emitAppEvent("toast", {
      type: "info",
      title: "OPERATIVE UPDATED",
      message:
        payload == null
          ? "Display name cleared — you'll be called PALADIN."
          : `Operator is now ${payload.toUpperCase()}.`,
    });
  } catch (err) {
    nameError.value = err instanceof Error ? err.message : "Save failed.";
    emitAppEvent("toast", {
      type: "error",
      title: "SAVE FAILED",
      message: nameError.value ?? "Could not save display name.",
    });
  }
}

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

.setting-row--column {
  flex-direction: column;
  align-items: stretch;
  gap: 0.4rem;
}

.setting-label {
  font-size: 0.7rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--pp-text);
  font-weight: 700;
}

.setting-input {
  background: var(--pp-card);
  color: var(--pp-text);
  border: 1px solid var(--pp-line);
  padding: 0.45rem 0.5rem;
  font-size: 0.85rem;
  letter-spacing: 0.04em;
  outline: none;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}
.setting-input:focus,
.setting-input:focus-visible {
  border-color: var(--pp-cyan);
  background: var(--pp-card-active);
}

.setting-error {
  font-size: 0.7rem;
  color: var(--pp-danger);
}

.setting-saved {
  font-size: 0.7rem;
  color: var(--pp-green);
  letter-spacing: 0.1em;
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