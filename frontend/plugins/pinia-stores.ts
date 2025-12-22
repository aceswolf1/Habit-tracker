import { useMonthStore } from "../stores/monthStore";

export default defineNuxtPlugin(async () => {
  const monthStore = useMonthStore();

  // Initialize the store with data from monthData.json
  // In a real-world scenario, you might want to fetch this data from an API
  // monthStore.fetchMonthData();
});
