<!--
  ChestHistory.vue (v2.3 / W3).

  Shows the rewards payload's `chests[]` newest-first. Claimed chests
  render with a rarity-colored border + the credit amount they paid out.
  Unclaimed chests roll up into a header count and an "OPEN CHESTS"
  button that emits the W1 `openChests` event so W2's `ChestModal` opens
  (the modal owns the claim animation + credit award UX).
-->
<template>
  <section class="vault-chests">
    <header class="vault-chests__header">
      <div class="vault-chests__title-block">
        <h2 class="vault-chests__title font-display">CHEST HISTORY</h2>
        <p class="vault-chests__subtitle font-mono">
          {{ claimedCount }} OPENED · {{ unclaimedCount }} UNCLAIMED
        </p>
      </div>

      <button
        v-if="unclaimedCount > 0"
        type="button"
        class="vault-chests__open-btn font-display"
        data-pp-vault-open-chests
        aria-label="Open unclaimed chests"
        @click="onOpenChests"
      >
        <UiPpIcon name="inventory_2" :size="16" />
        <span>OPEN CHESTS</span>
        <span class="vault-chests__open-count font-mono">{{ unclaimedCount }}</span>
      </button>
    </header>

    <div v-if="chests.length === 0" class="vault-chests__empty font-mono">
      <UiPpIcon name="inventory_2" :size="22" />
      <p>No chests yet. Level up to earn your first one.</p>
    </div>

    <div v-else class="vault-chests__grid">
      <article
        v-for="c in chests"
        :key="c.id"
        :class="['vault-chest', `vault-chest--${rarityClass(c)}`]"
        :data-pp-chest="c.id"
        :data-pp-chest-claimed="c.claimedAt ? 'true' : 'false'"
        :aria-label="chestAriaLabel(c)"
      >
        <div class="vault-chest__top">
          <UiPpIcon
            :name="c.claimedAt ? 'inventory_2' : 'lock'"
            :size="20"
          />
          <UiPpBadge :kind="rarityBadgeKind(c.rarity)">
            {{ rarityLabel(c) }}
          </UiPpBadge>
        </div>

        <div class="vault-chest__level font-mono">
          LVL {{ c.level }}
        </div>

        <div class="vault-chest__meta font-mono">
          <span class="vault-chest__meta-label">EARNED</span>
          <span class="vault-chest__meta-value">{{ formatDate(c.earnedAt) }}</span>
        </div>

        <div v-if="c.claimedAt" class="vault-chest__credits font-mono">
          <span class="vault-chest__credits-value">+{{ c.credits || 0 }}</span>
          <span class="vault-chest__credits-icon" aria-hidden="true">◈</span>
        </div>
        <div v-else class="vault-chest__credits vault-chest__credits--pending font-mono">
          AWAITING CLAIM
        </div>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import UiPpBadge from "../ui/PpBadge.vue";
import UiPpIcon from "../ui/PpIcon.vue";
import type { Chest, ChestRarity } from "../../types/index";
import { emitAppEvent } from "../../composables/useAppEvents";

const props = defineProps<{
  chests: Chest[];
}>();

const claimedCount = computed(
  () => props.chests.filter((c) => c && c.claimedAt).length,
);
const unclaimedCount = computed(
  () => props.chests.filter((c) => c && !c.claimedAt).length,
);

function rarityClass(c: Chest): string {
  if (!c.claimedAt) return "unclaimed";
  if (c.rarity) return c.rarity;
  return "common";
}

function rarityLabel(c: Chest): string {
  if (!c.claimedAt) return "UNCLAIMED";
  if (c.rarity) return c.rarity.toUpperCase();
  return "COMMON";
}

function rarityBadgeKind(r: ChestRarity | null | undefined) {
  if (!r) return "common";
  if (r === "legendary") return "legendary";
  if (r === "epic") return "boss";
  if (r === "rare") return "rare";
  return "common";
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return String(iso).slice(0, 10);
}

function chestAriaLabel(c: Chest): string {
  if (c.claimedAt) {
    return `Level ${c.level} ${c.rarity || "common"} chest. Opened ${formatDate(c.claimedAt)} for ${c.credits || 0} credits.`;
  }
  return `Level ${c.level} chest, unclaimed.`;
}

function onOpenChests() {
  // W3 spec: emit `openChests`. W2's ChestModal mounted in ModalsHost
  // (modals wiring is owned by W2) listens for this event and pops.
  emitAppEvent("openChests", {});
}
</script>

<style scoped>
.vault-chests {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  min-width: 0;
}

.vault-chests__header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.vault-chests__title-block {
  min-width: 0;
}

.vault-chests__title {
  font-family: "Space Grotesk", system-ui, sans-serif;
  font-weight: 700;
  font-size: 1rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--pp-cyan);
  margin: 0;
}

.vault-chests__subtitle {
  font-size: 0.65rem;
  color: var(--pp-muted);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  margin: 0.125rem 0 0;
}

.vault-chests__open-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 0.875rem;
  background: var(--pp-amber);
  color: var(--pp-void);
  border: 1px solid var(--pp-amber);
  font-size: 0.7rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  cursor: pointer;
  transition: filter 0.15s ease, box-shadow 0.15s ease;
}

.vault-chests__open-btn:hover {
  filter: brightness(1.05);
  box-shadow: var(--pp-glow-amber);
}

.vault-chests__open-count {
  background: var(--pp-void);
  color: var(--pp-amber);
  padding: 0.125rem 0.4rem;
  font-size: 0.65rem;
  letter-spacing: 0.08em;
}

.vault-chests__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 2rem 1rem;
  text-align: center;
  font-size: 0.7rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--pp-muted);
  border: 1px dashed var(--pp-line);
  background: var(--pp-card);
}

.vault-chests__grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.5rem;
}
@media (min-width: 640px) {
  .vault-chests__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (min-width: 1024px) {
  .vault-chests__grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

.vault-chest {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.625rem 0.75rem;
  background: var(--pp-card);
  border: 1px solid var(--pp-line);
  border-left-width: 4px;
  min-width: 0;
}

.vault-chest--common {
  border-left-color: var(--pp-muted);
}
.vault-chest--rare {
  border-left-color: var(--pp-cyan);
}
.vault-chest--epic {
  border-left-color: var(--pp-magenta);
}
.vault-chest--legendary {
  border-left-color: var(--pp-amber);
  box-shadow: inset 0 0 0 1px rgba(255, 190, 11, 0.2);
}
.vault-chest--unclaimed {
  border-left-color: var(--pp-line);
  opacity: 0.75;
}

.vault-chest__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  color: var(--pp-cyan);
}
.vault-chest--unclaimed .vault-chest__top {
  color: var(--pp-muted);
}
.vault-chest--legendary .vault-chest__top {
  color: var(--pp-amber);
}
.vault-chest--epic .vault-chest__top {
  color: var(--pp-magenta);
}
.vault-chest--rare .vault-chest__top {
  color: var(--pp-cyan);
}

.vault-chest__level {
  font-size: 0.85rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--pp-text);
}

.vault-chest__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  font-size: 0.6rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.vault-chest__meta-label {
  color: var(--pp-muted);
}

.vault-chest__meta-value {
  color: var(--pp-text);
}

.vault-chest__credits {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.85rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--pp-cyan);
}

.vault-chest--legendary .vault-chest__credits {
  color: var(--pp-amber);
}

.vault-chest__credits-value {
  font-weight: 700;
}

.vault-chest__credits-icon {
  font-size: 1rem;
  color: inherit;
}

.vault-chest__credits--pending {
  color: var(--pp-muted);
  font-size: 0.6rem;
}
</style>
