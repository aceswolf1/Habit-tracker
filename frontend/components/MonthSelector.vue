<template>
  <div class="month-selector flex items-center gap-2 flex-wrap mb-4">
    <div
      v-for="m in months"
      :key="m.uuid"
      @click="selectMonth(m.uuid)"
      class="px-3 py-2 border-2 border-black cursor-pointer flex items-center gap-2"
      :class="[
        'transition-all text-xs font-mono',
        m.uuid === currentMonthUuid
          ? 'bg-yellow-400'
          : 'bg-gray-700 text-white',
        m.finished ? 'opacity-70' : 'hover:brightness-110',
      ]"
    >
      <span class="truncate max-w-[8rem]">{{ m.name }}</span>
      <span v-if="m.finished" title="Finished" class="text-sm">🔒</span>
    </div>
    <button
      @click="createMonth"
      class="px-3 py-2 border-2 border-black bg-blue-600 text-white text-xs font-mono hover:bg-blue-500"
    >
      + NEW MONTH
    </button>
  </div>
</template>
<script setup lang="ts">
import { computed } from "vue";
import { storeToRefs } from "pinia";
import { useMonthStore } from "@/stores/monthStore";

const monthStore = useMonthStore();
const { months, currentMonth, currentMonthUuid } = storeToRefs(
  monthStore as any
);
const monthsComputed = computed(() => months.value || []);

function selectMonth(uuid: string) {
  if (uuid === currentMonthUuid.value) return;
  monthStore.setCurrentMonth(uuid);
}
function createMonth() {
  const defaultName = new Date().toLocaleString("default", {
    month: "long",
    year: "numeric",
  });
  monthStore.createMonth(defaultName);
}
</script>
<style scoped>
.month-selector {
}
</style>
