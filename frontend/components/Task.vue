<!--
  Task.vue (W4 split, UB-55).

  Thin orchestrator. Co-located CSS lives in
  `components/task/TaskCard.styles.scss` (inherited via `<style scoped src>`),
  and the completion sparkle / spark / particle effect subtree is owned by
  `components/task/TaskCompletionEffect.vue`.
-->
<template>
  <div
    class="task-container"
    :class="{ 'optional-task': optional, 'legendary-task': legendary, 'just-completed': justCompleted }"
    :data-task-uuid="taskUuid"
    draggable="true"
    @dragstart="onDragStart"
    @dragend="onDragEnd"
  >
    <div
      class="task"
      :style="taskStyles"
      @dblclick="emitEdit"
      :class="{ completed, 'has-gif': !!(gifUrl || gifVideoUrl), 'legendary': legendary, 'legendary-completed': legendary && completed }"
    >
      <TaskCompletionEffect v-if="showEffect" :effectKey="effectKey" />

      <!-- GIF Display (appears first) -->
      <div v-if="gifUrl || gifVideoUrl" class="task-gif-container">
        <!-- W5 perf: MP4 rendition (hardware-decoded, plays only on screen),
             JPG poster until then. Older tasks without renditions keep the GIF. -->
        <video
          v-if="gifVideoUrl && !videoFailed"
          ref="videoEl"
          class="task-gif"
          :poster="gifStillUrl || undefined"
          :aria-label="description"
          muted
          loop
          playsinline
          disablepictureinpicture
          preload="none"
          @error="videoFailed = true"
        >
          <source :src="gifVideoUrl" type="video/mp4" @error="videoFailed = true" />
        </video>
        <img
          v-else-if="gifUrl"
          :src="gifUrl"
          :alt="description"
          class="task-gif"
          loading="lazy"
          decoding="async"
          @error="onGifError"
        />
      </div>

      <!-- Task Description -->
      <span class="task-description"
        >{{ icon && !gifUrl ? icon + " " : "" }}{{ description }}</span
      >

      <!-- Actions (appear last) -->
      <div class="flex items-center gap-1 border-t-[#1e232b] border-t pt-3 mt-1 w-full">
        <span
          class="task-check"
          :style="checkStyles"
          @click.stop="$emit('toggleComplete')"
        >
          {{ completed ? "✓" : "□" }}
        </span>
        <button class="edit-btn" @click.stop="emitEdit" title="Edit Task">
          ✎
        </button>
        <button class="del-btn" @click.stop="emitDelete" title="Delete Task">
          ✕
        </button>
      </div>
    </div>
    <div v-if="optional" class="optional-badge">OPTIONAL</div>
    <div v-if="legendary" class="legendary-badge">⭐ LEGENDARY</div>
  </div>
</template>

<script setup>
import { computed, ref, watch, onBeforeUnmount } from "vue";
import TaskCompletionEffect from "./task/TaskCompletionEffect.vue";
import { useInViewPlayback } from "../composables/useInViewPlayback";
import { useSettingsStore } from "../stores/settingsStore";

// W5 perf: MP4 GIF rendition plays only while visible.
const videoEl = ref(null);
const videoFailed = ref(false);
const settings = useSettingsStore();
useInViewPlayback(videoEl, () => settings.animateGifs);

const props = defineProps({
  description: { type: String, required: true },
  completed: { type: Boolean, default: false },
  optional: { type: Boolean, default: false },
  legendary: { type: Boolean, default: false },
  taskUuid: { type: String, required: true },
  dayUuid: { type: String, required: true },
  index: { type: Number, required: true },
  icon: { type: String, default: "" },
  gifUrl: { type: String, default: "" },
  gifVideoUrl: { type: String, default: "" },
  gifStillUrl: { type: String, default: "" },
});

const emit = defineEmits([
  "toggleComplete",
  "editTask",
  "deleteTask",
  "dragStart",
  "dragEnd",
]);

function emitEdit() {
  emit("editTask", props.taskUuid);
}
function emitDelete() {
  emit("deleteTask", props.taskUuid);
}
function onDragStart(e) {
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData(
    "application/json",
    JSON.stringify({
      taskUuid: props.taskUuid,
      fromDayUuid: props.dayUuid,
      fromIndex: props.index,
    })
  );
  emit("dragStart", { taskUuid: props.taskUuid });
}
function onDragEnd() {
  emit("dragEnd", { taskUuid: props.taskUuid });
}
function onGifError(e) {
  console.error("Failed to load GIF:", props.gifUrl);
  e.target.style.display = "none";
}

const taskStyles = computed(() => ({
  "background-color": "var(--pp-gray)",
  border: props.completed ? "2px solid transparent" : "2px solid black",
  padding: "0.5rem",
  "margin-bottom": props.optional ? "0" : "0.5rem",
  display: "flex",
  "justify-content": "space-between",
  "align-items": "center",
  position: "relative",
  transition: "border 0.3s, box-shadow .4s",
  "flex-direction": "column",
  "align-items": "baseline",
  gap: "0.7rem",
}));

// Effect replay key
const effectKey = ref(0);
const justCompleted = ref(false);

// W5 perf: the sparkle/particle burst is a one-shot reward for ticking a
// task in this session. It is NOT mounted for tasks that load as completed
// (that fired one burst per completed card on every page load and left
// ~13 animated nodes per card in the DOM), and it unmounts once its
// longest animation (particle-move, 1.5 s) has finished.
const EFFECT_MS = 1600;
const showEffect = ref(false);
let effectTimer = null;

watch(
  () => props.completed,
  (val) => {
    if (val) {
      showEffect.value = true;
      clearTimeout(effectTimer);
      effectTimer = setTimeout(() => {
        showEffect.value = false;
      }, EFFECT_MS);
      // Small timeout to ensure DOM reflow if rapidly toggled
      requestAnimationFrame(() => effectKey.value++);

      // Add "just-completed" pulse class
      justCompleted.value = true;
      setTimeout(() => {
        justCompleted.value = false;
      }, 600); // Duration of pulse animation
    }
  }
);

onBeforeUnmount(() => clearTimeout(effectTimer));

const checkStyles = computed(() => ({
  "background-color": props.completed
    ? "var(--pp-emerald)"
    : "var(--pp-gray)",
  border: "2px solid black",
  display: "flex",
  "justify-content": "center",
  "align-items": "center",
  "font-weight": "bold",
  cursor: "pointer",
}));
</script>

<style scoped src="./task/TaskCard.styles.scss"></style>
