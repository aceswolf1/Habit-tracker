<template>
  <div class="text-center flex-1 min-w-0 tier-badge">
    <!--
      Icon box: shrinks on phone (<640 px) so 5 badges can fit side-by-side
      without labels colliding. Tap-target stays ≥ 40 px below `lg` via the
      `.pp-tap` class (inherited from the parent row).
    -->
    <div
      class="tier-icon-box"
      :style="{
        backgroundColor: monthProgress >= threshold ? 'var(--pp-gold-dk)' : 'var(--pp-gray)',
        border: '2px solid var(--pp-black)',
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '2px 2px 0 rgba(0,0,0,0.5)'
      }"
    >
      {{ icon }}
    </div>
    <!--
      Labels: at <640 px we show 2-char abbreviations so 5 labels don't run
      together; at >=640 px we show the full label. Two stacked spans
      toggled via CSS, no JS breakpoint needed (more reliable in headless
      browsers where resize-track events may not fire during emulation).
    -->
    <div
      class="tier-label-full"
      :style="{
        color: monthProgress >= threshold ? 'var(--pp-gold-acc)' : 'var(--pp-text)',
        fontFamily: '\'Press Start 2P\', cursive',
        fontSize: '0.75rem',
        marginTop: '0.25rem',
        lineHeight: 1.1,
      }"
    >
      {{ label }}
    </div>
    <div
      class="tier-label-short"
      :style="{
        color: monthProgress >= threshold ? 'var(--pp-gold-acc)' : 'var(--pp-text)',
        fontFamily: '\'Press Start 2P\', cursive',
        fontSize: '0.55rem',
        marginTop: '0.25rem',
        lineHeight: 1.1,
      }"
    >
      {{ shortLabel }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  threshold: number;
  label: string;
  icon: string;
  monthProgress: number;
  compact?: boolean; // kept for backward-compat; CSS handles the switch now.
}>();

// Two-char abbreviations keep the badges readable at 375 px while
// preserving the tier identity. "Champion" → "Ch", "Final" → "Fi".
const shortLabel = computed(() => {
  const l = props.label;
  if (l === "Champion") return "Ch";
  if (l === "Final") return "Fi";
  return l.substring(0, 2);
});
</script>

<style scoped lang="scss">
.tier-badge {
  .tier-icon-box {
    width: 2.5rem;
    height: 2.5rem;
    font-size: 1.25rem;
  }

  .tier-label-full {
    display: block;
  }

  .tier-label-short {
    display: none;
  }
}

@media (max-width: 639px) {
  .tier-badge {
    .tier-icon-box {
      width: 2rem;
      height: 2rem;
      font-size: 1rem;
    }

    .tier-label-full {
      display: none;
    }

    .tier-label-short {
      display: block;
    }
  }
}
</style>