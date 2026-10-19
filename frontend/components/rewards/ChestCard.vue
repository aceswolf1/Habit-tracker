<!--
  ChestCard.vue (v2.3 W2 contract §5).

  One unclaimed chest with an OPEN action. Until claimed, the chest is
  a question-mark silhouette; on open the API rolls a rarity server-side
  and we reveal the rarity + credits with a CSS animation (≤ 1.2 s).
  The animated reveal swaps the silhouette for the rarity swatch and
  shows "+N CREDITS".

  Reduced-motion: the animation becomes an instant swap (CSS duration →
  0.001s with the *-end state retained via `animation-fill-mode`).

  Parent (`ChestModal`) owns the unclaimed list and the OPEN ALL loop
  so this component stays focused on a single chest.
-->
<template>
  <div
    class="chest-card font-mono"
    :class="[
      `chest-card--${effectiveRarity}`,
      { 'chest-card--opening': isOpening },
      { 'chest-card--claimed': isClaimed },
    ]"
    data-pp-chest-card
    :data-pp-chest-id="chest?.id || ''"
    :data-pp-chest-level="chest?.level || 0"
    :data-pp-chest-rarity="effectiveRarity || ''"
  >
    <div class="chest-card__icon" aria-hidden="true">
      <UiPpIcon :name="iconName" :size="32" :filled="isClaimed" />
    </div>

    <div class="chest-card__info">
      <span class="chest-card__title">
        LVL {{ chest?.level || 0 }} CHEST
      </span>
      <span class="chest-card__sub">
        <template v-if="!isClaimed">UNCLAIMED</template>
        <template v-else-if="claimError">
          {{ claimError }}
        </template>
        <template v-else>
          <span :class="`chest-card__rarity chest-card__rarity--${effectiveRarity}`">
            {{ rarityLabel }}
          </span>
          <span class="chest-card__credits">
            +{{ lastCredits }} <span class="chest-card__diamond" aria-hidden="true">◈</span>
          </span>
        </template>
      </span>
    </div>

    <button
      v-if="!isClaimed"
      type="button"
      class="chest-card__open pp-btn pp-btn--primary"
      :disabled="disabled || isOpening"
      :aria-label="`Open level ${chest?.level || 0} chest`"
      data-pp-chest-open
      @click="onOpen"
    >
      <span v-if="isOpening">OPENING…</span>
      <span v-else>OPEN</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import UiPpIcon from "../ui/PpIcon.vue";

/**
 * Local mirror of the rewards types — we deliberately don't import
 * `types/index.ts` because the modal already controls the I/O and we
 * want the card to be drop-in consistent even if the API shape
 * tightens.
 */
export interface ChestCardChest {
  id: string;
  level: number;
  /** ISO date or null when the API returns without earnedAt. */
  earnedAt?: string | null;
  /** `null` until the chest is claimed — server rolls on claim. */
  rarity?: string | null;
  /** `null` until the chest is claimed. */
  credits?: number | null;
  /** Mirrors the API contract: `null` until claimed. */
  claimedAt?: string | null;
}

const props = defineProps<{
  chest: ChestCardChest | null;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  (e: "open", chestId: string): void;
}>();

// After "OPEN" the parent returns `{ chest, credits }`. Mirror them here
// so the revealed slot doesn't disappear if the parent refetches and
// re-renders the card with the canonical payload.
const revealed = ref<{ rarity: string; credits: number } | null>(null);
const isOpening = ref(false);
const claimError = ref<string | null>(null);

const isClaimed = computed<boolean>(() => {
  if (props.chest?.claimedAt) return true;
  if (revealed.value) return true;
  return false;
});

const effectiveRarity = computed<string>(() => {
  if (revealed.value) return revealed.value.rarity;
  return props.chest?.rarity || "common";
});

const rarityLabel = computed(() =>
  effectiveRarity.value
    ? String(effectiveRarity.value).toUpperCase()
    : "PENDING",
);

const lastCredits = computed<number>(() => {
  if (revealed.value) return revealed.value.credits;
  return props.chest?.credits || 0;
});

