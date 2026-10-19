<!--
  AchievementGrid.vue (v2.3 / W3).

  Three-state filter (All / Unlocked / Locked) over the rewards payload's
  `achievements[]`. Unlocked rows show the catalog name, the unlock date
  and the one-time credits reward. Locked rows are dimmed with a progress
  bar fed by `current/target`. An unlocked count next to the filter.

  Mobile-first layout: a single column under 640 px (1 card across),
  two-column ≥ 640 px, three-column ≥ 1024 px.
-->
<template>
  <section class="vault-achievements">
    <header class="vault-achievements__header">
      <div class="vault-achievements__title-block">
        <h2 class="vault-achievements__title font-display">ACHIEVEMENTS</h2>
        <p class="vault-achievements__subtitle font-mono">
          {{ unlockedCount }}/{{ totalCount }} UNLOCKED · {{ lockedCount }} LOCKED
        </p>
      </div>
      <div class="vault-achievements__filter font-mono" role="tablist" aria-label="Achievement filter">
        <button
          v-for="opt in filterOptions"
          :key="opt.value"
          type="button"
          role="tab"
          :aria-selected="filter === opt.value"
          :class="['vault-achievements__filter-btn', { 'vault-achievements__filter-btn--active': filter === opt.value }]"
          @click="filter = opt.value"
        >
          <span>{{ opt.label }}</span>
          <span class="vault-achievements__filter-count">{{ opt.count }}</span>
        </button>
      </div>
    </header>

    <div v-if="visible.length === 0" class="vault-achievements__empty font-mono">
      <UiPpIcon name="lock" :size="22" />
      <p>{{ emptyText }}</p>
    </div>

    <div v-else class="vault-achievements__grid">
      <article
        v-for="a in visible"
        :key="a.id"
        :class="['vault-achievement', { 'vault-achievement--locked': !a.unlocked }]"
        :data-pp-achievement="a.id"
        :data-pp-achievement-unlocked="a.unlocked ? 'true' : 'false'"
        :aria-label="achievementLabel(a)"
      >
        <header class="vault-achievement__head">
          <div class="vault-achievement__icon" :class="iconClass(a)">
            <UiPpIcon
              :name="a.unlocked ? 'trophy' : 'lock'"
              :size="22"
            />
          </div>
          <UiPpBadge :kind="sizeBadgeKind(a.size)">{{ a.size }}</UiPpBadge>
        </header>

        <h3 class="vault-achievement__name font-display">{{ a.name }}</h3>
        <p class="vault-achievement__description font-mono">{{ a.description }}</p>

        <div v-if="a.unlocked" class="vault-achievement__footer vault-achievement__footer--unlocked">
          <span class="vault-achievement__date font-mono">{{ formatDate(a.unlockedAt) }}</span>
          <span class="vault-achievement__credits font-mono">
            +{{ a.credits }} <span class="vault-achievement__credits-icon" aria-hidden="true">◈</span>
          </span>
        </div>

        <div v-else class="vault-achievement__progress">
          <div class="vault-achievement__progress-bar" :style="progressBarStyle(a)">
            <span class="vault-achievement__progress-fill"></span>
          </div>
          <div class="vault-achievement__progress-meta font-mono">
            <span>{{ a.current }}/{{ a.target }}</span>
            <span class="vault-achievement__progress-pct">{{ Math.round((a.progress || 0) * 100) }}%</span>
          </div>
        </div>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import UiPpBadge from "../ui/PpBadge.vue";
import UiPpIcon from "../ui/PpIcon.vue";
import type { Achievement, AchievementSize } from "../../types/index";

type FilterValue = "all" | "unlocked" | "locked";

const props = defineProps<{
  achievements: Achievement[];
}>();

const filter = ref<FilterValue>("all");

const totalCount = computed(() => props.achievements.length);
const unlockedCount = computed(
  () => props.achievements.filter((a) => a && a.unlocked).length,
);
const lockedCount = computed(() => totalCount.value - unlockedCount.value);

const visible = computed(() => {
  if (filter.value === "unlocked")
    return props.achievements.filter((a) => a && a.unlocked);
  if (filter.value === "locked")
    return props.achievements.filter((a) => a && !a.unlocked);
  return props.achievements;
});

const filterOptions = computed(() => [
  { value: "all" as const, label: "ALL", count: totalCount.value },
  { value: "unlocked" as const, label: "UNLOCKED", count: unlockedCount.value },
  { value: "locked" as const, label: "LOCKED", count: lockedCount.value },
]);

const emptyText = computed(() => {
  if (props.achievements.length === 0) return "No achievements are wired yet.";
  if (filter.value === "unlocked") return "Nothing unlocked yet. Start a cycle.";
  if (filter.value === "locked") return "All achievements unlocked — well done!";
  return "No achievements to display.";
});

