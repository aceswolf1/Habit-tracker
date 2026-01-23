<template>
  <Transition name="modal-bounce">
    <div v-if="open" class="fixed inset-0 flex items-center justify-center z-50">
      <div class="absolute inset-0 bg-black/70 backdrop-blur-sm" @click="close"></div>
      <div
        class="relative bg-pixel-dark border-4 border-black p-6 w-full max-w-lg shadow-pixel transform transition-all"
      >
        <h2 class="font-press text-white text-base mb-6 text-center border-b-4 border-black pb-4">
          {{ isEdit ? "EDIT QUEST" : "NEW QUEST" }}
        </h2>

        <form @submit.prevent="submit">
          <!-- Description -->
          <label
            class="block mb-5 text-white font-press text-xs tracking-wide"
            >DESCRIPTION
            <input
              v-model.trim="form.description"
              class="mt-2 w-full bg-gray-800 text-white p-3 border-2 border-black font-mono text-sm focus:outline-none focus:border-blue-500 transition-colors"
              placeholder="Enter quest details..."
              required
              autoFocus
            />
          </label>

          <!-- Icon Type Selector -->
          <div class="mb-5">
            <div class="text-white font-press text-xs mb-2">VISUAL TYPE</div>
            <div class="flex gap-4 text-[10px] font-press mb-3">
              <label class="flex items-center gap-2 text-white cursor-pointer hover:text-yellow-400 transition-colors">
                <input type="radio" value="emoji" v-model="form.visualType" />
                Emoji
              </label>
              <label class="flex items-center gap-2 text-white cursor-pointer hover:text-yellow-400 transition-colors">
                <input type="radio" value="gif" v-model="form.visualType" />
                GIF
              </label>
            </div>

            <!-- Emoji Picker -->
            <div v-if="form.visualType === 'emoji'">
              <div class="flex items-center gap-3">
                <button
                  type="button"
                  @click="showEmojiPicker = !showEmojiPicker"
                  class="px-3 py-2 border-2 border-black bg-gray-700 hover:bg-gray-600 text-white font-press text-xs transition-colors"
                >
                  {{ form.icon || "SELECT EMOJI" }}
                </button>
                <span v-if="form.icon" class="text-white text-xl animate-bounce"
                  >{{ form.icon }}</span
                >
                <button
                  v-if="form.icon"
                  type="button"
                  @click="form.icon = ''"
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
                <div v-else class="text-[10px] font-press text-gray-400">
                  Loading...
                </div>
              </div>
            </div>

            <!-- GIF Picker -->
            <div v-if="form.visualType === 'gif'" class="space-y-3">
              <input
                v-model.trim="gifSearchQuery"
                @input="onGifSearchInput"
                class="w-full bg-gray-800 text-white p-2 border-2 border-black font-mono text-xs focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="Search for a GIF..."
              />

              <div v-if="isLoadingGifs" class="text-center text-white font-press text-[10px] py-4">
                LOADING GIFS...
              </div>

              <div v-else-if="gifResults.length > 0" class="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto border-2 border-black bg-gray-900 p-2">
                <button
                  v-for="gif in gifResults"
                  :key="gif.id"
                  type="button"
                  @click="selectGif(gif)"
                  :class="[
                    'border-2 transition-all overflow-hidden aspect-square',
                    form.gifUrl && form.gifUrl === getGifUrl(gif)
                      ? 'border-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.5)]'
                      : 'border-gray-700 hover:border-blue-500'
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

              <div v-else-if="gifSearchQuery" class="text-center text-gray-400 font-press text-[10px] py-4">
                NO GIFS FOUND
              </div>

              <div v-if="form.gifUrl" class="flex items-center gap-2">
                <img :src="form.gifUrl" alt="Selected GIF" class="w-16 h-16 object-cover border-2 border-yellow-500" />
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

          <!-- Optional Flag -->
          <label
            class="flex items-center gap-3 mb-5 text-white font-press text-xs cursor-pointer group"
          >
            <div class="relative">
              <input type="checkbox" v-model="form.optional" class="peer sr-only" />
              <div class="w-5 h-5 border-2 border-white bg-gray-800 peer-checked:bg-blue-500 transition-colors"></div>
              <div class="absolute inset-0 flex items-center justify-center text-white opacity-0 peer-checked:opacity-100 pointer-events-none">✓</div>
            </div>
            <span class="group-hover:text-blue-400 transition-colors">OPTIONAL SIDE QUEST</span>
          </label>

          <!-- Scope inside week -->
          <div class="mb-5">
            <div class="text-white font-press text-xs mb-2">
              APPLY TO (THIS WEEK)
            </div>
            <div class="flex flex-wrap gap-4 text-[10px] font-press mb-3">
              <label class="flex items-center gap-2 text-white cursor-pointer hover:text-yellow-400 transition-colors">
                <input type="radio" value="single" v-model="form.weekScope" />
                Single Day
              </label>
              <label class="flex items-center gap-2 text-white cursor-pointer hover:text-yellow-400 transition-colors">
                <input type="radio" value="multiple" v-model="form.weekScope" />
                Selected Days
              </label>
              <label class="flex items-center gap-2 text-white cursor-pointer hover:text-yellow-400 transition-colors">
                <input type="radio" value="all" v-model="form.weekScope" /> All
                Days
              </label>
            </div>
            <!-- Day selectors -->
            <div
              v-if="showDaySelector"
              class="mt-2 grid grid-cols-7 gap-1"
            >
              <button
                v-for="d in weekDays"
                :key="d.uuid"
                type="button"
                @click="toggleDay(d.uuid)"
                :class="[
                  'border-2 border-black text-[10px] font-press py-2 transition-all transform hover:scale-105',
                  selectedDayUuids.includes(d.uuid)
                    ? 'bg-yellow-500 text-black shadow-[2px_2px_0_rgba(0,0,0,0.5)] translate-x-[-1px] translate-y-[-1px]'
                    : 'bg-gray-700 text-white hover:bg-gray-600',
                ]"
              >
                {{ d.short }}
              </button>
            </div>
          </div>

          <!-- Recurrence across weeks -->
          <div class="mb-5 p-3 border-2 border-dashed border-gray-600 bg-gray-800/50">
            <label
              class="flex items-center gap-2 text-white font-press text-[10px] mb-2 cursor-pointer"
            >
              <input type="checkbox" v-model="form.repeatAcrossWeeks" /> REPEAT IN
              OTHER WEEKS
            </label>
            <div v-if="form.repeatAcrossWeeks" class="space-y-2 mt-2">
              <div class="flex flex-wrap gap-2 text-[10px] font-press">
                <button
                  type="button"
                  @click="selectAllWeeks"
                  class="px-2 py-1 border-2 border-black bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                >
                  All Weeks
                </button>
                <button
                  type="button"
                  @click="clearWeeks"
                  class="px-2 py-1 border-2 border-black bg-gray-600 hover:bg-gray-500 text-white transition-colors"
                >
                  Clear
                </button>
              </div>
              <div class="flex flex-wrap gap-2 mt-2">
                <button
                  v-for="w in otherWeeks"
                  :key="w.uuid"
                  type="button"
                  @click="toggleWeek(w.uuid)"
                  :class="[
                    'px-2 py-1 border-2 border-black text-[10px] font-press transition-colors',
                    selectedWeekUuids.includes(w.uuid)
                      ? 'bg-yellow-500 text-black'
                      : 'bg-gray-700 text-white hover:bg-gray-600',
                  ]"
                >
                  {{ w.label }}
                </button>
              </div>
            </div>
          </div>

          <!-- Edit recurrence scope -->
          <div v-if="isEdit && hasRecurrence" class="mb-5">
            <div class="text-white font-press text-xs mb-2">EDIT SCOPE</div>
            <div class="flex flex-wrap gap-4 text-[10px] font-press">
              <label class="flex items-center gap-2 text-white cursor-pointer">
                <input type="radio" value="single" v-model="editScope" /> This
                Task Only
              </label>
              <label class="flex items-center gap-2 text-white cursor-pointer">
                <input type="radio" value="recurrence" v-model="editScope" /> All
                In Recurrence
              </label>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex justify-between mt-8 pt-4 border-t-4 border-black">
            <button
              type="button"
              @click="close"
              class="font-press text-xs px-4 py-3 bg-gray-600 border-2 border-black text-white hover:bg-gray-500 hover:scale-105 transition-all shadow-[4px_4px_0_rgba(0,0,0,0.5)] active:shadow-none active:translate-x-[2px] active:translate-y-[2px]"
            >
              CANCEL
            </button>
            <div class="flex gap-3">
              <button
                v-if="isEdit"
                type="button"
                @click="emitDelete"
                class="font-press text-xs px-4 py-3 bg-red-600 border-2 border-black text-white hover:bg-red-500 hover:scale-105 transition-all shadow-[4px_4px_0_rgba(0,0,0,0.5)] active:shadow-none active:translate-x-[2px] active:translate-y-[2px]"
              >
                DELETE
              </button>
              <button
                type="submit"
                class="font-press text-xs px-4 py-3 bg-blue-600 border-2 border-black text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-500 hover:scale-105 transition-all shadow-[4px_4px_0_rgba(0,0,0,0.5)] active:shadow-none active:translate-x-[2px] active:translate-y-[2px]"
                :disabled="isSubmitting"
              >
                {{ isEdit ? "SAVE QUEST" : "START QUEST" }}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import {
  computed,
  reactive,
  ref,
  watch,
  onMounted,
  nextTick,
} from "vue";
import { useMonthStore } from "../stores/monthStore";
import data from "@emoji-mart/data";
import { searchGifs, getTrendingGifs, getGifUrl as getGifUrlUtil, type KlipyGif } from "../utils/klipyApi";

