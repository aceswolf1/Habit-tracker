<template>
  <!--
    Modal hosts: TaskModal (create/edit/delete) + SettingsDrawer + the
    v2.2 MonthCertificate modal. All modal state lives in the page-level
    composable so the modal can be opened from any consumer of
    `useTaskModal`.

    Certificate controls: the modal binds to `open`/`close` here so it
    can be triggered from the `monthFinished` event (forwarded by
    `cycleNetwork.finishCurrentMonthAction`) or by the HeroSection
    "Certificate" button on a finished month's Stats page.
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
  <MonthCertificate
    :open="certificateOpen"
    @close="onCertificateClose"
  />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import TaskModal from "../TaskModal.vue";
import SettingsDrawer from "../SettingsDrawer.vue";
import MonthCertificate from "../certificate/MonthCertificate.vue";
import { onAppEvent } from "../../composables/useAppEvents";

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

// v2.2 (W2 contract §5): listen for the `monthFinished` app event and
// open the certificate modal automatically. The event fires AFTER
// `monthStore.finishCurrentMonth()` completes, with the finished
// cycle's uuid in the payload.
const certificateOpen = ref(false);

function handleMonthFinished() {
  certificateOpen.value = true;
}

const unsubscribe = onAppEvent("monthFinished", handleMonthFinished);

onMounted(() => {
  // Already subscribed above; nothing else to do on mount.
});

onBeforeUnmount(() => {
  unsubscribe();
});

function onCertificateClose() {
  certificateOpen.value = false;
}
</script>
