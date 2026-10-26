<!--
  TaskRowMenu.vue (W2 Wave B / B3 — phone actions).

  Phone-only "more" menu used by `TaskRow` on small screens. The row
  collapses edit + delete into one `more_horiz` button which opens this
  popover menu. On desktop the row keeps the two side-by-side buttons.

  Behavior:
    - Click the trigger → toggles the menu.
    - Click an item → emits the action and closes the menu.
    - Click outside / Escape → closes the menu.
    - Listeners are attached on open and removed on close via a flag
      (`isOpen` ref) so we don't keep global handlers forever.

  Emits:
    edit(uuid)
    delete(uuid)

  Why a separate file: keeps TaskRow.vue smaller (it's already near the
  400 line limit) and lets the menu be re-used by WeekGrid tiles later
  if we extend phone actions there.
-->
<template>
  <div class="relative">
    <button
      ref="triggerEl"
      type="button"
      class="menu-trigger shrink-0 w-10 h-10 flex items-center justify-center bg-pp-panel hover:bg-pp-card-active text-pp-muted hover:text-pp-cyan border border-pp-line transition-colors"
      :aria-label="`Actions for ${taskDescription}`"
      :aria-haspopup="'menu'"
      :aria-expanded="isOpen"
      @click.stop="toggle"
    >
      <PpIcon name="more_horiz" :size="18" />
    </button>

    <div
      v-if="isOpen"
      ref="menuEl"
      role="menu"
      class="menu-panel absolute right-0 top-full mt-1 z-30 min-w-[140px] bg-pp-panel border border-pp-line shadow-[0_0_10px_rgba(0,240,255,0.25)]"
      :data-task-uuid="taskUuid"
      @click.stop
    >
      <button
        type="button"
        role="menuitem"
        class="menu-item w-full flex items-center gap-2 px-3 min-h-[40px] font-mono text-label-md uppercase tracking-wider text-pp-text hover:bg-pp-card-active hover:text-pp-cyan text-left"
        @click="onEdit"
      >
        <PpIcon name="edit" :size="16" />
        <span>Edit</span>
      </button>
      <template v-if="canReorder">
        <button
          type="button"
          role="menuitem"
          class="menu-item w-full flex items-center gap-2 px-3 min-h-[40px] font-mono text-label-md uppercase tracking-wider text-pp-text hover:bg-pp-card-active hover:text-pp-cyan text-left border-t border-pp-line disabled:opacity-40"
          :disabled="isFirst"
          @click="onMove('moveUp')"
        >
          <span aria-hidden="true" class="w-4 text-center">↑</span>
          <span>Move up</span>
        </button>
        <button
          type="button"
          role="menuitem"
          class="menu-item w-full flex items-center gap-2 px-3 min-h-[40px] font-mono text-label-md uppercase tracking-wider text-pp-text hover:bg-pp-card-active hover:text-pp-cyan text-left border-t border-pp-line disabled:opacity-40"
          :disabled="isLast"
          @click="onMove('moveDown')"
        >
          <span aria-hidden="true" class="w-4 text-center">↓</span>
          <span>Move down</span>
        </button>
      </template>
      <button
        type="button"
        role="menuitem"
        class="menu-item w-full flex items-center gap-2 px-3 min-h-[40px] font-mono text-label-md uppercase tracking-wider text-pp-text hover:bg-pp-card-active hover:text-pp-danger text-left border-t border-pp-line"
        @click="onDelete"
      >
        <PpIcon name="delete" :size="16" />
        <span>Delete</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from "vue";
import PpIcon from "../ui/PpIcon.vue";

const props = defineProps<{
  taskUuid: string;
  taskDescription: string;
  /** Show Move up / Move down (only on the saved order). */
  canReorder?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
}>();

const emit = defineEmits<{
  edit: [uuid: string];
  delete: [uuid: string];
  moveUp: [uuid: string];
  moveDown: [uuid: string];
}>();

const isOpen = ref(false);
const triggerEl = ref<HTMLButtonElement | null>(null);
const menuEl = ref<HTMLDivElement | null>(null);

function toggle() {
  isOpen.value = !isOpen.value;
}
function close() {
  isOpen.value = false;
}
function onEdit() {
  close();
  emit("edit", props.taskUuid);
}
function onDelete() {
  close();
  emit("delete", props.taskUuid);
}
function onMove(kind: "moveUp" | "moveDown") {
  close();
  if (kind === "moveUp") emit("moveUp", props.taskUuid);
  else emit("moveDown", props.taskUuid);
}

function onDocClick(e: MouseEvent) {
  const target = e.target as Node | null;
  if (!target) return;
  if (triggerEl.value?.contains(target)) return;
  if (menuEl.value?.contains(target)) return;
  close();
}
function onEscape(e: KeyboardEvent) {
  if (e.key === "Escape") close();
}

watch(isOpen, (open) => {
  if (typeof window === "undefined") return;
  if (open) {
    window.addEventListener("click", onDocClick);
    window.addEventListener("keydown", onEscape);
  } else {
    window.removeEventListener("click", onDocClick);
    window.removeEventListener("keydown", onEscape);
  }
});

onBeforeUnmount(() => {
  if (typeof window === "undefined") return;
  window.removeEventListener("click", onDocClick);
  window.removeEventListener("keydown", onEscape);
});
</script>

<style scoped>
.menu-panel {
  /* Crisp 0-radius per design system; the box-shadow gives the neon
     outline so it doesn't look flat against the panel. */
}
.menu-item {
  /* Keep the chevron / icon flex-aligned */
  border-radius: 0;
}
</style>
