<!--
  BestWorstHabits.vue (W1 restyle, V2 Combat Deck).

  Two-tile summary of the best-performing and worst-performing habit.
  Sharp 1px borders, amber / danger accents for best / worst.
-->
<template>
  <section class="bwh">
    <h2 class="bwh__header font-display">BEST / WORST HABITS</h2>
    <div class="bwh__grid">
      <article v-if="statistics?.bestHabit" class="bwh__tile bwh__tile--best">
        <header class="bwh__tile-head">
          <span class="bwh__badge font-mono bwh__badge--best">BEST HABIT</span>
        </header>
        <span class="bwh__icon" aria-hidden="true">{{ statistics.bestHabit.icon || '◆' }}</span>
        <h3 class="bwh__name font-display">{{ statistics.bestHabit.description }}</h3>
        <div class="bwh__stat">
          <span class="bwh__rate font-display">{{ statistics.bestHabit.completionRate }}%</span>
          <span class="bwh__count font-mono">
            {{ statistics.bestHabit.timesCompleted }}/{{ statistics.bestHabit.timesAppeared }}
          </span>
        </div>
      </article>

      <article v-if="statistics?.worstHabit" class="bwh__tile bwh__tile--worst">
        <header class="bwh__tile-head">
          <span class="bwh__badge font-mono bwh__badge--worst">NEEDS WORK</span>
        </header>
        <span class="bwh__icon" aria-hidden="true">{{ statistics.worstHabit.icon || '◇' }}</span>
        <h3 class="bwh__name font-display">{{ statistics.worstHabit.description }}</h3>
        <div class="bwh__stat">
          <span class="bwh__rate font-display">{{ statistics.worstHabit.completionRate }}%</span>
          <span class="bwh__count font-mono">
            {{ statistics.worstHabit.timesCompleted }}/{{ statistics.worstHabit.timesAppeared }}
          </span>
        </div>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  statistics: any;
}>();
</script>

<style scoped>
.bwh {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.bwh__header {
  font-family: "Space Grotesk", system-ui, sans-serif;
  font-weight: 700;
  font-size: 0.9rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--pp-cyan);
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--pp-line);
}

.bwh__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 0.75rem;
}

.bwh__tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 0.6rem;
  padding: 1rem;
  background: var(--pp-card);
  border: 1px solid var(--pp-line);
}

.bwh__tile--best {
  border-color: var(--pp-amber);
}
.bwh__tile--worst {
  border-color: var(--pp-danger);
}

.bwh__tile-head {
  width: 100%;
}

.bwh__badge {
  font-size: 0.6rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  padding: 0.3rem 0.6rem;
  border: 1px solid var(--pp-line);
  display: inline-block;
}

.bwh__badge--best {
  background: var(--pp-amber);
  color: var(--pp-void);
  border-color: var(--pp-amber);
}

.bwh__badge--worst {
  background: var(--pp-danger);
  color: var(--pp-text);
  border-color: var(--pp-danger);
}

.bwh__icon {
  font-size: 2rem;
  line-height: 1;
}

.bwh__name {
  font-family: "Space Grotesk", system-ui, sans-serif;
  font-weight: 700;
  font-size: 0.85rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--pp-text);
  line-height: 1.3;
}

.bwh__stat {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.bwh__rate {
  font-size: 1.4rem;
  color: var(--pp-amber);
}

.bwh__tile--worst .bwh__rate {
  color: var(--pp-danger);
}

.bwh__count {
  font-size: 0.65rem;
  letter-spacing: 0.08em;
  color: var(--pp-muted);
}
</style>