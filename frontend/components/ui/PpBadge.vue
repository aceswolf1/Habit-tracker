<template>
  <span :class="classes">
    <slot />
  </span>
</template>

<script setup lang="ts">
/*
 * V2 Combat Deck badge (contract §2 / §5).
 *
 * Sharp tag with a 1px border and a low-opacity wash. Kinds:
 *   - legendary  → magenta border + wash, magenta text.
 *   - optional   → amber dashed border, amber text.
 *   - common     → muted slate border, white text (default).
 *   - rare       → cyan border + wash, cyan text.
 *   - essential  → green border + wash, green text (v2.1 task tag).
 *   - defense    → amber border + wash, amber text (v2.1 task tag).
 *   - active     → cyan border + wash, cyan text (same as rare — used
 *                  for "ACTIVE", "TODAY"-style state pills).
 *   - boss       → magenta border + wash, magenta text (same family
 *                  as legendary; gives the boss a slightly different
 *                  surface to live on).
 *   - today      → amber border + wash, amber text.
 *   - done       → green border + wash, green text.
 *   - strike     → magenta border + wash, magenta text (v2.2 §5:
 *                  DOUBLE / TRIPLE / QUAD STRIKE badge on completed
 *                  tasks with combo >= 2).
 *   - muted      → low-contrast slate, used for the "STRIKE READY"
 *                  pill on pending tasks (v2.2 §5).
 */

import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    kind:
      | "legendary"
      | "optional"
      | "common"
      | "rare"
      | "essential"
      | "defense"
      | "active"
      | "boss"
      | "today"
      | "done"
      | "strike"
      | "muted";
  }>(),
  { kind: "common" },
);

const classes = computed(() => ["pp-badge", `pp-badge--${props.kind}`]);
</script>

<style scoped>
.pp-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.125rem 0.5rem;
  font-family: "JetBrains Mono", ui-monospace, monospace;
  font-weight: 700;
  font-size: 0.625rem;
  line-height: 1.4;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  border: 1px solid var(--pp-line);
  background: var(--pp-card);
  color: var(--pp-text);
  white-space: nowrap;
}

.pp-badge--legendary {
  border-color: var(--pp-magenta);
  background: rgba(255, 0, 127, 0.12);
  color: var(--pp-magenta);
}
.pp-badge--boss {
  border-color: var(--pp-magenta);
  background: rgba(255, 0, 127, 0.18);
  color: var(--pp-magenta);
}
.pp-badge--rare,
.pp-badge--active {
  border-color: var(--pp-cyan);
  background: rgba(0, 240, 255, 0.1);
  color: var(--pp-cyan);
}
.pp-badge--essential {
  border-color: var(--pp-green);
  background: rgba(0, 255, 102, 0.12);
  color: var(--pp-green);
}
.pp-badge--defense,
.pp-badge--today {
  border-color: var(--pp-amber);
  background: rgba(255, 190, 11, 0.12);
  color: var(--pp-amber);
}
.pp-badge--optional {
  border-color: var(--pp-amber);
  background: transparent;
  color: var(--pp-amber);
  border-style: dashed;
}
.pp-badge--done {
  border-color: var(--pp-green);
  background: rgba(0, 255, 102, 0.12);
  color: var(--pp-green);
}
.pp-badge--common {
  border-color: var(--pp-line);
  background: var(--pp-card);
  color: var(--pp-text);
}
.pp-badge--strike {
  border-color: var(--pp-magenta);
  background: rgba(255, 0, 127, 0.18);
  color: var(--pp-magenta);
}
.pp-badge--muted {
  border-color: var(--pp-line);
  background: transparent;
  color: var(--pp-muted);
  opacity: 0.85;
}
</style>