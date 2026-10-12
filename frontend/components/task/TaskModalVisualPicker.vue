<!--
  TaskModalVisualPicker.vue (W4 split, UB-55).

  Owns the "VISUAL TYPE" radio + the emoji-mart popover + the GIF search
  panel. Three v-models live here: `visualType`, `icon` (emoji), and
  `gifUrl`. The parent TaskModal keeps the source-of-truth form and just
  syncs three fields back/forth.

  All GIF-search state (`gifSearchQuery`, debounce, `gifResults`,
  `isLoadingGifs`) and the auto-suggest watches on `description`/`visualType`
  live here too — none of it leaks back into TaskModal.
-->
<template>
  <div class="mb-5">
    <div class="text-white font-press text-xs mb-2">VISUAL TYPE</div>
    <div class="flex gap-4 text-[10px] font-press mb-3">
      <label
        class="flex items-center gap-2 text-white cursor-pointer hover:text-yellow-400 transition-colors"
      >
        <input type="radio" value="emoji" v-model="visualTypeLocal" />
        Emoji
      </label>
      <label
        class="flex items-center gap-2 text-white cursor-pointer hover:text-yellow-400 transition-colors"
      >
        <input type="radio" value="gif" v-model="visualTypeLocal" />
        GIF
      </label>
    </div>

    <!-- Emoji Picker -->
    <div v-if="visualType === 'emoji'">
      <div class="flex items-center gap-3">
        <button
          type="button"
          @click="showEmojiPicker = !showEmojiPicker"
          class="px-3 py-2 border-2 border-black bg-gray-700 hover:bg-gray-600 text-white font-press text-xs transition-colors"
        >
          {{ icon || "SELECT EMOJI" }}
        </button>
        <span v-if="icon" class="text-white text-xl animate-bounce">{{ icon }}</span>
        <button
          v-if="icon"
          type="button"
          @click="iconLocal = ''"
          class="px-2 py-1 border-2 border-black bg-red-600 hover:bg-red-500 text-white font-press text-[10px] transition-colors"
        >
          CLEAR
        </button>
      </div>
      <div
        v-if="showEmojiPicker"
        class="mt-2 border-2 border-black bg-gray-800 p-2 max-h-60 overflow-y-auto absolute z-10 shadow-xl"
      >
        <div v-if="isClient">
          <div ref="pickerRef"></div>
        </div>
        <div v-else class="text-[10px] font-press text-gray-400">Loading...</div>
      </div>
    </div>

    <!-- GIF Picker -->
    <div v-if="visualType === 'gif'" class="space-y-3">
      <input
        v-model.trim="gifSearchQuery"
        @input="onGifSearchInput"
        class="w-full bg-gray-800 text-white p-2 border-2 border-black font-mono text-xs focus:outline-none focus:border-blue-500 transition-colors"
        placeholder="Search for a GIF..."
      />

      <div
        v-if="isLoadingGifs"
        class="text-center text-white font-press text-[10px] py-4"
      >
        LOADING GIFS...
      </div>

      <div
        v-else-if="gifResults.length > 0"
        class="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto border-2 border-black bg-gray-900 p-2"
      >
        <button
          v-for="gif in gifResults"
          :key="gif.id"
          type="button"
          @click="selectGif(gif)"
          :class="[
            'border-2 transition-all overflow-hidden aspect-square',
            gifUrl && gifUrl === getGifUrl(gif)
              ? 'border-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.5)]'
              : 'border-gray-700 hover:border-blue-500',
          ]"
        >
          <img
            :src="getGifUrl(gif)"
            :alt="gif.title"
            class="w-full h-full object-cover"
            loading="lazy"
          />
        </button>
      </div>

      <div
        v-else-if="gifSearchQuery"
        class="text-center text-gray-400 font-press text-[10px] py-4"
      >
        NO GIFS FOUND
      </div>

      <div v-if="gifUrl" class="flex items-center gap-2">
        <img
          :src="gifUrl"
          alt="Selected GIF"
          class="w-16 h-16 object-cover border-2 border-yellow-500"
        />
        <button
          type="button"
          @click="clearGif"
          class="px-2 py-1 border-2 border-black bg-red-600 hover:bg-red-500 text-white font-press text-[10px] transition-colors"
        >
          CLEAR GIF
        </button>
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
  type KlipyGif,
} from "../../utils/klipyApi";

/** v-model surface: parent holds the source-of-truth form. */
const props = defineProps<{
  visualType: "emoji" | "gif";
  icon: string;
  gifUrl: string;
  /** Description used for the auto-suggest watcher. */
  description: string;
}>();

const emit = defineEmits<{
  "update:visualType": [value: "emoji" | "gif"];
  "update:icon": [value: string];
  "update:gifUrl": [value: string];
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
  gifUrlLocal.value = getGifUrlUtil(gif, "sm");
  iconLocal.value = ""; // Clear emoji when GIF is selected
}

function clearGif() {
  gifUrlLocal.value = "";
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