const pickerRef = ref<HTMLElement | null>(null);

const showEmojiPicker = ref(false);
const emojiData = data;

// GIF search state
const gifSearchQuery = ref("");
const gifResults = ref<KlipyGif[]>([]);
const isLoadingGifs = ref(false);
let gifSearchTimeout: ReturnType<typeof setTimeout> | null = null;

watch(showEmojiPicker, async (val) => {
  if (val) {
    await nextTick();
    if (pickerRef.value) {
      const { Picker } = await import("emoji-mart");
      const picker = new Picker({
        data,
        onEmojiSelect: onEmojiSelect,
        previewPosition: "none",
        skinTonePosition: "none",
        theme: "dark",
        set: "native",
      });
      pickerRef.value.innerHTML = ""; // Clear previous if any
      pickerRef.value.appendChild(picker as any);
    }
  }
});

function onEmojiSelect(emoji: any) {
  form.icon = emoji.native || emoji.id || "";
  showEmojiPicker.value = false;
}

interface DayMeta {
  uuid: string;
  short: string;
}

const props = defineProps<{
  open: boolean;
  weekUuid: string | null;
  editTaskUuid?: string | null;
  prefillDayUuid?: string | null;
}>();
const emit = defineEmits(["close", "created", "updated", "deleted"]);

