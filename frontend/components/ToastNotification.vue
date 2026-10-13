<!--
  ToastNotification.vue (W1 restyle, V2 Combat Deck).

  Static toast host pinned top-right. Each toast is a sharp 1 px
  `--pp-line` border panel on `--pp-panel` with a colour-coded left
  border (`--pp-cyan` / `--pp-magenta` / `--pp-amber` / `--pp-danger`)
  so the type is read at a glance without emoji.

  V2 styling: no legacy arcade font, mono body, Space Grotesk title, sharp
  borders, static transitions. Honors reduced motion.
-->
<template>
  <TransitionGroup
    tag="div"
    name="toast"
    class="toast-host"
    aria-live="polite"
    aria-atomic="true"
  >
    <div
      v-for="toast in toasts"
      :key="toast.id"
      class="toast"
      :class="`toast--${toast.type}`"
      role="status"
    >
      <span class="toast__title" :class="`toast__title--${toast.type}`">
        {{ toast.title }}
      </span>
      <span class="toast__message">{{ toast.message }}</span>
      <button
        type="button"
        class="toast__close"
        aria-label="Dismiss"
        @click="remove(toast.id)"
      >✕</button>
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

defineExpose({ add });
</script>

<style scoped>
.toast-host {
  position: fixed;
  top: 1rem;
  right: 1rem;
  z-index: 10000;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  pointer-events: none;
  max-width: calc(100vw - 2rem);
}

.toast {
  pointer-events: auto;
  min-width: 240px;
  max-width: 360px;
  background: var(--pp-panel);
  border: 1px solid var(--pp-line);
  border-left-width: 4px;
  padding: 0.7rem 0.85rem;
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: start;
  gap: 0.25rem 0.5rem;
  font-family: "JetBrains Mono", ui-monospace, monospace;
  color: var(--pp-text);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.45);
}

.toast--success {
  border-left-color: var(--pp-green);
}
.toast--error {
  border-left-color: var(--pp-danger);
}
.toast--warning {
  border-left-color: var(--pp-amber);
}
.toast--info {
  border-left-color: var(--pp-cyan);
}

.toast__title {
  grid-column: 1;
  grid-row: 1;
  font-family: "Space Grotesk", system-ui, sans-serif;
  font-weight: 700;
  font-size: 0.7rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.toast__title--success {
  color: var(--pp-green);
}
.toast__title--error {
  color: var(--pp-danger);
}
.toast__title--warning {
  color: var(--pp-amber);
}
.toast__title--info {
  color: var(--pp-cyan);
}

.toast__message {
  grid-column: 1;
  grid-row: 2;
  font-size: 0.75rem;
  line-height: 1.4;
  color: var(--pp-text);
  word-break: break-word;
}

.toast__close {
  grid-column: 2;
  grid-row: 1 / span 2;
  align-self: center;
  background: transparent;
  border: 1px solid var(--pp-line);
  color: var(--pp-muted);
  font-family: "JetBrains Mono", ui-monospace, monospace;
  font-size: 0.75rem;
  width: 28px;
  height: 28px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: color 0.15s ease, border-color 0.15s ease;
}

.toast__close:hover,
.toast__close:focus-visible {
  color: var(--pp-cyan);
  border-color: var(--pp-cyan);
  outline: none;
}

.toast-enter-active,
.toast-leave-active {
  transition: opacity 180ms ease, transform 180ms ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(20px);
}

@media (prefers-reduced-motion: reduce) {
  .toast-enter-active,
  .toast-leave-active {
    transition: none !important;
  }
  .toast-enter-from,
  .toast-leave-to {
    transform: none;
  }
}
</style>