import { defineStore } from "pinia";

/*
 * Settings store (V2).
 *
 * Owns the persisted UI preferences:
 *   - `useWeekVideos` / `setUseWeekVideos`  — localStorage `useWeekVideos`
 *   - `animateGifs`     / `setAnimateGifs`  — localStorage `animateGifs`
 *   - `campaignView`    / `setCampaignView` — localStorage `campaignView`
 *                                              (Spotlight vs 7D Grid)
 *
 * Plus the transient UI flags (not persisted):
 *   - `drawerOpen`      / `toggleDrawer`    — settings drawer visibility
 *
 * Wave B removed the legacy arcade-font state; V2 uses Space Grotesk +
 * JetBrains Mono and the SettingsDrawer no longer surfaces a font radio.
 */

export const useSettingsStore = defineStore("settings", {
  state: () => ({
    // Whether to use videos for week avatars (persisted to localStorage)
    useWeekVideos:
      typeof window !== "undefined" &&
      localStorage.getItem("useWeekVideos") === "true",
    // W5: play task GIF animations (MP4) when on screen. Off = still frames
    // only (useful on slow devices). Default on; persisted to localStorage.
    animateGifs:
      typeof window === "undefined" ||
      localStorage.getItem("animateGifs") !== "false",
    // Drawer open state (transient)
    drawerOpen: false,
    // V2: Campaign view preference (Spotlight vs 7D Grid). Default Spotlight.
    // Persisted to localStorage.
    campaignView:
      typeof window !== "undefined" &&
      localStorage.getItem("campaignView") === "grid"
        ? "grid"
        : "spotlight",
  }),
  actions: {
    setUseWeekVideos(val: boolean) {
      this.useWeekVideos = val;
      if (typeof window !== "undefined") {
        localStorage.setItem("useWeekVideos", val ? "true" : "false");
      }
    },
    setAnimateGifs(val: boolean) {
      this.animateGifs = val;
      if (typeof window !== "undefined") {
        localStorage.setItem("animateGifs", val ? "true" : "false");
      }
    },
    toggleDrawer(open?: boolean) {
      if (typeof open === "boolean") this.drawerOpen = open;
      else this.drawerOpen = !this.drawerOpen;
    },
    setCampaignView(view: "spotlight" | "grid") {
      this.campaignView = view;
      if (typeof window !== "undefined") {
        localStorage.setItem("campaignView", view);
      }
    },
  },
});