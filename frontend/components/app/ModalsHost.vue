<!--
  Modal hosts: TaskModal (create/edit/delete) + SettingsDrawer +
  MonthCertificate (v2.2) + ChestModal (v2.3 W2).

  Each modal's open state lives here:
    - `taskModalOpen`    — provided by the page state composable.
    - `certificateOpen`  — local ref; flipped by the `monthFinished`
                           app event and the W3 `openCertificate` event
                           with a specific cycle uuid.
    - `chestModalOpen`   — local ref; flipped by the `openChests` app
                           event (W3 Trophy Vault) AND by the
                           AppHeader chest button (the parent passes a
                           `openChestModal` fn into AppShell → header).
-->
<template>
  <!--
    Certificate controls: the modal binds to open/close here so it can be
    triggered from the `monthFinished` event (forwarded by
    `cycleNetwork.finishCurrentMonthAction`) or by the HeroSection
    "Certificate" button on a finished month's Stats page. v2.3 (W2): the
    `openCertificate` event with `{ cycleUuid }` re-opens it for a
    specific finished month — used by the W3 Trophy Vault.
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
    :cycleUuid="openCertificateUuid"
    @close="onCertificateClose"
  />
  <ChestModal
    :open="chestModalOpen"
    @close="onChestModalClose"
  />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import TaskModal from "../TaskModal.vue";
import SettingsDrawer from "../SettingsDrawer.vue";
import MonthCertificate from "../certificate/MonthCertificate.vue";
import ChestModal from "../rewards/ChestModal.vue";
import { onAppEvent } from "../../composables/useAppEvents";
import { useRewardsStore } from "../../stores/rewardsStore";

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

const emit = defineEmits<{
  (e: "openChestModal"): void;
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
// open the certificate modal automatically.
const certificateOpen = ref(false);
const openCertificateUuid = ref<string | null>(null);

function handleMonthFinished(payload: { cycleUuid: string }) {
  openCertificateUuid.value = payload?.cycleUuid || null;
  certificateOpen.value = true;
}

const unsubscribeMonthFinished = onAppEvent(
  "monthFinished",
  handleMonthFinished,
);

// v2.3 (W2): `openCertificate { cycleUuid }` from the W3 Trophy Vault
// opens this modal for a specific cycle.
function handleOpenCertificate(payload: { cycleUuid: string }) {
  if (!payload || !payload.cycleUuid) {
    certificateOpen.value = true;
    openCertificateUuid.value = null;
    return;
  }
  openCertificateUuid.value = payload.cycleUuid;
  certificateOpen.value = true;
}

const unsubscribeOpenCert = onAppEvent("openCertificate", handleOpenCertificate);

// v2.3 (W2): Chest modal — opened from the AppHeader chest button (the
// parent wires that through) AND from the W3 Trophy Vault's
// `openChests` app event. The two paths share the same `chestModalOpen`
// ref so the modal stays a single source of truth.
const chestModalOpen = ref(false);

function handleOpenChests() {
  chestModalOpen.value = true;
}

const unsubscribeOpenChests = onAppEvent("openChests", handleOpenChests);

// Hydrate the rewards store on first mount so the AppHeader badge has
// data to render even before the first PATCH.
const rewardsStore = useRewardsStore();
rewardsStore.fetchRewards().catch(() => undefined);

onMounted(() => {
  // Already subscribed above; nothing else to do on mount.
});

onBeforeUnmount(() => {
  unsubscribeMonthFinished();
  unsubscribeOpenCert();
  unsubscribeOpenChests();
});

function onCertificateClose() {
  certificateOpen.value = false;
}

function onChestModalClose() {
  chestModalOpen.value = false;
}
</script>
