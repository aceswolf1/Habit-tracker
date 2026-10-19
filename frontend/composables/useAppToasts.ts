/**
 * App-level toasts (extracted from app.vue to keep it under 400 lines):
 *  - `notify` adapter used by ModalsHost on create/edit/delete;
 *  - typed app-event subscriptions: `toast`, `chestEarned`, `achievementUnlocked`.
 * Subscriptions are released on unmount.
 */
import { onBeforeUnmount, type Ref } from "vue";
import { onAppEvent } from "./useAppEvents";
import { useRewardsStore } from "../stores/rewardsStore";

type ToastType = "success" | "error" | "info" | "warning";
interface ToastHost {
  add: (t: { title: string; message: string; type: ToastType }) => void;
}

export function useAppToasts(toastRef: Ref<ToastHost | null | undefined>) {
  const rewardsStore = useRewardsStore();

  // Notify adapter object — ModalsHost calls these on create/edit/delete.
  const notify = {
    created: () =>
      toastRef.value?.add({
        title: "HABIT ADDED",
        message: "New quest accepted!",
        type: "success",
      }),
    updated: () =>
      toastRef.value?.add({
        title: "HABIT UPDATED",
        message: "Quest parameters modified.",
        type: "info",
      }),
    deleted: () =>
      toastRef.value?.add({
        title: "HABIT REMOVED",
        message: "Quest abandoned.",
        type: "warning",
      }),
    singleDelete: () =>
      toastRef.value?.add({
        title: "HABIT REMOVED",
        message: "Quest abandoned.",
        type: "warning",
      }),
  };

  // --- Typed event bus + legacy window listener (UB-54) ---
  function handleToast(detail: {
    type: "success" | "error" | "info" | "warning";
    title: string;
    message: string;
  }) {
    toastRef.value?.add({
      type: detail.type,
      title: detail.title,
      message: detail.message,
    });
  }

  const toastFromBus = onAppEvent("toast", handleToast);

  // --- v2.3 (W2) rewards toast bus -------------------------------------
  //
  // The rewards store emits `chestEarned {count}` and
  // `achievementUnlocked {id, name, credits}` whenever a PATCH/finish
  // unlocks a reward. The store does its own debounced refetch so the
  // chest/achievement payload lands ~1 s later. Our toast handlers wait
  // for the next refetch, then surface an enriched line per the
  // contract §5 spec.

  async function flushRewardsAndToast<T>(
    fn: () => Promise<T | null>,
  ): Promise<T | null> {
    try {
      return await fn();
    } catch {
      return null;
    }
  }

  async function handleChestEarned(payload: { count: number }) {
    const count = Math.max(0, Number(payload?.count) || 0);
    if (count <= 0) return;
    // Fetch fresh data so we can derive the newest chests' levels.
    await flushRewardsAndToast(() => rewardsStore.fetchRewards());
    // Newest N unclaimed chests = the just-earned ones.
    const newest = (rewardsStore.chests || [])
      .filter((c) => c && !c.claimedAt)
      .slice()
      .sort((a, b) => {
        const ta = a.earnedAt ? Date.parse(a.earnedAt) : 0;
        const tb = b.earnedAt ? Date.parse(b.earnedAt) : 0;
        return tb - ta;
      })
      .slice(0, count);
    for (const c of newest) {
      if (!c) continue;
      toastRef.value?.add({
        type: "success",
        title: "CHEST EARNED",
        message: `LVL ${c.level || 0} chest earned — open it in the vault.`,
      });
    }
    if (newest.length === 0) {
      // Fallback when we can't yet resolve a level: just show the count.
      toastRef.value?.add({
        type: "success",
        title: "CHEST EARNED",
        message: count === 1
          ? "A new chest is ready — open it in the vault."
          : `${count} new chests are ready — open them in the vault.`,
      });
    }
  }

  const chestEarnedUnsub = onAppEvent("chestEarned", handleChestEarned);

  async function handleAchievementUnlocked(payload: {
    id: string;
    name: string;
    credits: number;
  }) {
    const id = payload?.id || "";
    if (!id) return;
    // Re-fetch so the achievement row has its full name + credits row.
    await flushRewardsAndToast(() => rewardsStore.fetchRewards());
    const row = (rewardsStore.achievements || []).find(
      (a: any) => a && a.id === id,
    );
    const name = (row && row.name) || payload?.name || "Achievement";
    const credits = (row && row.credits) || payload?.credits || 0;
    toastRef.value?.add({
      type: "info",
      title: "ACHIEVEMENT",
      message: `${name} · +${credits} ◈`,
    });
  }

  const achievementUnsub = onAppEvent(
    "achievementUnlocked",
    handleAchievementUnlocked,
  );

  onBeforeUnmount(() => {
    toastFromBus();
    chestEarnedUnsub();
    achievementUnsub();
  });

  return { notify };
}
