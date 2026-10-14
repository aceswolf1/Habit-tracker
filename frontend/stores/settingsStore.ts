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
    // v2.1 (W3): Sound FX master toggle. Persisted to localStorage.
    // Default OFF per the contract — we never surprise the user with audio.
    soundFx:
      typeof window !== "undefined" &&
      localStorage.getItem("soundFx") === "true",
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
    setSoundFx(val: boolean) {
      this.soundFx = val;
      if (typeof window !== "undefined") {
        localStorage.setItem("soundFx", val ? "true" : "false");
      }
    },
  },
});

/**
 * Re-read the persisted settings from `localStorage` and apply them to
 * the store. Pinia's SSR-deserialized state can't see `window`, so the
 * `state()` factory's `localStorage.getItem(...)` branch never fires
 * for the initial client hydration (the server always returned `false`).
 *
 * Call this from `app.vue#onMounted` (or any client-only hook) after
 * Pinia has hydrated. Each key is overwritten only when localStorage
 * has a recognisable value; missing keys keep their hydrated value.
 */
export function hydrateSettingsFromLocalStorage(): void {
  if (typeof window === "undefined") return;
  const store = useSettingsStore();
  const ls = window.localStorage;
  const readBool = (key: string): boolean | null => {
    const v = ls.getItem(key);
    if (v === "true") return true;
    if (v === "false") return false;
    return null;
  };
  const readStr = <T extends string>(key: string, allowed: readonly T[]): T | null => {
    const v = ls.getItem(key);
    if (v && (allowed as readonly string[]).includes(v)) return v as T;
    return null;
  };
  const v = readBool("useWeekVideos");
  if (v !== null) store.useWeekVideos = v;
  const a = readBool("animateGifs");
  if (a !== null) store.animateGifs = a;
  const c = readStr("campaignView", ["spotlight", "grid"] as const);
  if (c !== null) store.campaignView = c;
  const s = readBool("soundFx");
  if (s !== null) store.soundFx = s;
}