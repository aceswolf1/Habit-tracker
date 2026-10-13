<template>
  <div class="tier-badge" :class="{ 'tier-badge--earned': earned }" :data-tier="tierKey">
    <div class="tier-badge__icon">
      <UiPpIcon
        :name="iconName"
        :size="iconSize"
        :filled="earned"
      />
    </div>
    <div class="tier-badge__label tier-badge__label--full">
      {{ label }}
    </div>
    <div class="tier-badge__label tier-badge__label--short">
      {{ shortLabel }}
    </div>
  </div>
</template>

<script setup lang="ts">
/*
 * V2 Combat Deck tier badge (contract §3 + DESIGN.md "Rarity & Tier Badges").
 *
 * 5 badges in order: Bronze (25), Silver (50), Gold (75), Champion (90),
 * Final (100). Earned badges get their tier color and `filled` icon;
 * unearned ones are muted slate. Below `sm` the label collapses to a
 * 2-letter abbreviation (Br/Si/Go/Ch/Fi) so the row fits a 375-px
 * viewport without overflow.
 *
 * Uses <UiPpIcon> for the icon — each tier has its own Material Symbol:
 *   - Bronze    → workspace_premium  (filled for earned)
 *   - Silver    → workspace_premium
 *   - Gold      → workspace_premium
 *   - Champion  → military_tech
 *   - Final     → shield
 *
 * Why three identical icons for Bronze/Silver/Gold? DESIGN.md uses a
 * single workspace_premium silhouette with different colors per tier,
 * which reads more cleanly than mixing four different glyphs.
 */

import { computed } from "vue";
import type { IconName } from "../ui/iconNames";

const props = defineProps<{
  threshold: number;
  label: string;
  monthProgress: number;
}>();

const earned = computed(() => props.monthProgress >= props.threshold);

const tierKey = computed(() => props.label.toLowerCase());

const iconName = computed<IconName>(() => {
  switch (props.label) {
    case "Bronze":
    case "Silver":
    case "Gold":
      return "workspace_premium";
    case "Champion":
      return "military_tech";
    case "Final":
    default:
      return "shield";
  }
});

const shortLabel = computed(() => {
  switch (props.label) {
    case "Bronze":   return "Br";
    case "Silver":   return "Si";
    case "Gold":     return "Go";
    case "Champion": return "Ch";
    case "Final":    return "Fi";
    default:         return props.label.slice(0, 2);
  }
});

const iconSize = computed(() => (earned.value ? 18 : 16));
</script>

<style scoped>
.tier-badge {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  min-width: 0;
  flex: 1 1 0;
}

.tier-badge__icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--pp-card);
  border: 1px solid var(--pp-line);
  color: var(--pp-muted);
  transition: color 0.15s ease, border-color 0.15s ease,
    box-shadow 0.15s ease;
}

.tier-badge--earned .tier-badge__icon {
  color: var(--pp-cyan);
  border-color: var(--pp-cyan);
  box-shadow: 0 0 6px rgba(0, 240, 255, 0.3);
}

/* Per-tier earned colors via the data-tier attribute the component
   sets on its root <div>. Default (unearned) tier is the muted slate
   above; the per-tier rules override colour + glow for each tier. */
.tier-badge[data-tier="bronze"].tier-badge--earned .tier-badge__icon {
  color: var(--pp-bronze);
  border-color: var(--pp-bronze);
  box-shadow: 0 0 6px rgba(205, 127, 50, 0.35);
}
.tier-badge[data-tier="silver"].tier-badge--earned .tier-badge__icon {
  color: var(--pp-silver);
  border-color: var(--pp-silver);
  box-shadow: 0 0 6px rgba(192, 192, 192, 0.35);
}
.tier-badge[data-tier="gold"].tier-badge--earned .tier-badge__icon {
  color: var(--pp-gold-acc);
  border-color: var(--pp-gold-acc);
  box-shadow: 0 0 6px rgba(251, 191, 36, 0.35);
}
.tier-badge[data-tier="champion"].tier-badge--earned .tier-badge__icon {
  color: var(--pp-champion);
  border-color: var(--pp-champion);
  box-shadow: 0 0 6px rgba(167, 139, 250, 0.35);
}
.tier-badge[data-tier="final"].tier-badge--earned .tier-badge__icon {
  color: var(--pp-final);
  border-color: var(--pp-cyan);
  box-shadow: var(--pp-glow-cyan);
}

.tier-badge__label {
  font-family: "JetBrains Mono", ui-monospace, monospace;
  font-weight: 700;
  font-size: 0.625rem;
  line-height: 1.2;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--pp-muted);
  white-space: nowrap;
}

.tier-badge--earned .tier-badge__label {
  color: var(--pp-text);
}

.tier-badge[data-tier="bronze"].tier-badge--earned .tier-badge__label {
  color: var(--pp-bronze);
}
.tier-badge[data-tier="silver"].tier-badge--earned .tier-badge__label {
  color: var(--pp-silver);
}
.tier-badge[data-tier="gold"].tier-badge--earned .tier-badge__label {
  color: var(--pp-gold-acc);
}
.tier-badge[data-tier="champion"].tier-badge--earned .tier-badge__label {
  color: var(--pp-champion);
}
.tier-badge[data-tier="final"].tier-badge--earned .tier-badge__label {
  color: var(--pp-cyan);
}

/* Phone: short labels. */
.tier-badge__label--short {
  display: none;
}

@media (max-width: 639.98px) {
  .tier-badge__icon {
    width: 28px;
    height: 28px;
  }
  .tier-badge__label--full {
    display: none;
  }
  .tier-badge__label--short {
    display: block;
  }
}

@media (prefers-reduced-motion: reduce) {
  .tier-badge__icon {
    transition: none;
  }
}
</style>
