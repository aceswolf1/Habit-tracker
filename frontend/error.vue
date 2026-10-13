<!--
  error.vue (W1 restyle, V2 Combat Deck).

  Catch-all page rendered by Nuxt for any error status (404 by default
  on `/does-not-exist` etc.). Sharp 1 px `--pp-line` border, mono body,
  cyan title. No legacy arcade fonts.

  API 404s are unaffected: the catch-all is a Nuxt route rule, it
  matches only HTML page navigations. `/api/**` paths still get the
  JSON envelope from Nitro.
-->
<template>
  <div class="error-shell">
    <div class="error-panel">
      <h1 class="error-title">
        ERROR {{ error?.statusCode || 404 }}
      </h1>
      <p class="error-message">
        {{ message }}
      </p>
      <div class="error-actions">
        <button
          type="button"
          class="error-btn"
          @click="goHome"
        >
          BACK TO QUESTS
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { clearError } from "#app";

const props = defineProps<{
  error: { statusCode?: number; statusMessage?: string; message?: string } | null;
}>();

const message = computed(() => {
  const status = props.error?.statusCode ?? 404;
  if (status === 404) {
    return "This dungeon does not exist.";
  }
  return props.error?.statusMessage || props.error?.message || "Something went wrong.";
});

function goHome() {
  clearError({ redirect: "/" });
}
</script>

<style scoped>
.error-shell {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--pp-void);
  padding: 1.5rem;
  font-family: "JetBrains Mono", ui-monospace, monospace;
  color: var(--pp-text);
}

.error-panel {
  background: var(--pp-panel);
  border: 1px solid var(--pp-line);
  padding: 2rem;
  max-width: 32rem;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 1rem;
}

.error-title {
  font-family: "Space Grotesk", system-ui, sans-serif;
  font-weight: 700;
  font-size: 1.25rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--pp-cyan);
  text-align: center;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--pp-line);
  margin: 0;
}

.error-message {
  font-size: 0.85rem;
  line-height: 1.5;
  color: var(--pp-muted);
  text-align: center;
  margin: 0;
}

.error-actions {
  display: flex;
  justify-content: center;
  margin-top: 0.5rem;
}

.error-btn {
  font-family: "JetBrains Mono", ui-monospace, monospace;
  font-weight: 700;
  font-size: 0.75rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  background: var(--pp-cyan);
  color: var(--pp-void);
  border: 1px solid var(--pp-cyan);
  padding: 0.7rem 1.2rem;
  cursor: pointer;
  min-height: 40px;
  min-width: 12rem;
  transition: background-color 0.15s ease, box-shadow 0.15s ease;
}

.error-btn:hover,
.error-btn:focus-visible {
  background: rgb(var(--pp-cyan-rgb) / 0.85);
  outline: none;
  box-shadow: 0 0 0 2px var(--pp-cyan);
}
</style>