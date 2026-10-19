<!--
  CertificateGallery.vue (v2.3 / W3).

  Read-only grid of finished months. Each card shows the cycle name,
  finish date and total XP earned; clicking opens the existing
  MonthCertificate modal via the `openCertificate {cycleUuid}` event.

  We dispatch the event (not open the modal locally) so `ModalsHost`
  remains the single owner of the certificate — consistent with the
  `monthFinished` open path that the certificate already subscribes to.
-->
<template>
  <section class="vault-certificates">
    <header class="vault-certificates__header">
      <div class="vault-certificates__title-block">
        <h2 class="vault-certificates__title font-display">CERTIFICATES</h2>
        <p class="vault-certificates__subtitle font-mono">
          {{ finishedMonths.length }} FINISHED CYCLE{{ finishedMonths.length === 1 ? "" : "S" }}
        </p>
      </div>
    </header>

    <div v-if="finishedMonths.length === 0" class="vault-certificates__empty font-mono">
      <UiPpIcon name="shield" :size="22" />
      <p>Finish a cycle to unlock its certificate of completion.</p>
    </div>

    <div v-else class="vault-certificates__grid">
      <button
        v-for="(m, idx) in finishedMonths"
        :key="m.uuid"
        type="button"
        class="vault-certificate"
        :data-pp-cert-card="m.uuid"
        :data-pp-cert-index="idx"
        :aria-label="`Open certificate for ${m.name}`"
        @click="onOpen(m.uuid)"
      >
        <div class="vault-certificate__header">
          <span class="vault-certificate__eyebrow font-mono">CYCLE {{ idx + 1 }}</span>
          <UiPpBadge kind="done">FINISHED</UiPpBadge>
        </div>

        <h3 class="vault-certificate__name font-display">{{ m.name }}</h3>

        <div class="vault-certificate__meta font-mono">
          <div class="vault-certificate__meta-row">
            <span class="vault-certificate__meta-label">FINISHED</span>
            <span class="vault-certificate__meta-value">{{ formatDate(m.finishedAt) }}</span>
          </div>
          <div class="vault-certificate__meta-row">
            <span class="vault-certificate__meta-label">SCORE</span>
            <span class="vault-certificate__meta-value vault-certificate__meta-value--score">
              {{ m.score || 0 }} XP
            </span>
          </div>
          <div v-if="m.startDate" class="vault-certificate__meta-row">
            <span class="vault-certificate__meta-label">RANGE</span>
            <span class="vault-certificate__meta-value">{{ formatDate(m.startDate) }}</span>
          </div>
        </div>

        <footer class="vault-certificate__cta font-mono">
          <span>OPEN CERTIFICATE</span>
          <UiPpIcon name="chevron_right" :size="14" />
        </footer>
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import UiPpBadge from "../ui/PpBadge.vue";
import UiPpIcon from "../ui/PpIcon.vue";
import type { CycleSummary } from "../../types/index";
import { emitAppEvent } from "../../composables/useAppEvents";

const props = defineProps<{
  /** All cycles from `monthStore.months`. Finished ones get rendered as
   *  certificate cards; unfinished cycles are ignored so future ones
   *  won't show up until they're locked. */
  months: CycleSummary[];
}>();

const finishedMonths = computed(() =>
  Array.isArray(props.months) ? props.months.filter((m) => m && m.finished) : [],
);

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return String(iso).slice(0, 10);
}

function onOpen(cycleUuid: string) {
  // W3 spec: click → emit `openCertificate {cycleUuid}`. The ModalsHost
  // listener (W1 contract §4 / contract §5) opens the existing
  // MonthCertificate modal. We pass the cycleUuid so the bridge can
  // flip the active month before opening.
  emitAppEvent("openCertificate", { cycleUuid });
}
</script>

<style scoped>
.vault-certificates {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  min-width: 0;
}

.vault-certificates__header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
}

.vault-certificates__title {
  font-family: "Space Grotesk", system-ui, sans-serif;
  font-weight: 700;
  font-size: 1rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--pp-cyan);
  margin: 0;
}

.vault-certificates__subtitle {
  font-size: 0.65rem;
  color: var(--pp-muted);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  margin: 0.125rem 0 0;
}

.vault-certificates__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 2rem 1rem;
  text-align: center;
  font-size: 0.7rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--pp-muted);
  border: 1px dashed var(--pp-line);
  background: var(--pp-card);
}

.vault-certificates__grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.5rem;
}
@media (min-width: 640px) {
  .vault-certificates__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (min-width: 1024px) {
  .vault-certificates__grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

.vault-certificate {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.625rem 0.75rem;
  background: var(--pp-card);
  border: 1px solid var(--pp-line);
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s ease, box-shadow 0.15s ease,
    background-color 0.15s ease;
  color: inherit;
  min-width: 0;
}

.vault-certificate:hover {
  border-color: var(--pp-cyan);
  box-shadow: var(--pp-glow-cyan);
  background: var(--pp-card-active);
}

.vault-certificate:focus-visible {
  outline: 1px solid var(--pp-cyan);
  outline-offset: 2px;
}

.vault-certificate__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.vault-certificate__eyebrow {
  font-size: 0.55rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--pp-muted);
}

.vault-certificate__name {
  font-family: "Space Grotesk", system-ui, sans-serif;
  font-weight: 700;
  font-size: 0.95rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--pp-text);
  margin: 0;
  line-height: 1.2;
}

.vault-certificate__meta {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.6rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.vault-certificate__meta-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.vault-certificate__meta-label {
  color: var(--pp-muted);
}

.vault-certificate__meta-value {
  color: var(--pp-text);
}

.vault-certificate__meta-value--score {
  color: var(--pp-cyan);
}

.vault-certificate__cta {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--pp-line);
  font-size: 0.6rem;
  letter-spacing: 0.16em;
  color: var(--pp-cyan);
  text-transform: uppercase;
}

@media (prefers-reduced-motion: reduce) {
  .vault-certificate {
    transition: none;
  }
}
</style>
