<!--
  PerfectStreak.vue (v2.2 / W2 contract §5).

  One-line compact panel showing "PERFECT STREAK n · BEST m" — perfect
  days (current + longest), both from `insights.perfectDays`.
  Hidden when `insights` is null (loading) so the cockpit doesn't
  flash an empty panel during the first fetch.

  The text format is exactly what the contract calls out:
    "PERFECT STREAK 4 · BEST 9"
  current beats best — both bound to 0 when missing.
-->
<template>
  <UiPpPanel v-if="insights" padded>
    <div class="perfect-streak flex items-center justify-between px-1 py-1 font-mono text-label-md uppercase">
      <div class="flex items-center gap-2">
        <UiPpIcon name="workspace_premium" :size="16" />
        <span class="text-pp-text">
          Perfect Streak
          <span class="font-bold text-pp-cyan">{{ current }}</span>
        </span>
      </div>
      <span class="text-pp-muted">
        Best
        <span class="font-bold text-pp-text">{{ longest }}</span>
      </span>
    </div>
  </UiPpPanel>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { Insights } from "../../../types/index";

const props = defineProps<{
  insights: Insights | null;
}>();

const current = computed(() => props.insights?.perfectDays?.current ?? 0);
const longest = computed(() => props.insights?.perfectDays?.longest ?? 0);
</script>