const store = useMonthStore();

// Base form state
const form = reactive({
  description: "",
  optional: false,
  weekScope: "single" as "single" | "multiple" | "all",
  repeatAcrossWeeks: false,
  icon: "" as string,
  visualType: "emoji" as "emoji" | "gif",
  gifUrl: "" as string,
});

const isClient = ref(false);
// Guard to prevent duplicate submissions creating duplicate tasks
const isSubmitting = ref(false);
onMounted(() => {
  isClient.value = true;
});

const selectedDayUuids = ref<string[]>([]);
const selectedWeekUuids = ref<string[]>([]); // weeks beyond base week
const editScope = ref<"single" | "recurrence">("single");

const isEdit = computed(() => !!props.editTaskUuid);
const editingTask = computed(() =>
  props.editTaskUuid ? store.getTaskByUuid(props.editTaskUuid) : null
);
const hasRecurrence = computed(
  () => !!(editingTask.value as any)?.recurrenceId
);

const baseWeek = computed(() =>
  store.currentMonth?.weeks.find((w) => w.uuid === props.weekUuid)
);
const weekDays = computed<DayMeta[]>(() => {
  if (!baseWeek.value) return [];
  return baseWeek.value.days.map((d) => ({
    uuid: d.uuid,
    short: d.name.slice(0, 2),
  }));
});
const otherWeeks = computed(() => {
  if (!store.currentMonth) return [];
  return store.currentMonth.weeks
    .filter((w) => w.uuid !== props.weekUuid)
    .map((w, i) => ({ uuid: w.uuid, label: w.name || `Week ${i + 1}` }));
});

