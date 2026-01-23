<template>
  <div
    class="day-container"
    :style="containerStyles"
    @dragover.prevent="onDragOver"
    @drop.prevent="onDrop"
    @dragenter.prevent="onDragEnter"
    @dragleave.prevent="onDragLeave"
    :class="{ 'drag-over': dragOver }"
  >
    <!-- Particle layer (behind content) -->
    <ProgressParticles :progress="progress" />

    <div class="day-header" :style="headerStyles">{{ name }}</div>
    <div class="day-progress" style="position: relative; z-index: 2">
      <div
        style="
          padding: 0.5rem 0.5rem;
          display: flex;
          justify-content: space-between;
          font-family: 'Press Start 2P', cursive;
          font-size: 0.75rem;
        "
      >
        <span style="color: white">PROGRESS</span>
        <span style="color: white">{{ progressText }}</span>
      </div>

      <!-- Progress Bar -->
      <div
        style="
          height: 0.5rem;
          background-color: #374151;
          position: relative;
          border: 2px solid black;
          overflow: hidden;
          margin: 0 0.5rem 0.5rem 0.5rem;
        "
      >
        <div
          :style="{
            width: `${progress}%`,
            height: '100%',
            backgroundColor: progressBarColor,
            position: 'absolute',
            top: 0,
            left: 0,
          }"
        ></div>
      </div>
    </div>

    <!-- Tasks List -->
    <div style="padding: 0.25rem; position: relative; z-index: 2; min-height: 100px; display: flex; flex-direction: column;">
      <div v-if="tasks.length === 0" class="flex-1 flex flex-col items-center justify-center opacity-50 py-4">
        <div class="text-2xl mb-1 animate-pulse">💤</div>
        <div class="font-press text-[8px] text-center text-gray-400">NO QUESTS</div>
      </div>

      <Task
        v-for="(task, index) in tasks"
        :key="task.uuid"
        :description="task.description"
        :completed="task.completed"
        :optional="task.optional"
        :taskUuid="task.uuid"
        :dayUuid="dayUuid"
        :index="index"
        :icon="task.icon"
        :gifUrl="task.gifUrl"
        @toggle-complete="toggleTaskComplete(index)"
        @editTask="emit('edit-task', $event)"
        @deleteTask="emit('delete-task', $event)"
        @dragStart="draggingTaskUuid = $event.taskUuid"
        @dragEnd="draggingTaskUuid = null"
      />
      <!-- Drop indicator at end -->
      <div v-if="dragOver" class="drop-indicator">Drop here</div>

      <!-- Add Task Button -->
      <div style="display: flex; justify-content: center; margin-top: auto; padding-top: 0.75rem;">
        <button
          style="
            width: 1.5rem;
            height: 1.5rem;
            background-color: #2563eb;
            border: 2px solid black;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            color: white;
            transition: all 0.2s;
          "
          class="hover:scale-110 hover:bg-blue-500 active:scale-95"
          @click="emit('add-task', dayUuid)"
        >
          +
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from "vue";
import Task from "./Task.vue";
import ProgressParticles from "./ProgressParticles.vue";

const props = defineProps({
  name: { type: String, required: true },
  tasks: { type: Array, default: () => [] },
  headerColor: { type: String, default: "#4b5563" },
  headerTextColor: { type: String, default: "white" },
  dayUuid: { type: String, required: true },
});

const emit = defineEmits([
  "add-task",
  "toggle-task",
  "move-task",
  "edit-task",
  "delete-task",
]);

// Calculate progress based on completed tasks
const progress = computed(() => {
  const requiredTasks = props.tasks.filter((task) => !task.optional);
  if (requiredTasks.length === 0) return 0;
  const completedRequiredTasks = requiredTasks.filter(
    (task) => task.completed
  ).length;
  let calculatedProgress =
    (completedRequiredTasks / requiredTasks.length) * 100;
  const completedOptionalTasks = props.tasks.filter(
    (task) => task.optional && task.completed
  ).length;
  if (calculatedProgress === 100 && completedOptionalTasks > 0) {
    calculatedProgress = 100 + Math.min(10, completedOptionalTasks * 2); // allow some bonus >100
  }
  return calculatedProgress;
});

const progressText = computed(
  () => `${Math.min(100, Math.round(progress.value))}%`
);

const containerStyles = computed(() => ({
  backgroundColor: "#1f2937",
  border: `2px solid ${progress.value >= 100 ? "#f59e0b" : "black"}`,
  position: "relative",
  overflow: "hidden",
}));

const headerStyles = computed(() => ({
  backgroundColor: progress.value >= 100 ? "#f59e0b" : props.headerColor,
  color: progress.value >= 100 ? "black" : props.headerTextColor,
  fontFamily: "'Press Start 2P', cursive",
  fontSize: "0.7rem",
  padding: "0.25rem",
  textAlign: "center",
  position: "relative",
  zIndex: 2,
}));

const progressBarColor = computed(() => {
  if (progress.value >= 100) return "#f59e0b";
  if (progress.value >= 50) return "#fbbf24";
  return "#ef4444";
});

function toggleTaskComplete(index) {
  emit("toggle-task", props.tasks[index].uuid);
}

const dragOver = ref(false);
const draggingTaskUuid = ref(null);
function onDragEnter() {
  dragOver.value = true;
}
function onDragLeave() {
  dragOver.value = false;
}
function onDragOver(e) {
  e.dataTransfer.dropEffect = "move";
}
function onDrop(e) {
  dragOver.value = false;
  try {
    const data = JSON.parse(e.dataTransfer.getData("application/json"));
    if (!data.taskUuid) return;
    emit("move-task", { taskUuid: data.taskUuid, toDayUuid: props.dayUuid });
  } catch (_) {}
}
</script>

<style scoped>
.day-container {
  display: flex;
  flex-direction: column;
  position: relative;
}
.drag-over {
  outline: 2px dashed #fbbf24;
}
.drop-indicator {
  font-family: "Press Start 2P", cursive;
  font-size: 0.5rem;
  color: #fbbf24;
  text-align: center;
  margin: 0.25rem 0;
}
</style>
