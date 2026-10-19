<!--
  VaultView.vue (v2.3 / W3).

  Top-level Trophy Vault page. Composes three panels:
    1. A credit-balance summary card with the player's next-reward line.
    2. AchievementGrid   (filter All / Unlocked / Locked).
    3. CertificateGallery (finished months; click → openCertificate).
    4. ChestHistory      (claimed chests + OPEN CHESTS button).

  Reads `rewardsStore` for the synced payload and `monthStore` for the
  finished-months list (already loaded into `store.months`). Fires
  `fetchRewards()` on open so first navigation always shows fresh
  numbers; subscribes to `achievementUnlocked` to refresh after toasts.

  Pure inline layout — no separate SCSS file; below the 400-line cap.
-->
<template>
  <div class="vault-view">
    <header class="vault-view__header">
      <div class="vault-view__title-block">
        <span class="vault-view__eyebrow font-mono">COMBAT DECK // TROPHY VAULT</span>
        <h1 class="vault-view__title font-display">REWARD ARCHIVE</h1>
        <p class="vault-view__subtitle font-mono">
          Achievements unlocked from history, certificates of finished cycles and chest drops.
        </p>
      </div>
      <button
        type="button"
        class="vault-view__refresh font-mono"
        :disabled="loading"
        title="Refresh vault"
        data-pp-vault-refresh
        @click="onRefresh"
      >
        <UiPpIcon name="refresh" :size="14" />
        <span>{{ loading ? "LOADING…" : "REFRESH" }}</span>
      </button>
    </header>

    <!-- Credits + next-reward summary. This is the "credits total at the top" the contract calls for. -->
    <UiPpPanel class="vault-view__summary" :padded="true">
      <div class="vault-view__summary-grid">
        <div class="vault-view__summary-cell vault-view__summary-cell--credits">
          <span class="vault-view__summary-label font-mono">CREDITS</span>
          <span class="vault-view__summary-value vault-view__summary-value--credits font-display">
            <span class="vault-view__summary-credits-icon" aria-hidden="true">◈</span>
            <span>{{ creditsInt }}</span>
          </span>
        </div>
        <div class="vault-view__summary-cell">
          <span class="vault-view__summary-label font-mono">LEVEL</span>
          <span class="vault-view__summary-value font-display">
            {{ level }}
          </span>
        </div>
        <div class="vault-view__summary-cell">
          <span class="vault-view__summary-label font-mono">RANK</span>
          <span class="vault-view__summary-value vault-view__summary-value--muted font-display">
            {{ rankLabel }}
          </span>
        </div>
        <div class="vault-view__summary-cell vault-view__summary-cell--next">
          <span class="vault-view__summary-label font-mono">NEXT REWARD</span>
          <span class="vault-view__summary-value vault-view__summary-value--next font-display">
            <template v-if="next.level === null">
              MAX LEVEL
            </template>
            <template v-else>
              LVL {{ next.level }} · {{ next.xpRemaining ?? 0 }} XP REMAINING
            </template>
          </span>
        </div>
      </div>
    </UiPpPanel>

    <VaultAchievementGrid :achievements="achievements" />

    <VaultCertificateGallery :months="finishedMonths" />

    <VaultChestHistory :chests="chests" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from "vue";
import { storeToRefs } from "pinia";
import { useRewardsStore } from "../../stores/rewardsStore";
import { useMonthStore } from "../../stores/monthStore";
import UiPpPanel from "../ui/PpPanel.vue";
import UiPpIcon from "../ui/PpIcon.vue";
import VaultAchievementGrid from "./AchievementGrid.vue";
import VaultCertificateGallery from "./CertificateGallery.vue";
import VaultChestHistory from "./ChestHistory.vue";
import type { CycleSummary } from "../../types/index";

const rewardsStore = useRewardsStore();
const monthStore = useMonthStore();
const storeRefs: any = storeToRefs(rewardsStore as any);
const monthRefs: any = storeToRefs(monthStore as any);

