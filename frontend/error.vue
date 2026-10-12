<!--
  error.vue (W4b, B-T4).
  Catch-all page rendered by Nuxt for any error status (404 by default
  on `/does-not-exist` etc.). UI is in the same pixel-arcade style as
  the rest of the app. Reuses the `bg-pixel-*` Tailwind tokens that
  themselves map to the `--pp-*` CSS variables in
  `assets/css/tokens.css`.
  API 404s are unaffected: the catch-all is a Nuxt route rule, it
  matches only HTML page navigations. `/api/**` paths still get the
  JSON envelope from Nitro.
-->
<template>
  <div class="min-h-screen flex items-center justify-center bg-pixel-deepest p-6">
    <div class="bg-pixel-panel border-4 border-black p-8 max-w-md w-full shadow-pixel">
      <h1 class="font-press text-white text-base text-center mb-6 border-b-4 border-black pb-4">
        ERROR {{ error?.statusCode || 404 }}
      </h1>
      <p class="font-press text-white text-xs text-center mb-6 leading-relaxed">
        {{ message }}
      </p>
      <div class="flex justify-center">
        <button
          class="font-press text-xs px-6 py-3 bg-blue-600 border-2 border-black text-white hover:bg-blue-500 hover:scale-105 transition-all shadow-[4px_4px_0_rgba(0,0,0,0.5)] active:shadow-none active:translate-x-[2px] active:translate-y-[2px]"
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
.bg-pixel-deepest {
  background-color: var(--pp-bg-deepest, #05080e);
}
.bg-pixel-panel {
  background-color: var(--pp-bg-panel, #1f2937);
}
.font-press {
  font-family: "Press Start 2P", cursive;
}
.shadow-pixel {
  box-shadow: 4px 4px 0 rgba(0, 0, 0, 0.8);
}
</style>
