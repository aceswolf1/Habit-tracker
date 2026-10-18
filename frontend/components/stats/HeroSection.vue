<!--
  HeroSection.vue (W1 restyle, V2 Combat Deck).

  Header section of MonthStatistics — final tier badge + the four KPI
  cards (Total XP, Completion %, Perfect Days, Best Streak). Uses
  StatCard (V2) and the per-tier colour tokens. No animations, no
  pixel font.
-->
<template>
  <section class="hero-section">
    <div class="hero-section__tier" :class="`hero-tier--${tierKey}`">
      <span class="hero-section__tier-icon" aria-hidden="true">{{ tierIcon }}</span>
      <span class="hero-section__tier-text font-display">
        {{ statistics?.finalTier || 'BRONZE' }} TIER
      </span>
    </div>

    <div class="hero-stats">
      <StatCard
        title="Total XP"
        :value="`${statistics?.totalXP || 0} XP`"
        icon="⚔"
        rank="best"
      />
      <StatCard
        title="Completion"
        :value="`${statistics?.finalProgress || 0}%`"
        :subtitle="bonusText"
        icon="◎"
      />
      <StatCard
        title="Perfect Days"
        :value="statistics?.totalPerfectDays || 0"
        subtitle="100% Completed"
        icon="✦"
      />
      <StatCard
        title="Best Streak"
        :value="`${statistics?.longestStreak || 0} Days`"
        subtitle="Consecutive Perfect"
        icon="⌁"
      />
    </div>

    <div class="hero-section__actions">
      <button
        type="button"
        class="hero-section__cert-btn font-display"
        data-pp-hero-cert-btn
        @click="onCertificateClick"
      >
        <span aria-hidden="true">▣</span>
        <span>Certificate</span>
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import StatCard from '../StatCard.vue';
import { emitAppEvent } from '../../composables/useAppEvents';

const props = defineProps<{
  statistics: any;
}>();

defineEmits<{
  // Reserved for any future wiring at MonthStatistics level; the
  // certificate modal opens via the bus for now.
  (e: 'open-certificate'): void;
}>();

/**
 * v2.2 (W2 contract §5): clicking the Certificate button on a finished
 * month's Stats page re-opens the certificate modal. The `monthFinished`
 * event handler in ModalsHost is the canonical opener — emitting the
 * same event re-fires that handler.
 */
function onCertificateClick() {
  emitAppEvent('monthFinished', { cycleUuid: '' });
}

const tierKey = computed(() => {
  const tier = props.statistics?.finalTier || 'Bronze';
  return tier.toLowerCase();
});

const tierIcon = computed(() => {
  const tier = props.statistics?.finalTier || 'Bronze';
  switch (tier) {
    case 'Final': return '✦';
    case 'Champion': return '✪';
    case 'Gold': return '◈';
    case 'Silver': return '◆';
    case 'Bronze': return '◆';
    default: return '◆';
  }
});

const bonusText = computed(() => {
  const bonus = props.statistics?.bonusPercentage || 0;
  return bonus > 0 ? `+${bonus}% Bonus` : 'Base Progress';
});
</script>

<style scoped>
.hero-section {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 1rem;
  padding: 1.25rem;
  background: var(--pp-card);
  border: 1px solid var(--pp-line);
}

.hero-section__tier {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border: 1px solid var(--pp-line);
  background: var(--pp-panel);
}

.hero-section__tier-icon {
  font-size: 1.5rem;
  line-height: 1;
}

.hero-section__tier-text {
  font-family: "Space Grotesk", system-ui, sans-serif;
  font-weight: 700;
  font-size: 1.1rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.hero-tier--bronze .hero-section__tier-text,
.hero-tier--bronze .hero-section__tier-icon {
  color: var(--pp-bronze);
}

.hero-tier--silver .hero-section__tier-text,
.hero-tier--silver .hero-section__tier-icon {
  color: var(--pp-silver);
}

.hero-tier--gold .hero-section__tier-text,
.hero-tier--gold .hero-section__tier-icon {
  color: var(--pp-amber);
}

.hero-tier--champion .hero-section__tier-text,
.hero-tier--champion .hero-section__tier-icon {
  color: var(--pp-champion);
}

.hero-tier--final .hero-section__tier-text,
.hero-tier--final .hero-section__tier-icon {
  color: var(--pp-cyan);
}

.hero-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.75rem;
}

@media (min-width: 1024px) {
  .hero-stats {
    grid-template-columns: repeat(4, 1fr);
  }
}

/*
  v2.2 (W2) — "Certificate" action button. Right-aligned on the bottom
  of the hero section; opens the certificate modal (which then re-fetches
  insights if it has to). The cyan styling matches the + ADD PROTOCOL
  primary action elsewhere in the V2 UI.
*/
.hero-section__actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 0.25rem;
}
.hero-section__cert-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.85rem;
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--pp-void);
  background: var(--pp-cyan);
  border: 1px solid var(--pp-cyan);
  font-weight: 700;
  cursor: pointer;
  transition: background-color 120ms linear, color 120ms linear;
}
.hero-section__cert-btn:hover {
  color: var(--pp-text);
  background: var(--pp-text);
}
@media (prefers-reduced-motion: reduce) {
  .hero-section__cert-btn {
    transition: none;
  }
}
</style>