<template>
  <div
    class="task-container"
    :class="{ 'optional-task': optional }"
    draggable="true"
    @dragstart="onDragStart"
    @dragend="onDragEnd"
  >
    <div
      class="task"
      :style="taskStyles"
      @dblclick="emitEdit"
      :class="{ completed }"
    >
      <!-- Completion FX (mounts anew each time for replay) -->
      <div v-if="completed" class="completion-effect" :key="effectKey">
        <span class="spark" v-for="n in 3" :key="'s' + n"></span>
        <span class="backdrop"></span>
        <svg
          class="sparkle-core"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M14.187 8.096L15 5.25L15.813 8.096C16.023 8.831 16.417 9.501 16.958 10.041C17.498 10.582 18.168 10.976 18.903 11.186L21.75 12L18.904 12.813C18.169 13.023 17.499 13.417 16.959 13.958C16.418 14.498 16.024 15.168 15.814 15.903L15 18.75L14.187 15.904C13.977 15.169 13.583 14.499 13.042 13.959C12.502 13.418 11.832 13.024 11.097 12.814L8.25 12L11.096 11.187C11.831 10.977 12.501 10.583 13.041 10.042C13.582 9.502 13.976 8.832 14.186 8.097L14.187 8.096Z"
            stroke="#000"
            stroke-linecap="round"
            stroke-linejoin="round"
            fill="#FFD700"
          />
        </svg>
        <span
          aria-hidden="true"
          class="particle"
          v-for="n in 8"
          :key="'p' + n"
        ></span>
      </div>
      <span class="task-description"
        >{{ icon ? icon + " " : "" }}{{ description }}</span
      >
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
  </div>
</template>

<script setup>
import { computed, ref, watch } from "vue";

