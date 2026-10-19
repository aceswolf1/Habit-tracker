<template>
  <!--
    V2 Combat Deck sidebar (contract §3, §7).
    At ≥ lg: a 256-px fixed column with the full nav + month switcher.
    Below lg: a slide-in menu with a scrim, opened by the header
    hamburger, closed by Escape or by clicking a nav link. The
    off-canvas state uses a fixed `overflow: hidden` clip layer
    (lesson from v0.5.1 — the closed drawer must never widen the page).
  -->
  <div
    class="app-sidebar-root"
    :class="{ 'app-sidebar-root--open': open }"
    :aria-hidden="!open && !isDesktop"
    :inert="!open && !isDesktop ? true : undefined"
  >
    <div
      v-if="!isDesktop"
      class="app-sidebar-scrim"
      @click="emit('close')"
    ></div>

    <aside class="app-sidebar">
      <!-- Logo block -->
      <div class="app-sidebar__logo">
        <div class="app-sidebar__logo-mark" aria-hidden="true">P</div>
        <div class="app-sidebar__logo-text">
          <div class="app-sidebar__logo-name">PIXEL PALADIN</div>
          <div class="app-sidebar__logo-sub">COMBAT DECK V2</div>
        </div>
      </div>

      <!-- Nav -->
      <nav class="app-sidebar__nav" aria-label="Primary navigation">
        <button
          type="button"
          class="app-sidebar__nav-item"
          :class="{ 'app-sidebar__nav-item--active': section === 'campaign' }"
          @click="onNav('campaign')"
        >
          <UiPpIcon name="grid_view" :size="18" />
          <span>CAMPAIGN</span>
        </button>
        <button
          type="button"
          class="app-sidebar__nav-item"
          :class="{ 'app-sidebar__nav-item--active': section === 'stats' }"
          @click="onNav('stats')"
        >
          <UiPpIcon name="military_tech" :size="18" />
          <span>STATS</span>
        </button>
        <!-- v2.2 (W3): Telemetry — cross-month trends, weekday rates, top
             habits, streak rollups. Lives alongside Campaign + Stats. -->
        <button
          type="button"
          class="app-sidebar__nav-item"
          :class="{ 'app-sidebar__nav-item--active': section === 'telemetry' }"
          @click="onNav('telemetry')"
          data-pp-nav-telemetry
        >
          <UiPpIcon name="insights" :size="18" />
          <span>TELEMETRY</span>
        </button>
        <!-- v2.3 (W3): Trophy Vault — achievements grid, finished-month
             certificates, chest history. The trophy icon is added by W2
             (contract §5); until then military_tech stands in. -->
        <button
          type="button"
          class="app-sidebar__nav-item"
          :class="{ 'app-sidebar__nav-item--active': section === 'vault' }"
          @click="onNav('vault')"
          data-pp-nav-vault
        >
          <UiPpIcon :name="trophyIcon" :size="18" />
          <span>TROPHY VAULT</span>
        </button>
      </nav>

      <!-- Month switcher -->
      <div class="app-sidebar__section">
        <div class="app-sidebar__section-label">CYCLES</div>
        <div class="app-sidebar__month-list" v-if="months.length">
          <button
            v-for="m in months"
            :key="m.uuid"
            type="button"
            class="app-sidebar__month"
            :class="{
              'app-sidebar__month--current': m.uuid === currentMonthUuid,
              'app-sidebar__month--finished': m.finished,
            }"
            :title="m.name"
            @click="onSelectMonth(m.uuid)"
          >
            <span class="app-sidebar__month-name">{{ m.name }}</span>
            <UiPpBadge v-if="m.finished" kind="done">FINISHED</UiPpBadge>
            <UiPpBadge v-else-if="m.uuid === currentMonthUuid" kind="active">
              ACTIVE
            </UiPpBadge>
          </button>
        </div>
        <div v-else class="app-sidebar__month-empty">
          NO CYCLES YET
        </div>
      </div>

      <!-- Cycle actions: New month / Set dates / Finish month -->
      <div class="app-sidebar__actions">
        <PpButton
          variant="primary"
          icon="add"
          :title="'New month'"
          @click="onNewMonth"
        >
          NEW MONTH
        </PpButton>
        <!--
          v2.1 (W3): "Set dates" surfaces only when there's an active,
          un-dated month. The same dialog handles New / Set / Clear;
          click is forwarded to the parent (app.vue) which opens the
          dialog in the correct mode.
        -->
        <PpButton
          v-if="hasMonth && !isFinished && !hasStartDate"
          variant="ghost"
          icon="event"
          :title="'Set dates'"
          data-pp-set-dates
          @click="onSetDates"
        >
          SET DATES
        </PpButton>
        <PpButton
          v-if="hasMonth && !isFinished"
          variant="critical"
          icon="flag"
          :title="'Finish month'"
          @click="onFinishMonth"
        >
          FINISH MONTH
        </PpButton>
      </div>

      <!-- Settings (anchored to the bottom) -->
      <div class="app-sidebar__footer">
        <PpButton
          variant="ghost"
          icon="settings"
          :title="'Settings'"
          @click="onSettings"
        >
          SETTINGS
        </PpButton>
      </div>
    </aside>
  </div>
