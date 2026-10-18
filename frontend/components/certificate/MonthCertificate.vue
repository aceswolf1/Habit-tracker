<!--
  MonthCertificate.vue (v2.2 W2 contract §5).

  Modal that shows a V2-styled certificate for the just-finished month
  + a "DOWNLOAD PNG" button. Open from:
    - the `monthFinished` app event (handled by ModalsHost), or
    - the "Certificate" button on the finished month's Stats /
      HeroSection.

  The download path renders to a 1200×900 canvas via
  `renderCertificate.ts`. The visible DOM markup mirrors the canvas
  layout so screenshots look like the downloadable PNG.

  Optional prop `cycleUuid` — when set, the modal binds itself to the
  SHOWN cycle (so the Stats button can pre-select). When `null`, the
  modal uses the store's current month (`currentMonth`).
-->
<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="certificate-overlay fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-6"
      data-pp-certificate-overlay
      role="dialog"
      aria-modal="true"
      aria-labelledby="pp-cert-title"
  >
      <div
        class="absolute inset-0 bg-pp-void/85"
        aria-hidden="true"
        @click="onClose"
      ></div>

      <div
        class="certificate-modal relative max-w-[960px] w-full max-h-[90vh] overflow-y-auto bg-pp-panel border border-pp-line shadow-[0_0_24px_rgba(0,240,255,0.25)]"
      >
        <!-- Modal header -->
        <header class="flex items-center justify-between p-3 border-b border-pp-line bg-pp-card">
          <div class="flex flex-col gap-1">
            <span class="font-mono text-label-sm text-pp-cyan uppercase tracking-wider">
              Combat Deck // Certificate of Completion
            </span>
            <h2 id="pp-cert-title" class="font-display text-headline-md uppercase text-pp-text">
              {{ headerTitle }}
            </h2>
          </div>
          <button
            type="button"
            class="micro w-9 h-9 flex items-center justify-center bg-pp-panel text-pp-muted hover:text-pp-cyan hover:bg-pp-card-active transition-colors"
            aria-label="Close certificate"
            @click="onClose"
          >
            <PpIcon name="close" :size="18" />
          </button>
        </header>

        <div v-if="!hasMonth" class="p-8 flex flex-col items-center gap-3 text-center">
          <span class="font-display text-headline-sm text-pp-muted uppercase">
            No finished month available
          </span>
          <span class="font-mono text-label-md text-pp-muted uppercase max-w-md">
            Finish a cycle to unlock the certificate of completion.
          </span>
        </div>

        <div v-else class="p-3 sm:p-6 flex flex-col gap-4">
          <!-- The visible certificate preview. Mirrors the canvas layout. -->
          <div
            class="certificate-preview relative w-full bg-pp-void border border-pp-line font-display"
            data-pp-certificate-preview
          >
            <!-- Header bar -->
            <div class="flex items-start justify-between px-6 sm:px-10 pt-6">
              <div class="flex flex-col gap-1">
                <span class="font-display text-headline-md text-pp-cyan uppercase tracking-wider">
                  PIXEL PALADIN
                </span>
                <span class="font-mono text-label-sm text-pp-magenta uppercase tracking-wider">
                  Combat Deck // Certificate of Completion
                </span>
              </div>
              <span class="font-mono text-label-sm text-pp-muted uppercase">
                PIXEL PALADIN
              </span>
            </div>

            <!-- Title -->
            <div class="flex flex-col items-center gap-2 px-4 mt-6">
              <h3 class="font-display text-display-md uppercase text-pp-text tracking-wider text-center break-words">
                {{ month.name || 'Untitled Month' }}
              </h3>
              <span class="font-mono text-label-md text-pp-muted uppercase">
                Range: {{ rangeText }}
              </span>
            </div>

            <!-- Stat blocks -->
            <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 px-4 sm:px-6 mt-6">
              <div
                v-for="block in statBlocks"
                :key="block.label"
                class="flex flex-col gap-2 p-2 bg-pp-card border border-pp-line border-l-4"
                :style="{ borderLeftColor: block.color }"
              >
                <span class="font-mono text-label-sm text-pp-muted uppercase tracking-wider">
                  {{ block.label }}
                </span>
                <span
                  class="font-display text-headline-md uppercase"
                  :style="{ color: block.color }"
                >{{ block.value }}</span>
              </div>
            </div>

            <!-- Player footer -->
            <div class="flex flex-col sm:flex-row gap-4 items-center justify-between p-4 mt-6 bg-pp-card border-t border-pp-line">
              <div class="flex flex-col gap-1 min-w-0">
                <span class="font-mono text-label-sm text-pp-muted uppercase tracking-wider">
                  Operator
                </span>
                <span class="font-display text-headline-md text-pp-text uppercase truncate">
                  {{ playerNameLabel }}
                </span>
                <span class="font-mono text-label-sm text-pp-green uppercase font-bold">
                  {{ playerTitleLabel }}
                </span>
              </div>
              <div class="flex flex-col items-end gap-1">
                <span class="font-mono text-label-sm text-pp-muted uppercase tracking-wider">
                  Finished
                </span>
                <span class="font-mono text-headline-sm text-pp-text uppercase">
                  {{ finishedOnLabel }}
                </span>
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex flex-wrap items-center justify-between gap-2 px-1">
            <span class="font-mono text-label-sm text-pp-muted uppercase">
              PNG · 1200×900 · self-hosted fonts
            </span>
            <div class="flex flex-wrap gap-2">
              <button
                type="button"
                class="px-3 min-h-[40px] sm:min-h-0 sm:py-1 font-mono text-label-md uppercase tracking-wider bg-pp-panel text-pp-text border border-pp-line hover:border-pp-cyan hover:text-pp-cyan transition-colors"
                :disabled="downloading"
                data-pp-cert-close
                @click="onClose"
              >
                Close
              </button>
              <button
                type="button"
                class="px-3 min-h-[40px] sm:min-h-0 sm:py-1 font-display text-label-md uppercase tracking-wider bg-pp-cyan text-pp-void border border-pp-cyan hover:bg-pp-text transition-colors disabled:opacity-50"
                :disabled="downloading"
                data-pp-cert-download
                @click="onDownload"
              >
                <span v-if="downloading">Rendering…</span>
                <span v-else>Download PNG</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { storeToRefs } from "pinia";
