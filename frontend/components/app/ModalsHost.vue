<template>
  <!--
    Modal hosts: TaskModal (create/edit/delete) + SettingsDrawer.
    All modal state lives in the page-level composable so the modal can
    be opened from any consumer of `useTaskModal`.
  -->
  <TaskModal
    :open="taskModalOpen"
    :weekUuid="currentWeek ? currentWeek.uuid : null"
    :prefillDayUuid="selectedDayUuid"
    :editTaskUuid="editingTaskUuid"
    @close="onClose"
    @created="onCreated"
    @updated="onUpdated"
    @deleted="onDeleted"
  />
  <SettingsDrawer />
</template>

<script setup lang="ts">
import TaskModal from "../TaskModal.vue";
import SettingsDrawer from "../SettingsDrawer.vue";

const props = defineProps<{
  taskModalOpen: boolean;
  selectedDayUuid: string | null;
  editingTaskUuid: string | null;
  currentWeek: any;
  refreshData: () => void;
  notify: {
    created: () => void;
    updated: () => void;
    deleted: () => void;
    singleDelete: () => void;
  };
  modal: {
    close: () => void;
  };
}>();

function onClose() {
  props.modal.close();
}
function onCreated() {
  props.refreshData();
  props.notify.created();
}
function onUpdated() {
  props.refreshData();
  props.notify.updated();
}
function onDeleted() {
  props.refreshData();
  props.notify.deleted();
}
</script>