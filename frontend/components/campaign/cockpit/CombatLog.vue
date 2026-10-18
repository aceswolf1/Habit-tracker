<!--
  CombatLog.vue (v2.2 / W2 contract §5 E6).

  Cockpit panel that shows today's completions (HH:MM local, task,
  +XP, optional strike name), with a toggle to expand into the last
  7 days. Newest first. Empty state when there are no entries.

  Data source: `insights.combatLog` (computed from GET /api/cycles/
  insights). The parent ensures `fetchInsights()` runs on mount
  (CampaignView owns that).

  Each entry shows the local time derived from `completedAt`
  (UTC ISO string), so the FE formats consistently with the rest of
  the app. v2.2 rule: the strike name comes from the shared
  `comboName(combo)` so the FE renders exactly what the store wrote.
-->
<template>
  <UiPpPanel padded>
    <template #header>
      <div class="flex items-center justify-between w-full">
        <div class="flex items-center gap-space-xs">
          <UiPpIcon name="terminal" :size="18" />
          <span class="text-headline-sm text-pp-cyan uppercase tracking-wider">Combat Log</span>
        </div>
        <button
          type="button"
          class="px-2 py-0.5 font-mono text-label-sm uppercase tracking-wider border bg-pp-card text-pp-text border-pp-line hover:border-pp-cyan hover:text-pp-cyan transition-colors"
          :aria-pressed="showAll"
          data-pp-combat-log-toggle
          @click="showAll = !showAll"
        >
          {{ showAll ? 'Today only' : 'Last 7 days' }}
        </button>
      </div>
    </template>

    <div v-if="visibleEntries.length > 0" class="flex flex-col gap-1">
      <div
        v-for="entry in visibleEntries"
        :key="entry.completedAt + entry.taskUuid"
        class="combat-entry flex items-center gap-2 px-1 py-1 font-mono text-label-sm uppercase border-l-2"
        :class="entry.comboName ? 'border-pp-magenta' : 'border-pp-line'"
      >
        <span class="combat-entry__time shrink-0 text-pp-muted">{{ formatTime(entry.completedAt) }}</span>
        <span class="combat-entry__task flex-1 min-w-0 truncate text-pp-text" :title="entry.description">
          {{ entry.description }}
        </span>
        <span
          class="combat-entry__xp shrink-0 font-bold"
          :class="entry.comboName ? 'text-pp-magenta' : 'text-pp-cyan'"
        >+{{ entry.xp }} XP</span>
        <span
          v-if="entry.comboName"
          class="combat-entry__strike shrink-0 inline-flex items-center px-1.5 py-0.5 font-bold text-pp-magenta border border-pp-magenta"
          style="background: rgba(255, 0, 127, 0.18);"
        >{{ entry.comboName }}</span>
      </div>
    </div>

    <div v-else class="combat-empty-state flex flex-col items-center justify-center gap-2 px-2 py-6 font-mono uppercase">
      <span class="text-headline-sm text-pp-muted">No operations logged</span>
      <span class="text-label-sm text-pp-muted text-center">
        Complete a task today to start your combat log.
      </span>
    </div>
  </UiPpPanel>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { todayIso } from "../../../utils/sharedDates";
import type { Insights, InsightsCombatLogEntry } from "../../../types/index";

const props = defineProps<{
  insights: Insights | null;
}>();

const showAll = ref(false);

/**
 * "Today" in the user's local timezone, derived from the same helper
 * the cycleApi uses for `clientDate`. Compared to `entry.completedOn`
 * (server-stamped local date) so we get the user-local "today".
 */
const todayDate = computed<string>(() => todayIso());

const todayEntries = computed<InsightsCombatLogEntry[]>(() => {
  const list = Array.isArray(props.insights?.combatLog) ? props.insights!.combatLog : [];
  const t = todayDate.value;
  if (!t) return [];
  return list.filter((e) => e && e.completedOn === t);
});

/**
 * "Last 7 days" view: includes today + the 6 previous calendar days
 * (local). The server caps the log at 100 entries for the last 7
 * days, so this slice never overflows.
 */
const last7Entries = computed<InsightsCombatLogEntry[]>(() => {
  const list = Array.isArray(props.insights?.combatLog) ? props.insights!.combatLog : [];
  const t = todayDate.value;
  if (!t) return list;
  const cutoffMs = Date.parse(t) - 6 * 86_400_000;
  return list.filter((e) => {
    if (!e || !e.completedOn) return false;
    const ms = Date.parse(e.completedOn);
    if (Number.isNaN(ms)) return false;
    return ms >= cutoffMs;
  });
});

const visibleEntries = computed<InsightsCombatLogEntry[]>(() =>
  showAll.value ? last7Entries.value : todayEntries.value,
);

function formatTime(iso: string | null | undefined): string {
  if (!iso) return "--:--";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "--:--";
  // 24h HH:MM in the user's local timezone (contract §5 E6: "time HH:MM local").
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}
</script>

<style scoped>
.combat-entry {
  background: var(--pp-card);
}
.combat-entry__time {
  width: 3.5rem;
  letter-spacing: 0.06em;
}
.combat-entry__task {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