const showDaySelector = computed(() => {
  if (form.weekScope === "all") return false;
  // If we are adding to a specific day (prefillDayUuid is set) AND we are in single mode,
  // hide the selector because the user already picked the day.
  // If they switch to 'multiple', we show it so they can add more days.
  if (props.prefillDayUuid && form.weekScope === "single") return false;
  return true;
});

function toggleDay(uuid: string) {
  if (form.weekScope === "single") {
    // In single mode, clicking a day selects ONLY that day (radio button behavior)
    selectedDayUuids.value = [uuid];
  } else {
    // In multiple mode, toggle behavior
    if (selectedDayUuids.value.includes(uuid)) {
      selectedDayUuids.value = selectedDayUuids.value.filter((id) => id !== uuid);
    } else {
      selectedDayUuids.value.push(uuid);
    }
  }
}
function toggleWeek(uuid: string) {
  if (selectedWeekUuids.value.includes(uuid)) {
    selectedWeekUuids.value = selectedWeekUuids.value.filter(
      (id) => id !== uuid
    );
  } else {
    selectedWeekUuids.value.push(uuid);
  }
}
function selectAllWeeks() {
  selectedWeekUuids.value = otherWeeks.value.map((w) => w.uuid);
}
function clearWeeks() {
  selectedWeekUuids.value = [];
}

watch(
  () => form.weekScope,
  (newScope) => {
    if (newScope === "single" && selectedDayUuids.value.length > 1) {
      // If switching to single, keep only the first selected day
      selectedDayUuids.value = [selectedDayUuids.value[0]];
    }
    // If switching to 'all', we don't need to do anything to selectedDayUuids
    // because the submit logic ignores them for 'all' scope anyway,
    // but for UI consistency we could clear them or leave them. Leaving them is fine.
  }
);

watch(
  () => props.open,
  (o) => {
    if (o) {
      if (isEdit.value && editingTask.value) {
        form.description = (editingTask.value as any).description;
        form.optional = (editingTask.value as any).optional;
        form.icon = (editingTask.value as any).icon || "";
        form.gifUrl = (editingTask.value as any).gifUrl || "";
        form.visualType = (editingTask.value as any).gifUrl ? "gif" : "emoji";
      } else {
        resetForm();
        if (props.prefillDayUuid) {
          form.weekScope = "single";
          selectedDayUuids.value = [props.prefillDayUuid];
        }
      }
    } else {
      showEmojiPicker.value = false;
    }
  }
);

// GIF search functions
function getGifUrl(gif: KlipyGif): string {
  return getGifUrlUtil(gif, 'sm');
}

function selectGif(gif: KlipyGif) {
  form.gifUrl = getGifUrlUtil(gif, 'sm');
  form.icon = ''; // Clear emoji when GIF is selected
}

function clearGif() {
  form.gifUrl = '';
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
    console.error('Failed to search GIFs:', error);
    gifResults.value = [];
  } finally {
    isLoadingGifs.value = false;
  }
}

function onGifSearchInput() {
  // Clear previous timeout
  if (gifSearchTimeout) {
    clearTimeout(gifSearchTimeout);
  }

  // Debounce search by 500ms
  gifSearchTimeout = setTimeout(() => {
    performGifSearch(gifSearchQuery.value);
  }, 500);
}

// Watch for description changes to auto-suggest GIFs
watch(() => form.description, (newDesc) => {
  if (form.visualType === 'gif' && newDesc && !form.gifUrl && !gifSearchQuery.value) {
    // Auto-search based on task description
    gifSearchQuery.value = newDesc;
    performGifSearch(newDesc);
  }
});

// Watch for visual type changes
watch(() => form.visualType, (newType) => {
  if (newType === 'gif' && form.description && !form.gifUrl) {
    // Auto-suggest GIFs based on description when switching to GIF mode
    gifSearchQuery.value = form.description;
    performGifSearch(form.description);
  } else if (newType === 'emoji') {
    // Clear GIF when switching to emoji
    form.gifUrl = '';
  }
});