const iconName = computed(() => {
  if (!isClaimed.value) return "lock";
  return "inventory_2";
});

async function onOpen() {
  if (!props.chest || isOpening.value || props.disabled) return;
  isOpening.value = true;
  claimError.value = null;
  try {
    emit("open", props.chest.id);
    // The PARENT (ChestModal) handles the fetch + reveal; we just wait
    // for the next tick so the OPENING label flashes at least once.
    await new Promise<void>((r) => setTimeout(r, 50));
  } finally {
    // The parent will set `revealed` via the v-model-style payload if
    // it wants to override; we leave the isOpening flag in place until
    // the parent clears it via `markOpened(id, payload)`.
    setTimeout(() => {
      isOpening.value = false;
    }, 1200);
  }
}

defineExpose({
  /** Called by the parent after a successful claim. */
  markOpened(rarity: string, credits: number) {
    revealed.value = { rarity, credits };
    isOpening.value = false;
  },
  /** Called by the parent when the claim failed (so the button can
   * recover without disappearing). */
  markError(message: string) {
    revealed.value = null;
    isOpening.value = false;
    claimError.value = message;
  },
});
</script>

<style scoped>
.chest-card {
  display: grid;
  grid-template-columns: 56px 1fr auto;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: var(--pp-card);
  border: 1px solid var(--pp-line);
  border-left-width: 4px;
  border-left-color: var(--pp-line);
  transition: border-left-color 200ms ease, transform 200ms ease;
}

.chest-card--common { border-left-color: var(--pp-muted); }
.chest-card--rare { border-left-color: var(--pp-cyan); }
.chest-card--epic { border-left-color: var(--pp-magenta); }
.chest-card--legendary { border-left-color: var(--pp-amber); }

.chest-card--claimed {
  background: rgba(0, 240, 255, 0.05);
}

.chest-card--opening {
  animation: chest-pulse 1.2s ease-in-out forwards;
}

.chest-card--claimed.chest-card--legendary {
  border-left-color: var(--pp-amber);
}

.chest-card__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border: 1px solid var(--pp-line);
  background: var(--pp-void);
  color: var(--pp-cyan);
}

.chest-card--claimed.chest-card--rare .chest-card__icon { color: var(--pp-cyan); }
.chest-card--claimed.chest-card--epic .chest-card__icon { color: var(--pp-magenta); }
.chest-card--claimed.chest-card--legendary .chest-card__icon {
  color: var(--pp-amber);
}
.chest-card--claimed.chest-card--common .chest-card__icon { color: var(--pp-muted); }

.chest-card__info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
}

.chest-card__title {
  font-weight: 700;
  font-size: 0.75rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--pp-text);
}

.chest-card__sub {
  font-size: 0.7rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--pp-muted);
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: baseline;
}

.chest-card__rarity {
  font-weight: 700;
  font-size: 0.75rem;
  letter-spacing: 0.12em;
}
.chest-card__rarity--common { color: var(--pp-muted); }
.chest-card__rarity--rare { color: var(--pp-cyan); }
.chest-card__rarity--epic { color: var(--pp-magenta); }
.chest-card__rarity--legendary { color: var(--pp-amber); }

.chest-card__credits {
  display: inline-flex;
  gap: 0.25rem;
  align-items: baseline;
  color: var(--pp-text);
  font-weight: 700;
}

.chest-card__diamond {
  color: var(--pp-cyan);
  font-weight: 700;
}

.chest-card__open {
  min-width: 96px;
  font-family: "Space Grotesk", system-ui, sans-serif;
}

@keyframes chest-pulse {
  0% { transform: scale(1); box-shadow: 0 0 0 rgba(0, 240, 255, 0); }
  35% { transform: scale(1.04); box-shadow: 0 0 12px rgba(0, 240, 255, 0.45); }
  100% { transform: scale(1); box-shadow: 0 0 0 rgba(0, 240, 255, 0); }
}

@media (prefers-reduced-motion: reduce) {
  .chest-card,
  .chest-card--opening {
    animation: none !important;
    transition: none !important;
  }
}
</style>