import { useMonthStore } from "../../stores/monthStore";
import PpIcon from "../ui/PpIcon.vue";
import { certificateFilename, renderCertificateToBlob } from "./renderCertificate";
import { comboName } from "../../utils/sharedCombos";
import { todayIso } from "../../utils/sharedDates";

const props = defineProps<{
  open: boolean;
}>();
const emit = defineEmits<{
  (e: "close"): void;
}>();

const monthStore = useMonthStore();
const storeRefs: any = storeToRefs(monthStore as any);
const currentMonth = computed<any>(() => storeRefs.currentMonth?.value ?? null);

const hasMonth = computed(() => !!currentMonth.value);
const month = computed(() => currentMonth.value);

const headerTitle = computed(() => {
  const m = month.value;
  if (!m) return "Certificate of Completion";
  return `${m.name || "Untitled Month"} — Finished`;
});

// Date range — show "no dates" when undated, and the actual range when
// the cycle has `startDate` set (and a finish date).
const rangeText = computed(() => {
  const m = month.value;
  if (!m) return "—";
  const start = m.startDate || null;
  const end = m.finishedAt ? String(m.finishedAt).slice(0, 10) : (start || "—");
  if (!start) return "Undated campaign";
  return `${start} to ${end}`;
});

// Stats are derived from `month.statistics` (computed by backend in
// `finish`); missing fields fall back to "—".
const statBlocks = computed(() => {
  const stats = month.value?.statistics || {};
  return [
    {
      label: "Final Tier",
      value: (stats.finalTier || "Bronze").toUpperCase(),
      color: "var(--pp-cyan)",
    },
    {
      label: "Total XP",
      value: `${stats.totalXP ?? 0} XP`,
      color: "var(--pp-magenta)",
    },
    {
      label: "Perfect Days",
      value: `${stats.totalPerfectDays ?? 0}`,
      color: "var(--pp-green)",
    },
    {
      label: "Best Habit",
      value: stats.bestHabit?.description
        ? truncate(stats.bestHabit.description, 22)
        : "—",
      color: "var(--pp-amber)",
    },
    {
      label: "Best Strike",
      // stats.bestHabit is the cycle's "best habit" by completion rate;
      // the best STRIKE isn't a stat today, but `monthFinished` was
      // always followed by `fetchInsights()` so the data is available.
      // When `insights.combatLog` is non-empty the highest combo name
      // wins; otherwise fall back to "—".
      value: bestStrikeLabel.value || "—",
      color: "var(--pp-magenta)",
    },
  ];
});

