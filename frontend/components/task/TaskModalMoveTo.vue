<!--
  TaskModalMoveTo.vue (W4b, B-T2).

  Edit-mode only "Move to…" control inside TaskModal. Two cascading
  selects (week → day) and a MOVE button that emits the chosen
  `{ weekUuid, dayUuid }`. Hidden when `finished` is true (the user-
  facing rule from the W4b additions). The parent (TaskModal.vue)
  performs the actual `store.moveTask(...)` call, fires a toast on
  success via `emitAppEvent('toast', …)`, and closes the modal.

  Visible only when `isEdit` AND `!finished`. Defaults to the task's
  current week + current day so the picker pre-selects the move
  source, giving the user a "no-op" initial state.
-->
<template>
  <div
    v-if="isEdit && !finished"
    class="mb-5 p-3 border-2 border-dashed border-gray-600 bg-gray-800/50"
  >
    <div class="text-white font-press text-[10px] mb-2">MOVE TO…</div>
    <div class="flex gap-3 mb-3">
      <label class="block flex-1">
        <span class="text-white font-press text-[10px] block mb-1">Week</span>
        <select
          v-model="selectedWeek"
          class="w-full bg-gray-800 text-white p-2 border-2 border-black font-mono text-xs focus:outline-none focus:border-blue-500"
          aria-label="Target week"
        >
          <option v-for="w in weeks" :key="w.uuid" :value="w.uuid">
            {{ w.label }}
          </option>
        </select>
      </label>
      <label class="block flex-1">
        <span class="text-white font-press text-[10px] block mb-1">Day</span>
        <select
          v-model="selectedDay"
          class="w-full bg-gray-800 text-white p-2 border-2 border-black font-mono text-xs focus:outline-none focus:border-blue-500"
          aria-label="Target day"
          :disabled="daysOfSelectedWeek.length === 0"
        >
          <option v-for="d in daysOfSelectedWeek" :key="d.uuid" :value="d.uuid">
            {{ d.name }}
          </option>
        </select>
      </label>
    </div>
    <button
      type="button"
      class="w-full px-3 py-3 border-2 border-black bg-blue-600 hover:bg-blue-500 text-white font-press text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      :disabled="!canMove"
      @click="emitMove"
    >
      MOVE
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useMonthStore } from "../../stores/monthStore";

const props = defineProps<{
  /** Rendered only inside the edit-mode modal. */
  isEdit: boolean;
  /** Hide the picker when the current cycle is finished. */
  finished: boolean;
  /** Week uuid from the modal context (the week the edit was opened on). */
  currentWeekUuid: string | null;
  /**
   * Optional initial day uuid — the day the edited task currently lives
   * on. If omitted (e.g. opening from the "+" button without a day
   * preselected), the picker falls back to the first day of the chosen
   * week.
   */
  initialDayUuid?: string | null;
}>();

const emit = defineEmits<{
  /** Parent (TaskModal.vue) wires this to `store.moveTask(uuid, dayUuid)`. */
  move: [{ weekUuid: string; dayUuid: string }];
}>();

const store = useMonthStore();

const weeks = computed(() =>
  !store.currentMonth
    ? []
    : store.currentMonth.weeks.map((w, i) => ({
        uuid: w.uuid,
        label: w.name || `Week ${i + 1}`,
      })),
);

const daysOfSelectedWeek = computed<Array<{ uuid: string; name: string }>>(() => {
  if (!store.currentMonth) return [];
  const w = store.currentMonth.weeks.find((ww) => ww.uuid === selectedWeek.value);
  if (!w) return [];
  return w.days.map((d) => ({ uuid: d.uuid, name: d.name }));
});

const selectedWeek = ref<string>(
  props.currentWeekUuid || (weeks.value[0]?.uuid ?? ""),
);
const selectedDay = ref<string>(
  props.initialDayUuid || (daysOfSelectedWeek.value[0]?.uuid ?? ""),
);

// Whenever the week changes, if the previously-selected day is no longer
// present (e.g. different week has different days), pick the first day of
// the new week.
watch(selectedWeek, () => {
  const days = daysOfSelectedWeek.value;
  if (!days.find((d) => d.uuid === selectedDay.value)) {
    selectedDay.value = days[0]?.uuid ?? "";
  }
});

const canMove = computed(() => !!selectedWeek.value && !!selectedDay.value);

function emitMove() {
  if (!canMove.value) return;
  emit("move", { weekUuid: selectedWeek.value, dayUuid: selectedDay.value });
}
</script>
