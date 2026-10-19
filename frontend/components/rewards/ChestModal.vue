<!--
  ChestModal.vue (v2.3 W2 contract §5).

  Lists every UNCLAIMED chest from the rewards store and exposes:
    - OPEN        → claim one chest (API rolls rarity server-side).
    - OPEN ALL    → sequential claim of every unclaimed chest.
    - Close       → dismiss the modal.

  Visibility is controlled entirely by the parent `open` prop. The
  parent (ModalsHost) wires the `openChests` app event and the
  AppHeader chest button to flip this prop.

  Lifecycle:
    - On open, asks the rewards store to fetch fresh data.
    - For OPEN ALL, claims each chest in sequence with no overlap
      (network must stay serial so the credits balance is deterministic).
    - On any claim, the rewards store dispatches a "CHEST OPENED"
      toast via the existing event bus. The rewards store also
      bubbles a toast for double-claims (ALREADY_CLAIMED) and 404s.

  Reduced motion is honored by `ChestCard` (its reveal animation
  collapses to an instant swap). This parent never animates the
  backdrop or the list reorder.
-->
<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="chest-modal-overlay fixed inset-0 z-[220] flex items-center justify-center p-3 sm:p-6"
      data-pp-chest-modal
      role="dialog"
      aria-modal="true"
      aria-labelledby="pp-chest-title"
    >
      <div
        class="absolute inset-0 bg-pp-void/85"
        aria-hidden="true"
        @click="onClose"
      ></div>

      <div
        class="chest-modal relative max-w-[640px] w-full max-h-[85vh] overflow-y-auto bg-pp-panel border border-pp-line shadow-[0_0_24px_rgba(0,240,255,0.25)]"
      >
        <!-- Modal header -->
        <header class="flex items-center justify-between p-3 border-b border-pp-line bg-pp-card">
          <div class="flex flex-col gap-1">
            <span class="font-mono text-label-sm text-pp-cyan uppercase tracking-wider">
              Combat Deck // Vault
            </span>
            <h2 id="pp-chest-title" class="font-display text-headline-md uppercase text-pp-text">
              Unclaimed Chests
            </h2>
          </div>
          <button
            type="button"
            class="micro w-9 h-9 flex items-center justify-center bg-pp-panel text-pp-muted hover:text-pp-cyan hover:bg-pp-card-active transition-colors"
            aria-label="Close chests modal"
            data-pp-chest-close
            @click="onClose"
          >
            <UiPpIcon name="close" :size="18" />
          </button>
        </header>

        <!-- Credits readout -->
        <div
          class="flex items-center justify-between gap-3 px-4 py-2 bg-pp-card border-b border-pp-line"
          data-pp-chest-credits-bar
        >
          <span class="font-mono text-label-md text-pp-muted uppercase tracking-wider">
            Balance
          </span>
          <span class="font-display text-headline-sm text-pp-text uppercase">
            <span class="text-pp-cyan mr-1" aria-hidden="true">◈</span>
            {{ creditsBalance }} <span class="font-mono text-label-md text-pp-muted">CREDITS</span>
          </span>
        </div>

        <!-- Empty state -->
        <div
          v-if="unclaimedChests.length === 0"
          class="p-8 flex flex-col items-center gap-3 text-center"
          data-pp-chest-empty
        >
          <UiPpIcon name="inventory_2" :size="48" />
          <span class="font-display text-headline-sm text-pp-muted uppercase">
            No unclaimed chests
          </span>
          <span class="font-mono text-label-md text-pp-muted uppercase max-w-md">
            Earn a chest every time you reach a new level.
          </span>
        </div>

        <!-- List -->
        <div v-else class="flex flex-col gap-2 p-4" data-pp-chest-list>
          <ChestCard
            v-for="chest in unclaimedChests"
            :key="chest.id"
            :ref="(el) => onCardRef(chest.id, el)"
            :chest="chest"
            :disabled="isOpeningAll"
            @open="(id) => onOpenOne(id)"
          />
        </div>

        <!-- Footer actions -->
        <div
          v-if="unclaimedChests.length > 0"
          class="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-t border-pp-line bg-pp-card"
        >
          <span class="font-mono text-label-sm text-pp-muted uppercase">
            {{ pendingChests.length }} pending
          </span>
          <div class="flex flex-wrap gap-2">
            <button
              type="button"
              class="px-3 min-h-[40px] sm:min-h-0 sm:py-1 font-mono text-label-md uppercase tracking-wider bg-pp-panel text-pp-text border border-pp-line hover:border-pp-cyan hover:text-pp-cyan transition-colors disabled:opacity-50"
              :disabled="anyOpening"
              data-pp-chest-close
              @click="onClose"
            >
              Close
            </button>
            <button
              type="button"
              class="px-3 min-h-[40px] sm:min-h-0 sm:py-1 font-display text-label-md uppercase tracking-wider bg-pp-cyan text-pp-void border border-pp-cyan hover:bg-pp-text transition-colors disabled:opacity-50"
              :disabled="anyOpening || pendingChests.length === 0"
              data-pp-chest-open-all
              @click="onOpenAll"
            >
              <span v-if="isOpeningAll">OPENING {{ openingProgress }}/{{ openingTotal }}…</span>
              <span v-else>OPEN ALL</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, watch } from "vue";