function resetForm() {
  form.description = "";
  form.optional = false;
  form.weekScope = "single";
  form.repeatAcrossWeeks = false;
  form.icon = "";
  form.visualType = "emoji";
  form.gifUrl = "";
  selectedDayUuids.value = [];
  selectedWeekUuids.value = [];
  editScope.value = "single";
  isSubmitting.value = false;
  gifSearchQuery.value = "";
  gifResults.value = [];
}



function buildDaySelection(): Record<string, string[]> {
  if (!props.weekUuid) return {};
  const baseWeekUuid = props.weekUuid;
  let baseDays: string[];
  if (form.weekScope === "all") {
    baseDays = baseWeek.value ? baseWeek.value.days.map((d) => d.uuid) : [];
  } else if (form.weekScope === "single") {
    baseDays = selectedDayUuids.value.slice(0, 1);
  } else {
    // multiple
    baseDays = [...selectedDayUuids.value];
  }
  // Ensure uniqueness and remove empty entries
  const uniqueBaseDays = Array.from(new Set(baseDays)).filter(Boolean);
  const map: Record<string, string[]> = { [baseWeekUuid]: uniqueBaseDays };
  if (form.repeatAcrossWeeks) {
    selectedWeekUuids.value.forEach((w) => {
      // replicate same pattern using matching index positions
      const week = store.currentMonth?.weeks.find((ww) => ww.uuid === w);
      if (!week) return;
      const dayList = week.days;
      const indices = baseDays.map(
        (did) => baseWeek.value?.days.findIndex((d) => d.uuid === did) ?? -1
      );
      const targetDayUuids = indices
        .filter((i) => i >= 0)
        .map((i) => dayList[i].uuid);
      map[w] = Array.from(new Set(targetDayUuids)).filter(Boolean);
    });
  }
  return map;
}

function submit() {
  if (isSubmitting.value) return; // guard double clicks / enter
  if (!form.description) return;
  if (!props.weekUuid) return;

  // Auto-select first day if 'single' scope and no day selected
  if (form.weekScope === "single" && selectedDayUuids.value.length === 0 && weekDays.value.length > 0) {
    selectedDayUuids.value = [weekDays.value[0].uuid];
  }

  // For 'all', select all days in the week. For 'multiple', use all selected. For 'single', use the first selected.
  let valid = false;
  if (form.weekScope === "all") {
    valid = !!(baseWeek.value && baseWeek.value.days.length > 0);
  } else if (form.weekScope === "multiple") {
    valid = selectedDayUuids.value.length > 0;
  } else {
    valid = selectedDayUuids.value.length > 0;
  }
  
  if (!valid) {
    // Shake animation or error feedback could go here
    return;
  }

  isSubmitting.value = true;

  try {
    if (!isEdit.value) {
      const dayUuidsByWeek = buildDaySelection();
      store.bulkAddTasks({
        description: form.description,
        optional: form.optional,
        dayUuidsByWeek,
        baseWeekUuid: props.weekUuid,
        icon: form.icon || undefined,
        gifUrl: form.gifUrl || undefined,
      });
      emit("created");
    } else if (editingTask.value) {
      store.updateTask((editingTask.value as any).uuid, {
        description: form.description,
        optional: form.optional,
        icon: form.icon || undefined,
        gifUrl: form.gifUrl || undefined,
      });
      emit("updated");
    }
    close();
  } catch (e) {
    console.error(e);
    isSubmitting.value = false;
  }
}

function emitDelete() {
  if (!editingTask.value) return;
  store.deleteTask((editingTask.value as any).uuid, editScope.value);
  emit("deleted");
  close();
}

function close() {
  emit("close");
}
</script>

<style scoped>
.font-press {
  font-family: "Press Start 2P", cursive;
}
.bg-pixel-dark {
  background: #1f2937;
}
.shadow-pixel {
  box-shadow: 4px 4px 0 rgba(0, 0, 0, 0.8);
}

/* Modal Bounce Animation */
.modal-bounce-enter-active {
  animation: bounce-in 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
.modal-bounce-leave-active {
  animation: bounce-in 0.3s reverse;
}

@keyframes bounce-in {
  0% {
    opacity: 0;
    transform: scale(0.3);
  }
  50% {
    opacity: 1;
    transform: scale(1.05);
  }
  70% {
    transform: scale(0.9);
  }
  100% {
    transform: scale(1);
  }
}
</style>