</template>

<script setup lang="ts">
/*
 * V2 Combat Deck sidebar (contract §3).
 *
 * Renders the logo, primary nav (Campaign / Stats), a restyled month
 * switcher, New month / Finish month actions, and the Settings button.
 * Receives the current section ('campaign' | 'stats') from AppShell
 * and emits `update:section` on nav click. Closes itself on any nav
 * click below lg (the drawer must dismiss on navigation).
 *
 * The open/close state is owned by AppShell (parent). This component
 * only renders — it does not own the section state.
 */

import { onMounted, onBeforeUnmount } from "vue";
import UiPpIcon from "../ui/PpIcon.vue";
import UiPpBadge from "../ui/PpBadge.vue";
import PpButton from "../ui/PpButton.vue";
import "./AppSidebar.styles.scss";

const props = defineProps<{
  section: "campaign" | "stats" | "telemetry" | "vault";
  open: boolean;
  isDesktop: boolean;
  hasMonth: boolean;
  isFinished: boolean;
  /** v2.1 (W3): `hasStartDate` toggles the SET DATES button. */
  hasStartDate?: boolean;
  months: Array<{ uuid: string; name: string; finished: boolean }>;
  currentMonthUuid: string | null;
  refreshData: () => void;
  openSettings: () => void;
  newMonth: () => void;
  /** v2.1 (W3): opens NewMonthDialog in "setDates" mode. */
  setDates?: () => void;
  finishMonth: () => void;
}>();

const emit = defineEmits<{
  (e: "update:section", v: "campaign" | "stats" | "telemetry" | "vault"): void;
  (e: "update:open", v: boolean): void;
  (e: "close"): void;
  (e: "selectMonth", uuid: string): void;
}>();

// v2.3 (W3): `trophy` was added by W2 to the icon registry. Use it
// when available, fall back to `military_tech` for the rare case the
// icon list isn't yet shipped (e.g. mid-task).
import type { IconName } from "../ui/iconNames";
import { ICON_NAMES } from "../ui/iconNames";
const trophyIcon: IconName = ICON_NAMES.includes("trophy")
  ? "trophy"
  : "military_tech";

function onNav(v: "campaign" | "stats" | "telemetry" | "vault") {
  emit("update:section", v);
  if (!props.isDesktop) emit("update:open", false);
}

function onSelectMonth(uuid: string) {
  emit("selectMonth", uuid);
  if (!props.isDesktop) emit("update:open", false);
}

function onNewMonth() {
  props.newMonth();
  if (!props.isDesktop) emit("update:open", false);
}

function onSetDates() {
  props.setDates?.();
  if (!props.isDesktop) emit("update:open", false);
}

function onFinishMonth() {
  props.finishMonth();
  if (!props.isDesktop) emit("update:open", false);
}

function onSettings() {
  props.openSettings();
  if (!props.isDesktop) emit("update:open", false);
}

function onKey(e: KeyboardEvent) {
  if (e.key === "Escape" && props.open && !props.isDesktop) {
    emit("update:open", false);
  }
}

onMounted(() => {
  if (typeof window !== "undefined") {
    window.addEventListener("keydown", onKey);
  }
});
onBeforeUnmount(() => {
  if (typeof window !== "undefined") {
    window.removeEventListener("keydown", onKey);
  }
});
</script>

<!--
  All visual rules live in `AppSidebar.styles.scss` (imported at the top
  of the <script> block) so this .vue file stays under the 400-line cap.
-->