import UiPpIcon from "../ui/PpIcon.vue";
import ChestCard from "./ChestCard.vue";
import { useRewardsStore } from "../../stores/rewardsStore";
import { claimChest as apiClaimChest } from "../../services/cycleApi";
import { emitAppEvent } from "../../composables/useAppEvents";
import type { Chest } from "../../types/index";

/**
 * The card exposes `markOpened(rarity, credits)` and `markError(msg)`.
 * We type the slot loosely so we don't have to import the internal
 * `defineExpose` types back through Vue's `<script setup>` machinery.
 */
type ChestCardInstance = {
  markOpened(rarity: string, credits: number): void;
  markError(message: string): void;
};

const props = defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  (e: "close"): void;
}>();

const rewardsStore = useRewardsStore();

const cardRefs: Record<string, ChestCardInstance | null> = {};

// Chests opened while the modal is open stay listed (showing their rarity
// reveal) until the modal closes; otherwise the refetch would drop the card
// before the player sees what they got.
const openedThisVisit = ref<Set<string>>(new Set());

const pendingChests = computed<Chest[]>(() =>
  (rewardsStore.chests || []).filter((c) => c && !c.claimedAt),
);

const unclaimedChests = computed<Chest[]>(() => {
  const list = rewardsStore.chests || [];
  return [...list]
    .filter((c) => c && (!c.claimedAt || openedThisVisit.value.has(c.id)))
    .sort((a, b) => {
      const ta = a.earnedAt ? Date.parse(a.earnedAt) : 0;
      const tb = b.earnedAt ? Date.parse(b.earnedAt) : 0;
      return tb - ta;
    });
});

const creditsBalance = computed<number>(() => rewardsStore.credits || 0);

const isOpeningAll = ref(false);
const openingProgress = ref(0);
const openingTotal = ref(0);

const anyOpening = computed<boolean>(
  () => isOpeningAll.value,
);

function onCardRef(id: string, el: any) {
  cardRefs[id] = (el as ChestCardInstance) || null;
}

async function onOpenOne(chestId: string) {
  if (!chestId) return;
  try {
    const result = await apiClaimChest(chestId);
    if (result && result.chest) {
      const r = result.chest.rarity || "common";
      const cr = Number(result.credits) || 0;
      openedThisVisit.value = new Set([...openedThisVisit.value, chestId]);
      const card = cardRefs[chestId];
      if (card) card.markOpened(r, cr);
      // Dispatch the CHEST OPENED toast (mirrors rewardsStore.claimChest)
      // — we hit the API directly here so the card reveal can run.
      emitAppEvent("toast", {
        type: "success",
        title: "CHEST OPENED",
        message: `+${cr} ${cr === 1 ? "credit" : "credits"}`,
      });
      // Re-pull the canonical state so the credits total + chest array
      // reflects the rolled rarity on the NEXT render.
      rewardsStore.fetchRewards().catch(() => undefined);
    }
  } catch (err) {
    const msg =
      err && (err as any).code === "ALREADY_CLAIMED"
        ? "Already opened"
        : "Could not open";
    const card = cardRefs[chestId];
    if (card) card.markError(msg);
    emitAppEvent("toast", {
      type: "info",
      title: "ALREADY CLAIMED",
      message: "That chest was already opened.",
    });
  }
}

async function onOpenAll() {
  if (isOpeningAll.value) return;
  const list = pendingChests.value;
  if (!list.length) return;
  isOpeningAll.value = true;
  openingProgress.value = 0;
  openingTotal.value = list.length;
  for (const chest of list) {
    openingProgress.value++;
    await onOpenOne(chest.id);
  }
  isOpeningAll.value = false;
  openingProgress.value = 0;
}

function onClose() {
  emit("close");
}

// Refetch on open so the credits balance reflects the latest state.
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      openedThisVisit.value = new Set();
      rewardsStore.fetchRewards().catch(() => undefined);
    }
  },
  { immediate: false },
);

onMounted(() => {
  if (props.open) rewardsStore.fetchRewards().catch(() => undefined);
});
</script>

<style scoped>
.chest-modal-overlay {
  z-index: 1000;
}
.chest-modal {
  border-radius: 0;
}
.micro {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
</style>
