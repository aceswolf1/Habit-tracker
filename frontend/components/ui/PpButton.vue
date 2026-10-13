<template>
  <button
    :type="type"
    :class="classes"
    :disabled="disabled"
    :aria-label="ariaLabel"
    :aria-pressed="ariaPressed"
    @click="onClick"
  >
    <span v-if="iconLeft" class="pp-btn-icon">
      <UiPpIcon :name="iconLeft" :size="iconSize" :filled="filled" />
    </span>
    <span v-if="hasLabel" class="pp-btn-label"><slot /></span>
    <span v-else class="pp-btn-sr"><slot /></span>
  </button>
</template>

<script setup lang="ts">
/*
 * V2 Combat Deck button (contract §2).
 *
 * Variants:
 *   - primary  → solid cyan fill, dark text, cyan glow on hover.
 *   - critical → solid magenta fill, white text, magenta glow.
 *   - ghost    → transparent, 1px line border, white text.
 *   - micro    → 24×24 icon-only button (or 40×40 below lg so tap
 *                targets stay ≥ 40 px per W4b / W5 perf rules).
 *
 * Default slot is the label. Pass `icon` for an icon-only button (the
 * `title` prop is required for accessibility in that case so screen
 * readers get a name). Buttons without a label are padded to a square;
 * a labeled icon button renders as `[icon] [label]`.
 *
 * The `active` flag toggles a pressed state — used for sidebar nav,
 * view toggles, and filter chips. Disabled buttons drop opacity and
 * kill pointer events.
 */

import { computed } from "vue";
import type { IconName } from "./iconNames";

const props = withDefaults(
  defineProps<{
    variant?: "primary" | "critical" | "ghost" | "micro";
    icon?: IconName;
    iconSize?: number;
    filled?: boolean;
    active?: boolean;
    disabled?: boolean;
    type?: "button" | "submit";
    title?: string;
    ariaLabel?: string;
    ariaPressed?: boolean;
  }>(),
  {
    variant: "ghost",
    iconSize: 16,
    filled: false,
    active: false,
    disabled: false,
    type: "button",
  },
);

const emit = defineEmits<{
  (e: "click", event: MouseEvent): void;
}>();

const hasLabel = computed(() => !!props.title || !!props.ariaLabel || hasSlotContent());
function hasSlotContent(): boolean {
  // The slot is used for the label; if it's not set we render an
  // icon-only button. Vue's `<slot />` doesn't expose emptiness
  // synchronously, so we approximate via the icon prop + title/aria.
  return Boolean(props.icon == null && (props.title || props.ariaLabel));
}
const iconLeft = computed(() => props.icon);

const iconSize = computed(() => {
  if (props.variant === "micro") return props.iconSize ?? 16;
  return props.iconSize ?? 16;
});

const classes = computed(() => [
  "pp-btn",
  `pp-btn--${props.variant}`,
  {
    "pp-btn--active": props.active,
    "pp-btn--icon-only": !props.title && !props.ariaLabel,
    "pp-btn--has-icon": !!props.icon,
  },
]);

const ariaLabel = computed(() => props.ariaLabel ?? props.title ?? "");

function onClick(e: MouseEvent) {
  if (props.disabled) return;
  emit("click", e);
}
</script>

<style scoped>
/* V2 button — sharp, 1px line border, neon glow on hover, no animation. */
.pp-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-family: "Space Grotesk", system-ui, sans-serif;
  font-weight: 700;
  font-size: 0.75rem;
  line-height: 1;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 0.5rem 0.875rem;
  background: var(--pp-card);
  color: var(--pp-text);
  border: 1px solid var(--pp-line);
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
  transition: filter 0.15s ease, box-shadow 0.15s ease,
    background-color 0.15s ease, color 0.15s ease;
}

.pp-btn:hover:not(:disabled) {
  filter: brightness(1.08);
  border-color: var(--pp-cyan);
  box-shadow: 0 0 6px rgba(0, 240, 255, 0.35);
}

.pp-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  box-shadow: none;
}

/* Variants */
.pp-btn--primary {
  background: var(--pp-cyan);
  color: var(--pp-void);
  border-color: var(--pp-cyan);
}
.pp-btn--primary:hover:not(:disabled) {
  box-shadow: var(--pp-glow-cyan);
}

.pp-btn--critical {
  background: var(--pp-magenta);
  color: var(--pp-text);
  border-color: var(--pp-magenta);
}
.pp-btn--critical:hover:not(:disabled) {
  box-shadow: var(--pp-glow-magenta);
}

.pp-btn--ghost {
  background: transparent;
  color: var(--pp-text);
}
.pp-btn--ghost:hover:not(:disabled) {
  background: var(--pp-card);
}

.pp-btn--micro {
  width: 24px;
  height: 24px;
  padding: 0;
  background: transparent;
  border: 1px solid var(--pp-line);
  color: var(--pp-muted);
}
.pp-btn--micro:hover:not(:disabled) {
  color: var(--pp-cyan);
  border-color: var(--pp-cyan);
}

/* Tap-target ≥ 40 px below lg (contract §7 / W5 perf). */
@media (max-width: 1023.98px) {
  .pp-btn--micro {
    width: 40px;
    height: 40px;
  }
}

.pp-btn--icon-only {
  padding: 0.5rem;
}

.pp-btn--active {
  background: var(--pp-card-active);
  border-color: var(--pp-cyan);
  color: var(--pp-cyan);
  box-shadow: 0 0 6px rgba(0, 240, 255, 0.3);
}

.pp-btn-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.pp-btn-label {
  display: inline-block;
}

.pp-btn-sr {
  /* Visually hidden text for icon-only buttons that DO have a title. */
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (prefers-reduced-motion: reduce) {
  .pp-btn {
    transition: none;
  }
}
</style>
