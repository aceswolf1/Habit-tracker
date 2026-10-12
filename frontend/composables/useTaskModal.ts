/**
 * State for the create/edit task modal: open flag, the optional day that
 * pre-selects the modal for "+ Add" flows, and the optional task UUID for
 * the edit flow. Extracted from `app.vue` to keep the shell thin.
 */
import { ref } from "vue";

export function useTaskModal() {
  const taskModalOpen = ref(false);
  const selectedDayUuid = ref<string | null>(null);
  const editingTaskUuid = ref<string | null>(null);

  function openCreateTask() {
    selectedDayUuid.value = null;
    editingTaskUuid.value = null;
    taskModalOpen.value = true;
  }

  function openCreateTaskForDay(dayUuid: string) {
    selectedDayUuid.value = dayUuid;
    editingTaskUuid.value = null;
    taskModalOpen.value = true;
  }

  function openEditTask(taskUuid: string) {
    editingTaskUuid.value = taskUuid;
    taskModalOpen.value = true;
  }

  function closeTaskModal() {
    taskModalOpen.value = false;
    selectedDayUuid.value = null;
    editingTaskUuid.value = null;
  }

  return {
    taskModalOpen,
    selectedDayUuid,
    editingTaskUuid,
    openCreateTask,
    openCreateTaskForDay,
    openEditTask,
    closeTaskModal,
  };
}