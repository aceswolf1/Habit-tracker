<template>
  <TransitionGroup
    tag="div"
    name="toast"
    class="fixed top-4 right-4 z-[10000] flex flex-col gap-2"
  >
    <div
      v-for="toast in toasts"
      :key="toast.id"
      class="toast-item bg-pixel-dark border-2 border-black p-3 shadow-pixel min-w-[250px] flex items-start gap-3"
      :class="{
        'border-red-500': toast.type === 'error',
        'border-green-500': toast.type === 'success',
        'border-yellow-500': toast.type === 'warning',
        'border-blue-500': toast.type === 'info',
      }"
    >
      <div class="text-xl">
        {{ getIcon(toast.type) }}
      </div>
      <div class="flex-1">
        <div
          class="font-press text-[10px] mb-1"
          :class="{
            'text-red-400': toast.type === 'error',
            'text-green-400': toast.type === 'success',
            'text-yellow-400': toast.type === 'warning',
            'text-blue-400': toast.type === 'info',
          }"
        >
          {{ toast.title }}
        </div>
        <div class="font-mono text-xs text-white">
          {{ toast.message }}
        </div>
      </div>
      <button
        @click="remove(toast.id)"
        class="text-gray-500 hover:text-white font-mono"
      >
        x
      </button>
    </div>
  </TransitionGroup>
</template>

<script setup lang="ts">
import { ref } from "vue";

export interface Toast {
  id: number;
  title: string;
  message: string;
  type: "success" | "error" | "warning" | "info";
  duration?: number;
}

const toasts = ref<Toast[]>([]);
let nextId = 0;

function add(toast: Omit<Toast, "id">) {
  const id = nextId++;
  const newToast = { ...toast, id };
  toasts.value.push(newToast);

  if (toast.duration !== 0) {
    setTimeout(() => {
      remove(id);
    }, toast.duration || 3000);
  }
}

function remove(id: number) {
  const index = toasts.value.findIndex((t) => t.id === id);
  if (index !== -1) {
    toasts.value.splice(index, 1);
  }
}

function getIcon(type: string) {
  switch (type) {
    case "success":
      return "✅";
    case "error":
      return "❌";
    case "warning":
      return "⚠️";
    case "info":
      return "ℹ️";
    default:
      return "📝";
  }
}

defineExpose({ add });
</script>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}
.toast-enter-from {
  opacity: 0;
  transform: translateX(30px);
}
.toast-leave-to {
  opacity: 0;
  transform: translateX(30px);
}
.shadow-pixel {
  box-shadow: 4px 4px 0 rgba(0, 0, 0, 0.8);
}
.font-press {
  font-family: "Press Start 2P", cursive;
}
.bg-pixel-dark {
  background-color: #1f2937;
}
</style>
