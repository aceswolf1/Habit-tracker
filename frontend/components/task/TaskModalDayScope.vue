<!--
  TaskModalDayScope.vue (W4 split, UB-55).

  Owns the "APPLY TO (THIS WEEK)" radio, the day-of-week chip grid, the
  "REPEAT IN OTHER WEEKS" section, and (when editing a recurring task) the
  "EDIT SCOPE" radio. Source-of-truth for the selections lives in the
  parent TaskModal (it bubbles back via v-model:selectedDayUuids and
  v-model:selectedWeekUuids); this component owns only the toggle UX.
-->
<template>
  <!-- Scope inside week -->
  <div class="mb-5">
    <div class="text-white font-press text-xs mb-2">APPLY TO (THIS WEEK)</div>
    <div class="flex flex-wrap gap-4 text-[10px] font-press mb-3">
      <label
        class="flex items-center gap-2 text-white cursor-pointer hover:text-yellow-400 transition-colors"
      >
        <input type="radio" value="single" v-model="weekScopeLocal" />
        Single Day
      </label>
      <label
        class="flex items-center gap-2 text-white cursor-pointer hover:text-yellow-400 transition-colors"
      >
        <input type="radio" value="multiple" v-model="weekScopeLocal" />
        Selected Days
      </label>
      <label
        class="flex items-center gap-2 text-white cursor-pointer hover:text-yellow-400 transition-colors"
      >
        <input type="radio" value="all" v-model="weekScopeLocal" />
        All Days
      </label>
    </div>
    <div v-if="showDaySelector" class="mt-2 grid grid-cols-7 gap-1">
      <button
        v-for="d in weekDays"
        :key="d.uuid"
        type="button"
        @click="toggleDay(d.uuid)"
        :class="[
          'border-2 border-black text-[10px] font-press py-2 transition-all transform hover:scale-105',
          selectedDayUuids.includes(d.uuid)
            ? 'bg-yellow-500 text-black shadow-[2px_2px_0_rgba(0,0,0,0.5)] translate-x-[-1px] translate-y-[-1px]'
            : 'bg-gray-700 text-white hover:bg-gray-600',
        ]"
      >
        {{ d.short }}
      </button>
    </div>
  </div>

  <!-- Recurrence across weeks -->
  <div class="mb-5 p-3 border-2 border-dashed border-gray-600 bg-gray-800/50">
    <label
      class="flex items-center gap-2 text-white font-press text-[10px] mb-2 cursor-pointer"
    >
      <input type="checkbox" v-model="repeatAcrossWeeksLocal" />
      REPEAT IN OTHER WEEKS
    </label>
    <div v-if="repeatAcrossWeeks" class="space-y-2 mt-2">
      <div class="flex flex-wrap gap-2 text-[10px] font-press">
        <button
          type="button"
          @click="selectAllWeeks"
          class="px-2 py-1 border-2 border-black bg-blue-600 hover:bg-blue-500 text-white transition-colors"
        >
          All Weeks
        </button>
        <button
          type="button"
          @click="selectedWeekUuidsLocal = []"
          class="px-2 py-1 border-2 border-black bg-gray-600 hover:bg-gray-500 text-white transition-colors"
        >
          Clear
        </button>
      </div>
      <div class="flex flex-wrap gap-2 mt-2">
        <button
          v-for="w in otherWeeks"
          :key="w.uuid"
          type="button"
          @click="toggleWeek(w.uuid)"
          :class="[
            'px-2 py-1 border-2 border-black text-[10px] font-press transition-colors',
            selectedWeekUuids.includes(w.uuid)
              ? 'bg-yellow-500 text-black'
              : 'bg-gray-700 text-white hover:bg-gray-600',
          ]"
        >
          {{ w.label }}
        </button>
      </div>
    </div>
  </div>

  <!-- Edit recurrence scope -->
  <div v-if="isEdit && hasRecurrence" class="mb-5">
    <div class="text-white font-press text-xs mb-2">EDIT SCOPE</div>
    <div class="flex flex-wrap gap-4 text-[10px] font-press">
      <label class="flex items-center gap-2 text-white cursor-pointer">
        <input type="radio" value="single" v-model="editScopeLocal" />
        This Task Only
      </label>
      <label class="flex items-center gap-2 text-white cursor-pointer">
        <input type="radio" value="recurrence" v-model="editScopeLocal" />
        All In Recurrence
      </label>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useMonthStore } from "../../stores/monthStore";
