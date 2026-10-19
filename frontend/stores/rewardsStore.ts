/**
 * v2.3 — Pinia store for the rewards payload (chests, achievements,
 * credits). Lives separate from `monthStore` because the latter is at
 * its 400-line cap (per task assignment §4). `applyRewardEvent` is a
 * tiny callable passed in from `cycleNetwork.ts` so the monthStore can
 * forward PATCH/finish `rewards` blocks without growing itself.
 *
 * Lifecycle:
 *   - `fetchRewards()` — pulls the synced payload from the BE.
 *   - `applyRewardEvent(rewards)` — applies the contract's PATCH/finish
 *     delta (newChests[] / newAchievements[]), then schedules a debounced
 *     refetch so the names + credit amounts land.
 *   - `claimChest(id)` — POST claim, then patch the local chest + credits.
 *
 * Events (composable side):
 *   - `chestEarned { count }`       — emitted from `applyRewardEvent`.
 *   - `achievementUnlocked { id, credits }` — emitted per row.
 */
import { defineStore } from "pinia";
import type { Rewards, PatchRewardEvent } from "../types/index";
import {
  ApiError,
  getRewards as apiGetRewards,
  claimChest as apiClaimChest,
} from "../services/cycleApi";
import { emitAppEvent } from "../composables/useAppEvents";

const EMPTY_REWARDS: Rewards = {
  credits: 0,
  level: 1,
  title: "RECRUIT",
  lifetimeScore: 0,
  nextReward: { level: 2, xpRemaining: 25 },
  chests: [],
  achievements: [],
};

const REFETCH_DEBOUNCE_MS = 1000;
let _refetchTimer: ReturnType<typeof setTimeout> | null = null;

export const useRewardsStore = defineStore("rewards", {
  state: () => ({
    rewards: null as Rewards | null,
    isLoading: false,
    error: null as string | null,
  }),

  getters: {
    /** Convenience getter the header badge uses. */
    unclaimedCount: (state): number => {
      if (!state.rewards) return 0;
      return state.rewards.chests.filter((c) => c && !c.claimedAt).length;
    },
    /** Credits the player currently has. 0 until the first fetch. */
    credits: (state): number => state.rewards?.credits ?? 0,
    /** Lives through Zustand-style copy so components don't reach into `rewards`. */
    chests: (state) => (state.rewards ? state.rewards.chests : []),
    achievements: (state) =>
      state.rewards ? state.rewards.achievements : [],
    nextReward: (state) => state.rewards?.nextReward ?? { level: 2, xpRemaining: 25 },
  },

  actions: {
    /**
     * Pull the synced rewards payload from the BE. Failures surface as
     * a soft error on this store (rewards are read-only cosmetics; we
     * never toast except when triggered by a user action).
     */
    async fetchRewards(): Promise<Rewards | null> {
      this.isLoading = true;
      this.error = null;
      try {
        const data = await apiGetRewards();
        this.rewards = data;
        return data;
      } catch (err) {
        this.error =
          err instanceof ApiError
            ? `${err.code}: ${err.message}`
            : String(err);
        // Keep the previous payload if any; otherwise fall back to an
        // empty placeholder so consumers don't crash.
        if (!this.rewards) this.rewards = { ...EMPTY_REWARDS };
        return this.rewards;
      } finally {
        this.isLoading = false;
      }
    },

    /**
     * `monthStore` calls this with the PATCH/finish `rewards` block.
     * Emits the toast events and schedules a debounced refetch so the
     * full payload (names, earned-at) lands within ~1 s.
     */
    applyRewardEvent(rewards?: PatchRewardEvent | null) {
      if (!rewards) return;
      const newChests = Array.isArray(rewards.newChests) ? rewards.newChests.length : 0;
      const newAchievements = Array.isArray(rewards.newAchievements)
        ? rewards.newAchievements
        : [];
      if (newChests > 0) {
        emitAppEvent("chestEarned", { count: newChests });
      }
      for (const a of newAchievements) {
        if (!a || !a.id) continue;
        emitAppEvent("achievementUnlocked", {
          id: a.id,
          name: "",
          credits: a.credits || 0,
        });
      }
      this.scheduleRefetch();
    },

    /** Debounced refetch coalesces multiple PATCH bursts. */
    scheduleRefetch() {
      if (_refetchTimer) clearTimeout(_refetchTimer);
      _refetchTimer = setTimeout(() => {
        _refetchTimer = null;
        // Fire-and-forget; fetchRewards swallows errors.
        this.fetchRewards().catch(() => undefined);
      }, REFETCH_DEBOUNCE_MS);
    },

    /**
     * POST claim. The BE guarantee is that a second claim of the same
     * chest returns 409 `ALREADY_CLAIMED`. We catch that specifically
     * and surface it as a toast so the UI doesn't double-credit.
     */
    async claimChest(chestId: string): Promise<boolean> {
      try {
        const r = await apiClaimChest(chestId);
        // Optimistic patch + refetch to align IDs/codes the FE has cached.
        if (r && r.chest) {
          if (this.rewards) {
            this.rewards = {
              ...this.rewards,
              credits: (this.rewards.credits || 0) + (r.credits || 0),
              chests: this.rewards.chests.map((c) =>
                c.id === r.chest.id ? { ...c, ...r.chest } : c,
              ),
            };
          }
          emitAppEvent("toast", {
            type: "success",
            title: "CHEST OPENED",
            message: `+${r.credits} ${r.credits === 1 ? "credit" : "credits"}`,
          });
        }
        // Re-pull the canonical payload so the credits balance lines up
        // with the BE truth in case of any update-side rounding.
        this.fetchRewards().catch(() => undefined);
        return true;
      } catch (err) {
        if (err instanceof ApiError) {
          if (err.code === "ALREADY_CLAIMED") {
            emitAppEvent("toast", {
              type: "info",
              title: "ALREADY CLAIMED",
              message: "That chest was already opened.",
            });
            return false;
          }
          if (err.code === "NOT_FOUND") {
            emitAppEvent("toast", {
              type: "info",
              title: "CHEST SYNCED",
              message: "Refreshing your chest list…",
            });
            this.fetchRewards().catch(() => undefined);
            return false;
          }
        }
        emitAppEvent("toast", {
          type: "error",
          title: "CLAIM FAILED",
          message: "Could not claim that chest. Try again.",
        });
        return false;
      }
    },
  },
});