const props = defineProps({
  description: { type: String, required: true },
  completed: { type: Boolean, default: false },
  optional: { type: Boolean, default: false },
  taskUuid: { type: String, required: true },
  dayUuid: { type: String, required: true },
  index: { type: Number, required: true },
  icon: { type: String, default: "" },
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

const taskStyles = computed(() => ({
  "background-color": "#374151",
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
watch(
  () => props.completed,
  (val) => {
    if (val) {
      // Small timeout to ensure DOM reflow if rapidly toggled
      requestAnimationFrame(() => effectKey.value++);
    }
  }
);

const checkStyles = computed(() => ({
  width: "1.5rem",
  height: "1.5rem",
  "background-color": props.completed ? "#10b981" : "#374151",
  border: "2px solid black",
  display: "flex",
  "justify-content": "center",
  "align-items": "center",
  "font-weight": "bold",
  cursor: "pointer",
}));
</script>

<style scoped>
.task-description {
  color: white;
  font-family: "Press Start 2P", cursive;
  font-size: 0.75rem;
}
/* Completion Effect inspired by CodePen Sparkle Button */
.task.completed {
  background: linear-gradient(#374151, #374151) padding-box,
    linear-gradient(
        130deg,
        #6d5206,
        #b8860b,
        #ffd700,
        #fff7c2,
        #ffd700,
        #b8860b,
        #6d5206
      )
      border-box;
  background-size: 200% 200%, 400% 400%;
  animation: border-shine 6s linear infinite, glow-pulse 2s ease-in-out infinite;
  box-shadow: 0 0 6px 2px #ffd70055, 0 0 18px 4px #ffeb8a44,
    0 0 32px 10px #ffd70022;
}
.task.completed::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: 2px; /* matches border shape */
  background: linear-gradient(
    115deg,
    transparent 0%,
    rgba(255, 255, 255, 0.15) 45%,
    rgba(255, 255, 255, 0.6) 50%,
    rgba(255, 255, 255, 0.15) 55%,
    transparent 100%
  );
  background-size: 250% 250%;
  mix-blend-mode: screen;
  pointer-events: none;
  animation: sweep 3.5s linear infinite;
  opacity: 0.9;
}
@keyframes border-shine {
  0% {
    background-position: 0% 0%, 0% 50%;
  }
  50% {
    background-position: 100% 100%, 50% 50%;
  }
  100% {
    background-position: 0% 0%, 100% 50%;
  }
}
@keyframes glow-pulse {
  0% {
    box-shadow: 0 0 4px 1px #ffd70066, 0 0 14px 3px #ffec8f55,
      0 0 26px 6px #ffd70022;
  }
  50% {
    box-shadow: 0 0 10px 2px #ffd700aa, 0 0 26px 8px #ffec8f66,
      0 0 42px 14px #ffd70033;
  }
  100% {
    box-shadow: 0 0 4px 1px #ffd70066, 0 0 14px 3px #ffec8f55,
      0 0 26px 6px #ffd70022;
  }
}
@keyframes sweep {
  0% {
    background-position: 200% 0%;
    opacity: 0;
  }
  8% {
    opacity: 1;
  }
  20% {
    background-position: 0% 100%;
    opacity: 0.9;
  }
  28% {
    opacity: 0;
  }
  100% {
    background-position: 0% 100%;
    opacity: 0;
  }
}
.completion-effect {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: visible;
  z-index: 2;
}
.sparkle-core {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) scale(0);
  width: 2.25rem;
  height: 2.25rem;
  opacity: 0;
  animation: core-pop 950ms ease-out forwards;
  filter: drop-shadow(0 0 4px #ffd700) drop-shadow(0 0 10px #ffefa3);
}
@keyframes core-pop {
  0% {
    transform: translate(-50%, -50%) scale(0.2) rotate(-20deg);
    opacity: 0;
  }
  40% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1) rotate(8deg);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.4) rotate(25deg);
  }
}

.spark {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0.65rem;
  height: 0.65rem;
  background: radial-gradient(
    circle at 30% 30%,
    #fff7d1 0%,
    #ffd700 60%,
    #c89900 100%
  );
  border-radius: 50%;
  transform: translate(-50%, -50%) scale(0);
  animation: spark-pop 900ms ease-out forwards;
  mix-blend-mode: screen;
}
.spark:nth-child(1) {
  animation-delay: 40ms;
  --tx: -140%;
  --ty: -40%;
}
.spark:nth-child(2) {
  animation-delay: 120ms;
  --tx: 90%;
  --ty: -110%;
}
.spark:nth-child(3) {
  animation-delay: 180ms;
  --tx: 120%;
  --ty: 60%;
}
@keyframes spark-pop {
  0% {
    transform: translate(-50%, -50%) scale(0);
    opacity: 0;
  }
  45% {
    opacity: 1;
  }
  60% {
    transform: translate(calc(-50% + var(--tx)), calc(-50% + var(--ty)))
      scale(1);
    opacity: 1;
  }
  100% {
    transform: translate(calc(-50% + var(--tx)), calc(-50% + var(--ty)))
      scale(0);
    opacity: 0;
  }
}

.backdrop {
  position: absolute;
  inset: 0;
  background: radial-gradient(
    circle at center,
    #ffd70033 0%,
    #ffd70005 70%,
    transparent 80%
  );
  opacity: 0;
  animation: backdrop-fade 1100ms ease-out forwards;
}
@keyframes backdrop-fade {
  0% {
    opacity: 0;
  }
  30% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}

.particle {
  position: absolute;
  width: 0.45rem;
  height: 0.45rem;
  background: radial-gradient(
    circle at center,
    #fffbe6 0%,
    #ffd700 70%,
    #a07000 100%
  );
  border-radius: 50%;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) scale(0.2);
  opacity: 0;
  animation: particle-move 1500ms ease-out forwards;
}
.particle:nth-of-type(1) {
  --ang: 15deg;
  --dist: 230%;
  animation-delay: 40ms;
}
.particle:nth-of-type(2) {
  --ang: 75deg;
  --dist: 190%;
  animation-delay: 90ms;
}
.particle:nth-of-type(3) {
  --ang: 140deg;
  --dist: 210%;
  animation-delay: 130ms;
}
.particle:nth-of-type(4) {
  --ang: 200deg;
  --dist: 200%;
  animation-delay: 170ms;
}
.particle:nth-of-type(5) {
  --ang: 260deg;
  --dist: 220%;
  animation-delay: 210ms;
}
.particle:nth-of-type(6) {
  --ang: 310deg;
  --dist: 180%;
  animation-delay: 250ms;
}
.particle:nth-of-type(7) {
  --ang: 330deg;
  --dist: 240%;
  animation-delay: 290ms;
}
.particle:nth-of-type(8) {
  --ang: 45deg;
  --dist: 250%;
  animation-delay: 330ms;
}
@keyframes particle-move {
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.2);
  }
  20% {
    opacity: 1;
  }
  55% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translate(
        calc(-50% + cos(var(--ang)) * var(--dist)),
        calc(-50% + sin(var(--ang)) * var(--dist))
      )
      scale(0.05);
  }
}

/* Fallback for browsers without trig in calc - degrade to outward scatter */
@supports not (transform: translate(calc(-50% + cos(10deg) * 10%), -50%)) {
  @keyframes particle-move {
    0% {
      opacity: 0;
      transform: translate(-50%, -50%) scale(0.2);
    }
    20% {
      opacity: 1;
    }
    55% {
      opacity: 1;
    }
    100% {
      opacity: 0;
      transform: translate(-50%, -250%) scale(0.05);
    }
  }
}
@keyframes shine {
  0% {
    box-shadow: 0 0 12px 2px #ffd700, 0 0 32px 4px #fff70088;
  }
  100% {
    box-shadow: 0 0 24px 6px #ffd700, 0 0 48px 8px #fff70088;
  }
}
.task-check {
  color: white;
}
.optional-badge {
  font-family: "Press Start 2P", cursive;
  font-size: 0.5rem;
  color: #fbbf24;
  text-align: right;
  margin-top: 0.25rem;
  margin-bottom: 0.5rem;
}
.optional-task {
  opacity: 0.85;
}
.edit-btn,
.del-btn {
  font-size: 0.6rem;
  border: 2px solid black;
  background: #1f2937;
  color: white;
  padding: 0 0.25rem;
  cursor: pointer;
  font-family: "Press Start 2P", cursive;
  line-height: 1rem;
  height: 24px;
  width: 24px;
}
.edit-btn:hover {
  background: #2563eb;
}
.del-btn:hover {
  background: #dc2626;
}
</style>
