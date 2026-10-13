<!--
  CloneDayPanel.vue (V2 A9 — owner W3).

  Inline panel mounted inside the active-day spotlight when the user
  toggles the "Batch Replicate" control. Uses W1's <UiPpPanel> /
  <UiPpButton> / <UiPpIcon> primitives. Sharp 1px line border, no
  animations. Emits `close` after the deploy succeeds.
-->
<template>
  <UiPpPanel padded :padded="true" class="flex flex-col gap-space-sm">
    <template #header>
      <div class="flex items-center justify-between w-full">
        <div class="flex items-center gap-space-xs">
          <UiPpIcon name="alt_route" :size="18" />
          <span class="text-label-lg text-pp-cyan">
            Clone {{ sourceShortLabel }} protocols across sprint
          </span>
        </div>
        <span class="text-label-sm text-pp-muted">1-CLICK CHRONO SYNC</span>
      </div>
    </template>

    <!-- Source + target chips row -->
    <div class="flex flex-wrap items-center gap-space-xs">
      <span
        class="px-space-md py-space-xs text-label-md uppercase border border-pp-line bg-pp-card-active text-pp-text"
        aria-label="source day"
      >
        {{ sourceShortLabel }} (SOURCE)
      </span>
      <button
        v-for="chip in targetChips"
        :key="chip.uuid"
        type="button"
        :aria-pressed="chip.selected"
        :class="chipClass(chip)"
        class="px-space-md py-space-xs text-label-md uppercase border focus:outline-none"
        @click="toggleTarget(chip.uuid)"
      >
        {{ chip.shortLabel }} [{{ chip.selected ? 'SYNC' : 'SKIP' }}]
      </button>

      <UiPpButton
        variant="critical"
        :disabled="selectedTargets.length === 0"
        class="ml-auto"
        @click="onDeploy"
      >
        Deploy Sync
      </UiPpButton>
    </div>

    <!-- Scope + close row -->
    <div class="flex items-center justify-between gap-space-sm">
      <div class="flex items-center gap-space-xs">
        <span class="text-label-sm text-pp-muted uppercase">Scope</span>
        <button
          v-for="opt in scopeOptions"
          :key="opt.value"
          type="button"
          :aria-pressed="scope === opt.value"
          class="px-space-sm py-space-xs text-label-sm uppercase border focus:outline-none"
          :class="scopeClass(opt.value)"
          @click="setScope(opt.value)"
        >
          {{ opt.label }}
        </button>
      </div>
      <UiPpButton variant="ghost" @click="emit('close')">Close</UiPpButton>
    </div>
  </UiPpPanel>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useMonthStore } from "../../stores/monthStore";

interface Props {
  /** The week containing the source day (used to enumerate the 7 chips). */
  week: { uuid: string; name: string; days: Array<{ uuid: string; name: string }> };
  /** All weeks in the cycle — used when scope === 'all'. */
  weeks: Array<{ uuid: string; name: string; days: Array<{ uuid: string; name: string }> }>;
  /** The day the user is cloning FROM. */
  sourceDay: { uuid: string; name: string };
}

const props = defineProps<Props>();
const emit = defineEmits<{ (e: "close"): void }>();

const store = useMonthStore();

type Scope = "this" | "all";
const scope = ref<Scope>("this");
const scopeOptions: Array<{ value: Scope; label: string }> = [
  { value: "this", label: "This week" },
  { value: "all", label: "All weeks" },
];

const sourceShortLabel = computed(() => shortLabel(props.sourceDay.name));

// Map source day position index → so we can replicate the same weekday across
// other weeks when scope === "all".
const sourceDayIndexInWeek = computed(() => {
  return props.week.days.findIndex((d) => d.uuid === props.sourceDay.uuid);
});

// Build the 6 target chips. Source is excluded; selection persists across
// scope changes so a user can "skip" once and re-enable without losing state.
const allTargetUuids = computed(() => {
  const uuids = new Set<string>();
  if (scope.value === "this") {
    props.week.days.forEach((d) => {
      if (d.uuid !== props.sourceDay.uuid) uuids.add(d.uuid);
    });
  } else {
    const idx = sourceDayIndexInWeek.value;
    if (idx < 0) return [];
    props.weeks.forEach((w) => {
      const day = w.days[idx];
      if (day && day.uuid !== props.sourceDay.uuid) uuids.add(day.uuid);
    });
  }
  return Array.from(uuids);
});

const selected = ref<Set<string>>(new Set());

watch(allTargetUuids, (uuids) => {
  const valid = new Set(uuids);
  for (const u of Array.from(selected.value)) {
    if (!valid.has(u)) selected.value.delete(u);
  }
}, { immediate: true });

const targetChips = computed(() =>
  allTargetUuids.value.map((uuid) => {
    const day = findDayByUuid(uuid);
    return {
      uuid,
      shortLabel: shortLabel(day?.name ?? ""),
      selected: selected.value.has(uuid),
    };
  })
);

const selectedTargets = computed(() =>
  allTargetUuids.value.filter((u) => selected.value.has(u))
);

function findDayByUuid(uuid: string): { uuid: string; name: string } | null {
  for (const w of props.weeks) {
    const d = w.days.find((x) => x.uuid === uuid);
    if (d) return d;
  }
  return null;
}

function shortLabel(name: string): string {
  if (!name) return "DAY";
  const trimmed = name.trim();
  if (/^(mon|tue|wed|thu|fri|sat|sun)/i.test(trimmed)) {
    return trimmed.slice(0, 3).toUpperCase();
  }
  return trimmed.slice(0, 3).toUpperCase();
}

function toggleTarget(uuid: string) {
  if (selected.value.has(uuid)) selected.value.delete(uuid);
  else selected.value.add(uuid);
  selected.value = new Set(selected.value);
}

function setScope(next: Scope) {
  scope.value = next;
}

function onDeploy() {
  if (selectedTargets.value.length === 0) return;
  store.cloneDayTasks(props.sourceDay.uuid, selectedTargets.value);
  emit("close");
}

function chipClass(chip: { selected: boolean }): string {
  return chip.selected
    ? "border-pp-cyan bg-pp-card-active text-pp-cyan"
    : "border-pp-line bg-pp-card text-pp-muted hover:text-pp-text";
}

function scopeClass(value: Scope): string {
  return value === scope.value
    ? "border-pp-cyan bg-pp-card-active text-pp-cyan"
    : "border-pp-line bg-pp-card text-pp-muted hover:text-pp-text";
}
</script>