// Best strike from `insights.habits` (max `bestCombo`).
const bestStrikeLabel = computed<string | null>(() => {
  const insights = monthStore.insights;
  const habits = Array.isArray(insights?.habits) ? insights!.habits : [];
  if (habits.length === 0) return null;
  let best = 0;
  for (const h of habits) {
    if (!h) continue;
    if ((h.bestCombo ?? 0) > best) best = h.bestCombo ?? 0;
  }
  if (best < 2) return null;
  // Reuse the shared helper to keep names in lockstep with rows/flash.
  return comboName(best);
});

const playerNameLabel = computed(() => {
  const dn = monthStore.displayName;
  return dn && typeof dn === "string" && dn.length > 0 ? dn : "Anonymous";
});

const playerTitleLabel = computed(() => {
  const info: any = monthStore.levelInfo;
  if (!info || typeof info !== "object") return "LVL 1";
  const lvl = info.level ?? 1;
  const t = (info.title || "RECRUIT").toUpperCase();
  return `LVL ${lvl} · ${t}`;
});

const finishedOnLabel = computed(() => {
  const fa = month.value?.finishedAt;
  if (!fa) return todayIso();
  // finishedAt is ISO with time; keep only the date prefix.
  return String(fa).slice(0, 10);
});

const downloading = ref(false);

async function onDownload() {
  if (downloading.value) return;
  const m = month.value;
  if (!m) return;
  downloading.value = true;
  try {
    if (typeof document !== "undefined" && (document as any).fonts?.ready) {
      // Best-effort: wait for self-hosted fonts so the canvas text
      // matches the visible preview. Safe to fail (e.g. SSR).
      try {
        await (document as any).fonts.ready;
      } catch {
        /* no-op */
      }
    }
    const blob = await renderCertificateToBlob({
      monthName: m.name || "Untitled Month",
      startDate: m.startDate || null,
      endDate: m.finishedAt ? String(m.finishedAt).slice(0, 10) : (m.startDate || null),
      finalTier: m.statistics?.finalTier || "Bronze",
      totalXP: Number(m.statistics?.totalXP || 0),
      perfectDays: Number(m.statistics?.totalPerfectDays || 0),
      bestHabit: m.statistics?.bestHabit?.description || null,
      bestStrike: bestStrikeLabel.value,
      playerName: playerNameLabel.value === "Anonymous" ? null : playerNameLabel.value,
      playerTitle: (() => {
        const info: any = monthStore.levelInfo;
        return info?.title || "RECRUIT";
      })(),
      playerLevel: (monthStore.levelInfo?.level ?? 1) as number,
      finishedOn: finishedOnLabel.value,
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = certificateFilename(m.name || "month");
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Revoke after a microtask so the browser has a chance to start
    // the download before the URL is freed.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[MonthCertificate] download failed", err);
  } finally {
    downloading.value = false;
  }
}

function onClose() {
  emit("close");
}

function truncate(s: string | null | undefined, n: number): string {
  if (!s) return "—";
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}
</script>

<style scoped>
.certificate-overlay {
  z-index: 1000;
}
.certificate-preview {
  /* 16:12, fits a 960px modal with comfortable gutters. */
  aspect-ratio: 4 / 3;
  padding: 1.25rem;
}
@media (max-width: 639.98px) {
  .certificate-preview {
    padding: 0.75rem;
  }
}
</style>
