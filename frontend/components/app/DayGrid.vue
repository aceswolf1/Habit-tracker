<template>
  <!--
    Daily habit grid, responsive:
      - phone  (<640):  show one day at a time, with a 7-button day picker
        and prev/next-week buttons above
      - tablet (640-1023): horizontal scroll-snap strip with all 7 days
        at >= 200px wide each (so 3-4 days visible at once)
      - desktop (>=1024): the original 7-column grid (unchanged)

    The mobile-first approach: render all 7 day cards + the phone-only
    picker/prev/next. Tailwind responsive classes hide / show the right
    pieces at each breakpoint. The grid styling is the same set of CSS
    rules; only the parent container's class controls how the cards lay out.
  -->
  <template v-if="currentWeek">
    <!--
      Phone-only chrome: 7-button day picker + prev/next week buttons.
      Hidden above `sm` (640px) per the responsive contract.
    -->
    <div class="sm:hidden mb-2 flex flex-col gap-1">
      <div class="flex items-center justify-between gap-1">
        <button
          type="button"
          class="pp-tap shrink-0 border-2 border-black px-2 py-2 font-press text-[10px]"
          :class="hasPrevWeek ? 'bg-pixel-blue text-white' : 'bg-pixel-gray text-pixel-text-muted'"
          :disabled="!hasPrevWeek"
          aria-label="Previous week"
          @click="onPrevWeek"
        >
          ◀ PREV
        </button>
        <span class="font-press text-[10px] text-pixel-text truncate">
          {{ currentWeek.name }}
        </span>
        <button
          type="button"
          class="pp-tap shrink-0 border-2 border-black px-2 py-2 font-press text-[10px]"
          :class="hasNextWeek ? 'bg-pixel-blue text-white' : 'bg-pixel-gray text-pixel-text-muted'"
          :disabled="!hasNextWeek"
          aria-label="Next week"
          @click="onNextWeek"
        >
          NEXT ▶
        </button>
      </div>
      <div class="grid grid-cols-7 gap-[2px]" role="tablist" aria-label="Pick a day">
        <button
          v-for="day in currentWeek.days"
          :key="day.uuid"
          type="button"
          role="tab"
          :aria-selected="day.uuid === currentDayUuid"
          :class="[
            'day-pick border-2 border-black font-press text-[9px] py-2',
            day.uuid === currentDayUuid
              ? 'bg-pixel-gold text-black'
              : 'bg-pixel-bg-panel text-pixel-text'
          ]"
          @click="onPickDay(day.uuid)"
        >
          {{ dayShort(day.name) }}
        </button>
      </div>
    </div>

    <!--
      Phone-only focused day wrapper: renders ONLY the selected day, full
      width. Hidden above `sm`.
    -->
    <div
      v-if="focusedDay"
      class="sm:hidden daily-habit-grid mb-6"
    >
      <Day
        :key="focusedDay.uuid"
        :dayUuid="focusedDay.uuid"
        :day="focusedDay"
        :weekUuid="currentWeek.uuid"
        :name="focusedDay.name"
        :tasks="focusedDay.tasks"
        headerColor="var(--pp-gold-dk)"
        headerTextColor="var(--pp-black)"
        @toggle-task="onToggleTask"
        @add-task="onAddTask"
        @move-task="onMoveTask"
        @edit-task="onEditTask"
        @delete-task="onDeleteTask"
      />
    </div>

    <!--
      Tablet + desktop: all 7 days. Mobile-first base styling is the
      7-column grid (desktop). On tablet (`sm`-`lg`) it scrolls horizontally
      with a snap strip and 200 px min card width; on phone (`< sm`) the
      entire grid is hidden because the focused-day wrapper above handles it.
    -->
    <div class="daily-habit-grid day-grid-all hidden sm:grid">
      <Day
        v-for="day in currentWeek.days"
        :key="day.uuid"
        :dayUuid="day.uuid"
        :day="day"
        :weekUuid="currentWeek ? currentWeek.uuid : null"
        :name="day.name"
        :tasks="day.tasks"
        headerColor="var(--pp-gold-dk)"
        headerTextColor="var(--pp-black)"
        @toggle-task="onToggleTask"
        @add-task="onAddTask"
        @move-task="onMoveTask"
        @edit-task="onEditTask"
        @delete-task="onDeleteTask"
      />
    </div>
  </template>
</template>

<script setup lang="ts">
import { computed } from "vue";
import Day from "../Day.vue";

const props = defineProps<{
  currentWeek: any;
  currentDayUuid: string | null;
  hasPrevWeek: boolean;
  hasNextWeek: boolean;
  toggleTask: (taskUuid: string) => void;
  openCreateTaskForDay: (dayUuid: string) => void;
  moveTask: (payload: { taskUuid: string; toDayUuid: string }) => void;
  openEditTask: (taskUuid: string) => void;
  deleteSingleTask: (taskUuid: string) => void;
  setCurrentDay: (dayUuid: string) => void;
  prevWeek: () => void;
  nextWeek: () => void;
}>();

const focusedDay = computed(() => {
  if (!props.currentWeek?.days) return null;
  if (!props.currentDayUuid) return props.currentWeek.days[0] || null;
  return (
    props.currentWeek.days.find((d: any) => d.uuid === props.currentDayUuid) ||
    props.currentWeek.days[0] ||
    null
  );
});

function dayShort(name: string): string {
  return (name || "?").substring(0, 3).toUpperCase();
}

function onToggleTask(taskUuid: string) {
  props.toggleTask(taskUuid);
}
function onAddTask(dayUuid: string) {
  props.openCreateTaskForDay(dayUuid);
}
function onMoveTask(payload: { taskUuid: string; toDayUuid: string }) {
  props.moveTask(payload);
}
function onEditTask(taskUuid: string) {
  props.openEditTask(taskUuid);
}
function onDeleteTask(taskUuid: string) {
  props.deleteSingleTask(taskUuid);
}
function onPickDay(dayUuid: string) {
  props.setCurrentDay(dayUuid);
}
function onPrevWeek() {
  props.prevWeek();
}
function onNextWeek() {
  props.nextWeek();
}
</script>

<style lang="scss">
.daily-habit-grid {
  min-height: 46vh;
}

.day-grid-all {
  /* Desktop (>= 1024px): the original 7 equal columns.
     `display: grid` is intentionally omitted so Tailwind's `hidden` /
     `sm:grid` utilities control visibility on phones. */
  grid-template-columns: repeat(7, 1fr);
  gap: 0.25rem;
  margin-bottom: 1.5rem;
}

/* Tablet (640–1023px): horizontal scroll-snap strip, days >= 200px wide. */
@media (min-width: 640px) and (max-width: 1023.98px) {
  .day-grid-all {
    grid-template-columns: repeat(7, minmax(200px, 1fr));
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    -webkit-overflow-scrolling: touch;
  }

  .day-grid-all > * {
    scroll-snap-align: start;
  }
}

/* Phone day picker: full-height touch targets, width shared by 7 columns. */
.day-pick {
  min-height: 40px;
}

/* Tap-target enforcement below `lg`: anything we marked with `.pp-tap` is
   at least 40x40 so touch users get a fat enough hit area. Above `lg` we
   revert to the smaller desktop sizing. */
.pp-tap {
  min-height: 40px;
  min-width: 40px;
  line-height: 1.1;
}

@media (min-width: 1024px) {
  .pp-tap {
    min-height: auto;
    min-width: auto;
  }
}

</style>