function sizeBadgeKind(size: AchievementSize) {
  if (size === "large") return "legendary";
  if (size === "medium") return "rare";
  return "common";
}

function iconClass(a: Achievement) {
  return a.unlocked ? "vault-achievement__icon--unlocked" : "vault-achievement__icon--locked";
}

function progressBarStyle(a: Achievement): Record<string, string> {
  const pct = Math.max(0, Math.min(100, Math.round((a.progress || 0) * 100)));
  return {
    "--pp-progress": `${pct}%`,
  };
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  // ISO timestamps are stored as UTC; keep only the date so a player who
  // finishes at 23:50 sees the local calendar day they closed.
  return String(iso).slice(0, 10);
}

function achievementLabel(a: Achievement): string {
  const state = a.unlocked ? "Unlocked" : "Locked";
  return `${a.name}. ${state}. ${a.description}.`;
}
</script>

<style scoped>
.vault-achievements {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  min-width: 0;
}

.vault-achievements__header {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  align-items: flex-start;
  justify-content: space-between;
}
@media (min-width: 640px) {
  .vault-achievements__header {
    flex-direction: row;
    align-items: flex-end;
  }
}

.vault-achievements__title {
  font-family: "Space Grotesk", system-ui, sans-serif;
  font-weight: 700;
  font-size: 1rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--pp-cyan);
  margin: 0;
}

.vault-achievements__subtitle {
  font-size: 0.65rem;
  color: var(--pp-muted);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  margin: 0.125rem 0 0;
}

.vault-achievements__filter {
  display: inline-flex;
  gap: 0.25rem;
  background: var(--pp-card);
  border: 1px solid var(--pp-line);
  padding: 2px;
}

.vault-achievements__filter-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.55rem;
  background: transparent;
  border: 0;
  color: var(--pp-muted);
  font-family: "JetBrains Mono", ui-monospace, monospace;
  font-size: 0.6rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  cursor: pointer;
  transition: color 0.15s ease, background-color 0.15s ease;
}

.vault-achievements__filter-btn:hover {
  color: var(--pp-text);
}

.vault-achievements__filter-btn--active {
  background: var(--pp-card-active);
  color: var(--pp-cyan);
  box-shadow: inset 0 0 0 1px var(--pp-cyan);
}

.vault-achievements__filter-count {
  font-size: 0.6rem;
  background: var(--pp-panel);
  color: inherit;
  padding: 1px 4px;
  border: 1px solid var(--pp-line);
  border-radius: 0;
}

.vault-achievements__empty {
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

.vault-achievements__grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.5rem;
}
@media (min-width: 640px) {
  .vault-achievements__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (min-width: 1024px) {
  .vault-achievements__grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

.vault-achievement {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.625rem 0.75rem;
  background: var(--pp-card);
  border: 1px solid var(--pp-line);
  min-width: 0;
}

.vault-achievement--locked {
  opacity: 0.55;
}

.vault-achievement__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.vault-achievement__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid var(--pp-line);
  background: var(--pp-panel);
  color: var(--pp-muted);
}

.vault-achievement__icon--unlocked {
  color: var(--pp-amber);
  border-color: var(--pp-amber);
  background: rgba(255, 190, 11, 0.12);
}

.vault-achievement__icon--locked {
  color: var(--pp-muted);
}

.vault-achievement__name {
  font-family: "Space Grotesk", system-ui, sans-serif;
  font-weight: 700;
  font-size: 0.85rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--pp-text);
  margin: 0;
  line-height: 1.2;
}

.vault-achievement--locked .vault-achievement__name {
  color: var(--pp-muted);
}

.vault-achievement__description {
  font-size: 0.65rem;
  line-height: 1.35;
  color: var(--pp-muted);
  margin: 0;
}

.vault-achievement__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  font-size: 0.6rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.vault-achievement__date {
  color: var(--pp-green);
}

.vault-achievement__credits {
  color: var(--pp-cyan);
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.vault-achievement__credits-icon {
  font-size: 0.8rem;
  color: var(--pp-cyan);
}

.vault-achievement__progress {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.vault-achievement__progress-bar {
  position: relative;
  height: 6px;
  background: var(--pp-panel);
  border: 1px solid var(--pp-line);
  overflow: hidden;
}

.vault-achievement__progress-fill {
  position: absolute;
  inset: 0 auto 0 0;
  width: var(--pp-progress, 0%);
  background: var(--pp-muted);
  transition: width 0.2s linear;
}

.vault-achievement__progress-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.6rem;
  color: var(--pp-muted);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
</style>
