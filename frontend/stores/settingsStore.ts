import { defineStore } from "pinia";

export const useSettingsStore = defineStore("settings", {
  state: () => ({
    // Whether to use videos for week avatars (persisted to localStorage)
    useWeekVideos:
      typeof window !== "undefined" && localStorage.getItem("useWeekVideos") === "true",
    // Drawer open state
    drawerOpen: false,
    // UI font choice: 'press' (Press Start 2P) or 'cyber' (cyberpunk style)
    // Ensure this is always a string (avoid `false` during SSR hydration)
    uiFont:
      typeof window !== "undefined"
        ? (localStorage.getItem("uiFont") || "press")
        : "press",
  }),
  actions: {
    setUseWeekVideos(val: boolean) {
      this.useWeekVideos = val;
      if (typeof window !== "undefined") {
        localStorage.setItem("useWeekVideos", val ? "true" : "false");
      }
    },
    toggleDrawer(open?: boolean) {
      if (typeof open === "boolean") this.drawerOpen = open;
      else this.drawerOpen = !this.drawerOpen;
    },
    setUiFont(choice: string) {
      this.uiFont = choice;
      if (typeof window !== "undefined") {
        localStorage.setItem("uiFont", choice);
      }
    },
  },
});