const rewards = computed(() => storeRefs.rewards?.value ?? null);
const achievements = computed(() =>
  rewards.value && Array.isArray(rewards.value.achievements)
    ? rewards.value.achievements
    : [],
);
const chests = computed(() =>
  rewards.value && Array.isArray(rewards.value.chests)
    ? rewards.value.chests
    : [],
);
const credits = computed(() => rewards.value?.credits ?? 0);
const creditsInt = computed(() => Math.max(0, Math.floor(credits.value)));
const level = computed(() => rewards.value?.level ?? 1);
const rankLabel = computed(() => rewards.value?.title ?? "RECRUIT");
const next = computed(
  () => rewards.value?.nextReward ?? { level: 2, xpRemaining: 25 },
);

// `monthStore.months` is the lightweight CycleSummary[]; it already
// includes a `finished` flag so the gallery can filter without a fetch.
const finishedMonths = computed<CycleSummary[]>(
  () =>
    Array.isArray(monthRefs.months?.value)
      ? (monthRefs.months.value as CycleSummary[])
      : [],
);

const loading = computed(() => rewardsStore.isLoading);

async function onRefresh() {
  await rewardsStore.fetchRewards();
}

onMounted(() => {
  // First navigation always pulls the latest payload — the store's
  // `unclaimedCount` getter is what the header badge uses, so it must
  // be live when the page is opened. App-level toasts for chestEarned
  // / achievementUnlocked are owned by app.vue so the header badge
  // updates even when the Vault isn't open.
  void rewardsStore.fetchRewards().catch(() => undefined);
});

// No unmount cleanup here: this component is mounted/unmounted only on
// section change inside app.vue, and the rewards store keeps a single
// payload cache that's reused by the header + chest modal too.
</script>

<style scoped>
.vault-view {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  min-width: 0;
}

.vault-view__header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.vault-view__title-block {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  min-width: 0;
}

.vault-view__eyebrow {
  font-size: 0.55rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--pp-muted);
}

.vault-view__title {
  font-family: "Space Grotesk", system-ui, sans-serif;
  font-weight: 700;
  font-size: 1.1rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--pp-cyan);
  margin: 0;
}

.vault-view__subtitle {
  font-size: 0.7rem;
  color: var(--pp-muted);
  margin: 0.125rem 0 0;
}

.vault-view__refresh {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.7rem;
  font-size: 0.6rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--pp-cyan);
  background: var(--pp-card);
  border: 1px solid var(--pp-line);
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}

.vault-view__refresh:hover:not(:disabled) {
  background: var(--pp-card-active);
  border-color: var(--pp-cyan);
}

.vault-view__refresh:disabled {
  opacity: 0.55;
  cursor: progress;
}

.vault-view__summary {
  padding: 0;
}

.vault-view__summary-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0;
}
@media (min-width: 1024px) {
  .vault-view__summary-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

.vault-view__summary-cell {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.625rem 0.75rem;
  border-right: 1px solid var(--pp-line);
  border-bottom: 1px solid var(--pp-line);
  min-width: 0;
}
.vault-view__summary-cell:nth-child(2n) {
  border-right: 0;
}
.vault-view__summary-cell:nth-last-child(-n + 2) {
  border-bottom: 0;
}
@media (min-width: 1024px) {
  .vault-view__summary-cell {
    border-right: 1px solid var(--pp-line);
    border-bottom: 0;
  }
  .vault-view__summary-cell:last-child {
    border-right: 0;
  }
  .vault-view__summary-cell:nth-child(2n) {
    border-right: 1px solid var(--pp-line);
  }
}

.vault-view__summary-cell--credits {
  background: rgba(0, 240, 255, 0.06);
}

.vault-view__summary-cell--next {
  background: rgba(255, 190, 11, 0.06);
}

.vault-view__summary-label {
  font-size: 0.55rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--pp-muted);
}

.vault-view__summary-value {
  font-family: "Space Grotesk", system-ui, sans-serif;
  font-weight: 700;
  font-size: 1.15rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--pp-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.vault-view__summary-value--credits {
  color: var(--pp-cyan);
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

.vault-view__summary-credits-icon {
  color: var(--pp-cyan);
  font-size: 1.1rem;
}

.vault-view__summary-value--muted {
  color: var(--pp-muted);
}

.vault-view__summary-value--next {
  color: var(--pp-amber);
}
</style>
