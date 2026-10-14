<!--
  NewMonthDialog.vue (v2.1, W3 owner).

  Single dialog used in three flavors:
    - "New month"   → create a fresh cycle with a name + Monday start.
    - "Set dates"   → retrofit startDate onto an existing UN-DATED active
                      cycle (sidebar "Set dates" + month-header CTA).
    - "Clear dates" → strip startDate from an existing DATED active cycle.
                      Available as a footer action while dated.

  The Monday rule (contract §5 W3 / shared/dates.js#isMonday): a non-Monday
  input is rejected inline with a one-click "Use Monday DD/MM/YYYY" fix
  that swaps the input for the prior week's Monday. The action button is
  disabled while the date is invalid; the helper fires only on Monday
  input. ToS: defaults to `mondayOf(today)` so a user picking today via
  the native date picker never lands on the wrong day unless they
  re-pick explicitly.

  Reuses `monthStore.createMonth(name, startDate)` and
  `monthStore.setCycleDates(startDate | null)` (W1 contract). While W1's
  store hasn't shipped, these calls still execute — they POST/PATCH the
  new contract fields and get a 400 `VALIDATION_ERROR` that we surface
  as a toast on reject.
-->
<template>
  <Transition name="nm-bounce">
    <div v-if="open" class="nm-root" role="dialog" aria-modal="true">
      <div class="nm-scrim" @click="emit('close')"></div>

      <div class="nm-sheet">
        <header class="nm-header">
          <span class="nm-title">{{ titleText }}</span>
          <button
            type="button"
            class="nm-close"
            aria-label="Close dialog"
            @click="emit('close')"
          >✕</button>
        </header>

        <form class="nm-form" @submit.prevent="submit">
          <!-- Name field (always shown) -->
          <label class="nm-field">
            <span class="nm-label">CYCLE NAME</span>
            <input
              ref="nameInput"
              v-model="nameValue"
              type="text"
              class="nm-input"
              maxlength="80"
              autocomplete="off"
              spellcheck="false"
              placeholder="OPTIONAL"
              aria-label="Cycle name"
            />
          </label>

          <!-- Date row (shown in all flavors; "Clear dates" mode disables it) -->
          <div v-if="flavor !== 'clearDatesOnly'" class="nm-field">
            <span class="nm-label">START DATE <span class="nm-help">— MONDAY</span></span>

            <div class="nm-date-row">
              <input
                v-model="dateValue"
                type="date"
                class="nm-input nm-input--date"
                :aria-invalid="dateError ? 'true' : 'false'"
                :aria-describedby="dateError ? 'nm-date-err' : undefined"
                :class="{ 'nm-input--err': dateError }"
                aria-label="Cycle start date (Monday)"
                @input="onDateInput"
                @change="onDateInput"
              />
              <button
                v-if="showMondayFix"
                type="button"
                class="nm-fix-btn"
                :title="`Use Monday ${formatHumanDate(mondayFixValue)}`"
                @click="acceptMondayFix"
              >
                USE MONDAY {{ formatHumanDate(mondayFixValue) }}
              </button>
            </div>

            <p
              v-if="dateError"
              id="nm-date-err"
              class="nm-error"
              role="alert"
            >
              {{ dateError }}
            </p>
          </div>

          <footer class="nm-footer">
            <button
              v-if="canClearDates"
              type="button"
              class="nm-btn nm-btn--danger"
              :disabled="submitting"
              @click="clearDates"
            >
              CLEAR DATES
            </button>
            <div class="nm-footer__right">
              <button
                type="button"
                class="nm-btn nm-btn--ghost"
                :disabled="submitting"
                @click="emit('close')"
              >CANCEL</button>
              <button
                v-if="flavor !== 'clearDatesOnly'"
                type="submit"
                class="nm-btn nm-btn--primary"
                :disabled="submitting || !canSubmit"
              >
                {{ submitLabel }}
              </button>
            </div>
          </footer>
        </form>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { useMonthStore } from "../../stores/monthStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { emitAppEvent } from "../../composables/useAppEvents";
// W1 shipped these; thin FE re-exports of `shared/dates.js` per the
// v2.1 contract §1. (`fmtHumanDate` is a local-only utility W3 owns.)
import {
  isIsoDate,
  isMonday as isMondayDate,
  mondayOf,
} from "../../utils/sharedDates";
import { formatHumanDate } from "../../utils/formatDate";

type Flavor = "newMonth" | "setDates" | "clearDatesOnly";

const props = withDefaults(
  defineProps<{
    open: boolean;
    /** Active cycle (if any). Needed for "set dates" / "clear dates" flavors. */
    cycle?: {
      uuid: string;
      name: string;
      startDate?: string | null;
      finished?: boolean;
    } | null;
    /** Pre-select which action we're handling. Auto-inferred if omitted. */
    mode?: Flavor;
  }>(),
  { cycle: null, mode: undefined as Flavor | undefined },
);

const emit = defineEmits<{
  (e: "close"): void;
  (e: "created", payload: { uuid: string; name: string; startDate: string }): void;
}>();

const store = useMonthStore();
const settings = useSettingsStore();
const storeRefs = storeToRefs(store as any);

// --- Local form state -----------------------------------------------------

const nameInput = ref<HTMLInputElement | null>(null);
const nameValue = ref("");
const dateValue = ref("");
const submitting = ref(false);

/** ISO date parsed from `dateValue` (empty string if invalid). */
const typedDate = computed(() => (isIsoDate(dateValue.value) ? dateValue.value : ""));

const flavor = computed<Flavor>(() => {
  if (props.mode) return props.mode;
  if (props.cycle?.uuid) return props.cycle.startDate ? "clearDatesOnly" : "setDates";
  return "newMonth";
});

const titleText = computed(() => {
  if (flavor.value === "setDates") return "SET CYCLE DATES";
  if (flavor.value === "clearDatesOnly") return "CYCLE DATES";
  return "NEW CYCLE";
});

const submitLabel = computed(() => {
  if (flavor.value === "setDates") return "SET START DATE";
  return "START CYCLE";
});

// --- Validation ----------------------------------------------------------

const dateError = computed<string | null>(() => {
  if (!dateValue.value) return null; // empty is allowed (undated new month)
  if (!isIsoDate(dateValue.value)) return "Enter a valid YYYY-MM-DD date.";
  if (!isMondayDate(dateValue.value as string)) {
    return `Pick a Monday — try ${formatHumanDate(mondayFixValue.value ?? typedDate.value)}.`;
  }
  return null;
});

const canSubmit = computed(() => !dateError.value && !submitting.value);

/**
 * The "USE MONDAY <date>" fix button surfaces only when the user has
 * typed a valid ISO date that is NOT a Monday. We compute the
 * suggested Monday off a real `Date` (not the ISO string) so the
 * shared `mondayOf(Date)` helper doesn't fall back to "today's Monday"
 * (W1 contract).
 */
const mondayFixValue = computed<string | null>(() => {
  if (!isIsoDate(dateValue.value)) return null;
  if (isMondayDate(dateValue.value)) return null;
  // Parse at UTC noon so any local TZ shift can't roll the weekday back.
  const [y, m, d] = dateValue.value.split("-").map(Number);
  return mondayOf(new Date(Date.UTC(y, m - 1, d, 12, 0, 0)));
});

const showMondayFix = computed(() => !!mondayFixValue.value);

const canClearDates = computed(
  () =>
    !!props.cycle?.uuid &&
    !!props.cycle?.startDate &&
    !props.cycle?.finished,
);

// --- Watchers ------------------------------------------------------------

// Seed defaults when the dialog opens (or when the cycle changes).
watch(
  () => [props.open, props.cycle?.uuid, storeRefs.profile?.value?.displayName] as const,
  ([openNow]) => {
    if (!openNow) return;
    // Name: blank for "new month" (we save `null` on submit if still empty)
    // or pre-fill with the current name for "set dates" so users can edit
    // in place.
    if (flavor.value === "setDates") {
      nameValue.value = props.cycle?.name || "";
    } else {
      nameValue.value = "";
    }
    // Date seed: existing startDate > today's Monday > blank.
    if (flavor.value === "setDates" && props.cycle?.startDate) {
      dateValue.value = props.cycle.startDate;
    } else {
      dateValue.value = mondayOf();
    }
    submitting.value = false;
    // Autofocus the name input on desktop; date picker on phone.
    nextTick(() => {
      if (typeof window === "undefined") return;
      if (window.innerWidth >= 640) nameInput.value?.focus();
    });
  },
  { immediate: true },
);

// --- Actions -------------------------------------------------------------

function onDateInput() {
  // The browser's date input may emit "" when cleared; keep raw string,
  // validation will surface the error.
}

function acceptMondayFix() {
  const v = mondayFixValue.value;
  if (!v) return;
  dateValue.value = v;
}

async function submit() {
  if (!canSubmit.value) return;
  submitting.value = true;
  const name = nameValue.value.trim() || "";
  const date = dateValue.value || ""; // may be empty (undated new month)
  const startDate = date && isMondayDate(date) ? date : "";

  try {
    if (flavor.value === "newMonth") {
      // W1 contract: `monthStore.createMonth(name?, startDate?)` returns
      // nothing in the type signature; the store swaps currentMonth on
      // success. We optimistically wait for that swap via fetchMonthData
      // so the parent can navigate to the new cycle on success.
      await (store as any).createMonth(name || undefined, startDate || undefined);
      const fresh = (store as any).getMonth;
      const uuid = typeof fresh === "function" ? store.currentMonth?.uuid || "" : "";
      emitAppEvent("toast", {
        type: "success",
        title: "CYCLE STARTED",
        message: startDate
          ? `Welcome to a dated cycle. Starts ${formatHumanDate(startDate)}.`
          : "Welcome to a new undated cycle.",
      });
      emit("created", { uuid, name: name || "", startDate });
      // Drawer auto-close is owned by the sidebar; we just close.
      emit("close");
    } else if (flavor.value === "setDates") {
      if (!props.cycle?.uuid) {
        emitAppEvent("toast", { type: "error", title: "NO CYCLE", message: "No active cycle to update." });
        return;
      }
      await (store as any).setCycleDates(startDate || null);
      emitAppEvent("toast", {
        type: "success",
        title: "DATES SET",
        message: startDate
          ? `Cycle now anchored on ${formatHumanDate(startDate)}.`
          : "Cycle dates cleared.",
      });
      emit("close");
    }
  } catch (err) {
    emitAppEvent("toast", {
      type: "error",
      title: "SAVE FAILED",
      message: err instanceof Error ? err.message : "Could not save cycle.",
    });
    settings.toggleDrawer(false);
  } finally {
    submitting.value = false;
  }
}

async function clearDates() {
  if (!props.cycle?.uuid || props.cycle.finished) return;
  if (typeof window !== "undefined") {
    const ok = window.confirm(
      "Clear the cycle's start dates? Day dates will become unavailable until you set them again.",
    );
    if (!ok) return;
  }
  submitting.value = true;
  try {
    await (store as any).setCycleDates(null);
    emitAppEvent("toast", {
      type: "info",
      title: "DATES CLEARED",
      message: "Day dates are hidden until you set them again.",
    });
    emit("close");
  } catch (err) {
    emitAppEvent("toast", {
      type: "error",
      title: "CLEAR FAILED",
      message: err instanceof Error ? err.message : "Could not clear dates.",
    });
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped src="./NewMonthDialog.styles.scss"></style>
