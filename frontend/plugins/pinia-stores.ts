import { useMonthStore } from "../stores/monthStore";

export default defineNuxtPlugin(async () => {
  const monthStore = useMonthStore();

  // Store is hydrated by components via /api/cycles (proxied to Express/Mongo).
  // monthStore.fetchMonthData();
});