import type { DayChip, WeekScope } from "../../utils/cycleRecurrence";

const props = defineProps<{
  weekUuid: string | null;
  weekScope: WeekScope;
  selectedDayUuids: string[];
  selectedWeekUuids: string[];
  editScope: "single" | "recurrence";
  repeatAcrossWeeks: boolean;
  /** When true, day-of-week chips are shown (i.e. user hasn't selected "all"). */
  showDaySelector: boolean;
  /** Whether the modal is in edit mode (renders the recurrence scope radio). */
  isEdit: boolean;
  /** Whether the current editing task has a recurrenceId. */
  hasRecurrence: boolean;
}>();

const emit = defineEmits<{
  "update:weekScope": [value: WeekScope];
  "update:selectedDayUuids": [value: string[]];
  "update:selectedWeekUuids": [value: string[]];
  "update:editScope": [value: "single" | "recurrence"];
  "update:repeatAcrossWeeks": [value: boolean];
}>();

const store = useMonthStore();

const weekScopeLocal = computed({
  get: () => props.weekScope,
  set: (v) => emit("update:weekScope", v as WeekScope),
});
const repeatAcrossWeeksLocal = computed({
  get: () => props.repeatAcrossWeeks,
  set: (v) => emit("update:repeatAcrossWeeks", v),
});
const selectedDayUuidsLocal = computed({
  get: () => props.selectedDayUuids,
  set: (v) => emit("update:selectedDayUuids", v),
});
const selectedWeekUuidsLocal = computed({
  get: () => props.selectedWeekUuids,
  set: (v) => emit("update:selectedWeekUuids", v),
});
const editScopeLocal = computed({
  get: () => props.editScope,
  set: (v) => emit("update:editScope", v),
});

const baseWeek = computed(() =>
  store.currentMonth?.weeks.find((w) => w.uuid === props.weekUuid),
);

const weekDays = computed<DayChip[]>(() =>
  baseWeek.value
    ? baseWeek.value.days.map((d) => ({ uuid: d.uuid, short: d.name.slice(0, 2) }))
    : [],
);

const otherWeeks = computed(() =>
  !store.currentMonth
    ? []
    : store.currentMonth.weeks
        .filter((w) => w.uuid !== props.weekUuid)
        .map((w, i) => ({ uuid: w.uuid, label: w.name || `Week ${i + 1}` })),
);

function toggleDay(uuid: string) {
  if (props.weekScope === "single") {
    selectedDayUuidsLocal.value = [uuid];
  } else if (selectedDayUuidsLocal.value.includes(uuid)) {
    selectedDayUuidsLocal.value = selectedDayUuidsLocal.value.filter((id) => id !== uuid);
  } else {
    selectedDayUuidsLocal.value = [...selectedDayUuidsLocal.value, uuid];
  }
}

function toggleWeek(uuid: string) {
  if (selectedWeekUuidsLocal.value.includes(uuid)) {
    selectedWeekUuidsLocal.value = selectedWeekUuidsLocal.value.filter(
      (id) => id !== uuid,
    );
  } else {
    selectedWeekUuidsLocal.value = [...selectedWeekUuidsLocal.value, uuid];
  }
}

function selectAllWeeks() {
  selectedWeekUuidsLocal.value = otherWeeks.value.map((w) => w.uuid);
}
</script>
