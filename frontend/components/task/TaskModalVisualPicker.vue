<!--
  TaskModalVisualPicker.vue (W1 restyle, V2 Combat Deck).

  Owns the "VISUAL TYPE" radio + the emoji-mart popover + the GIF search
  panel. Three v-models live here: `visualType`, `icon` (emoji), and
  `gifUrl`. The parent TaskModal keeps the source-of-truth form and just
  syncs three fields back/forth.

  V2 styling: cyan title, sharp 1px borders, mono body, cyan focus ring.
  No legacy arcade font, no animated glows.
-->
<template>
  <div class="vpicker">
    <div class="vpicker-label">VISUAL TYPE</div>
    <div class="vpicker-types font-mono">
      <label class="vpicker-type">
        <input
          type="radio"
          value="emoji"
          v-model="visualTypeLocal"
        />
        <span>EMOJI</span>
      </label>
      <label class="vpicker-type">
        <input
          type="radio"
          value="gif"
          v-model="visualTypeLocal"
        />
        <span>GIF</span>
      </label>
    </div>

    <!-- Emoji Picker -->
    <div v-if="visualType === 'emoji'" class="vpicker-emoji">
      <div class="vpicker-emoji-row">
        <button
          type="button"
          class="vpicker-emoji-toggle"
          @click="showEmojiPicker = !showEmojiPicker"
        >
          {{ icon || "SELECT EMOJI" }}
        </button>
        <span v-if="icon" class="vpicker-emoji-preview">{{ icon }}</span>
        <button
          v-if="icon"
          type="button"
          class="vpicker-clear"
          @click="iconLocal = ''"
        >CLEAR</button>
      </div>
      <div
        v-if="showEmojiPicker"
        class="vpicker-popover"
      >
        <div v-if="isClient">
          <div ref="pickerRef"></div>
        </div>
        <div v-else class="vpicker-loading font-mono">LOADING…</div>
      </div>
    </div>

    <!-- GIF Picker -->
    <div v-if="visualType === 'gif'" class="vpicker-gif">
      <input
        v-model.trim="gifSearchQuery"
        @input="onGifSearchInput"
        class="vpicker-input font-mono"
        placeholder="Search for a GIF…"
        type="text"
      />

      <div
        v-if="isLoadingGifs"
        class="vpicker-loading font-mono"
      >LOADING GIFS…</div>

      <div
        v-else-if="gifResults.length > 0"
        class="vpicker-grid"
      >
        <button
          v-for="gif in gifResults"
          :key="gif.id"
          type="button"
          class="vpicker-grid-tile"
          :class="gifUrl && gifUrl === getGifUrl(gif) ? 'vpicker-grid-tile--selected' : ''"
          @click="selectGif(gif)"
        >
          <img
            :src="getGifPreviewUrl(gif)"
            :alt="gif.title"
            loading="lazy"
            decoding="async"
            class="vpicker-grid-thumb"
          />
        </button>
      </div>

      <div
        v-else-if="gifSearchQuery"
        class="vpicker-loading font-mono"
      >NO GIFS FOUND</div>

      <div v-if="gifUrl" class="vpicker-selected">
        <img
          :src="gifStillUrl || gifUrl"
          alt="Selected GIF"
          class="vpicker-selected-thumb"
        />
        <button
          type="button"
          class="vpicker-clear"
          @click="clearGif"
        >CLEAR GIF</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import data from "@emoji-mart/data";
import {
  searchGifs,
  getGifUrl as getGifUrlUtil,
  getGifSources,
  getGifPreviewUrl,
  type KlipyGif,
} from "../../utils/klipyApi";

/** v-model surface: parent holds the source-of-truth form. */
const props = defineProps<{
  visualType: "emoji" | "gif";
  icon: string;
  gifUrl: string;
  /** W5: MP4 + JPG renditions travel with gifUrl. */
  gifVideoUrl: string;
  gifStillUrl: string;
  /** Description used for the auto-suggest watcher. */
  description: string;
}>();

const emit = defineEmits<{
  "update:visualType": [value: "emoji" | "gif"];
  "update:icon": [value: string];
  "update:gifUrl": [value: string];
  "update:gifVideoUrl": [value: string];
  "update:gifStillUrl": [value: string];
}>();

const visualTypeLocal = computed({
  get: () => props.visualType,
  set: (v) => emit("update:visualType", v),
});
const iconLocal = computed({
  get: () => props.icon,
  set: (v) => emit("update:icon", v),
});
const gifUrlLocal = computed({
  get: () => props.gifUrl,
  set: (v) => emit("update:gifUrl", v),
});

// ---------- Emoji picker ----------
const pickerRef = ref<HTMLElement | null>(null);
const showEmojiPicker = ref(false);
const isClient = ref(false);
onMounted(() => {
  isClient.value = true;
});

watch(showEmojiPicker, async (val) => {
  if (val) {
    await nextTick();
    if (pickerRef.value) {
      const { Picker } = await import("emoji-mart");
      const picker = new Picker({
        data,
        onEmojiSelect: (emoji: any) => {
          iconLocal.value = emoji.native || emoji.id || "";
          showEmojiPicker.value = false;
        },
        previewPosition: "none",
        skinTonePosition: "none",
        theme: "dark",
        set: "native",
      });
      pickerRef.value.innerHTML = "";
      pickerRef.value.appendChild(picker as any);
    }
  }
});

// ---------- GIF picker ----------
const gifSearchQuery = ref("");
const gifResults = ref<KlipyGif[]>([]);
const isLoadingGifs = ref(false);
let gifSearchTimeout: ReturnType<typeof setTimeout> | null = null;

function getGifUrl(gif: KlipyGif): string {
  return getGifUrlUtil(gif, "sm");
}

function selectGif(gif: KlipyGif) {
  const src = getGifSources(gif, "sm");
  gifUrlLocal.value = src.gif;
  emit("update:gifVideoUrl", src.video);
  emit("update:gifStillUrl", src.still);
  iconLocal.value = ""; // Clear emoji when GIF is selected
}

function clearGif() {
  gifUrlLocal.value = "";
  emit("update:gifVideoUrl", "");
  emit("update:gifStillUrl", "");
}

async function performGifSearch(query: string) {
  if (!query.trim()) {
    gifResults.value = [];
    return;
  }
  isLoadingGifs.value = true;
  try {
    const response = await searchGifs(query, 1, 24);
    if (response.result && response.data?.data) {
      gifResults.value = response.data.data;
    } else {
      gifResults.value = [];
    }
  } catch (error) {
    console.error("Failed to search GIFs:", error);
    gifResults.value = [];
  } finally {
    isLoadingGifs.value = false;
  }
}

function onGifSearchInput() {
  if (gifSearchTimeout) clearTimeout(gifSearchTimeout);
  gifSearchTimeout = setTimeout(() => {
    performGifSearch(gifSearchQuery.value);
  }, 500);
}

// Auto-suggest GIFs when the description changes (and we're on the GIF tab)
watch(() => props.description, (newDesc) => {
  if (
    props.visualType === "gif" &&
    newDesc &&
    !props.gifUrl &&
    !gifSearchQuery.value
  ) {
    gifSearchQuery.value = newDesc;
    performGifSearch(newDesc);
  }
});

watch(() => props.visualType, (newType) => {
  if (newType === "gif" && props.description && !props.gifUrl) {
    gifSearchQuery.value = props.description;
    performGifSearch(props.description);
  } else if (newType === "emoji") {
    // Clear GIF when switching to emoji
    gifUrlLocal.value = "";
  }
});
</script>

<style scoped src="./TaskModalVisualPicker.styles.scss"></style>