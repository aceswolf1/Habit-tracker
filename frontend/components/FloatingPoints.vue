<!--
  FloatingPoints.vue (W1 restyle, V2 Combat Deck).

  Floating "+N XP" popup that anchors on the toggled task's DOM rect
  (queried via `[data-task-uuid]`) when a `pointsEarned` event fires.
  Single shared event-bus subscriber; elements auto-dismiss after a
  static duration.

  V2 styling:
    - Mono font, no legacy arcade font, no animated text glows.
    - Tier-colored text (cyan / amber / green / magenta).
    - Static `transform: translate(...)` for the float, no CSS
      `text-shadow` rainbow / no animated `filter: hue-rotate`.
    - Honors `prefers-reduced-motion: reduce` — fade in/out only.
-->
<template>
  <Teleport to="body">
    <div class="floating-points-container" aria-hidden="true">
      <TransitionGroup name="float">
        <div
          v-for="point in activePoints"
          :key="point.id"
          class="floating-point font-mono"
          :style="{
            left: point.x + 'px',
            top: point.y + 'px',
            '--float-offset-x': point.offsetX + 'px',
          }"
          :class="[
            point.kind === 'strike'
              ? 'floating-point--strike'
              : point.points > 0
                ? 'floating-point--positive'
                : 'floating-point--negative',
            point.isLegendary ? 'floating-point--legendary' : '',
            point.tier ? `floating-point--${point.tier.toLowerCase()}` : '',
          ]"
        >
          <span v-if="point.isLegendary" class="floating-point__icon" aria-hidden="true">★</span>
          <span v-if="point.kind === 'strike'" class="floating-point__strike" aria-hidden="true">⚡</span>
          <span v-if="point.kind === 'strike'" class="floating-point__value">
            {{ point.strikeName }}
          </span>
          <span v-if="point.kind === 'strike'" class="floating-point__label">
            +{{ point.bonus }}
          </span>
          <template v-else>
            <span class="floating-point__value">
              {{ point.points > 0 ? '+' : '' }}{{ point.points }}
            </span>
            <span class="floating-point__label">XP</span>
            <span v-if="point.isLegendary" class="floating-point__mult">3×</span>
          </template>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, onBeforeUnmount } from 'vue';
import { onAppEvent } from '../composables/useAppEvents';

interface FloatingPoint {
  id: number;
  /** Either an XP delta (pointsEarned) or a 0 placeholder when it's a strike flash. */
  points: number;
  x: number;
  y: number;
  offsetX: number;
  tier?: string;
  isLegendary?: boolean;
  /** v2.2: when 'strike', the popup renders a "DOUBLE STRIKE +5" style
   * line anchored on the just-checked task, instead of an XP number. */
  kind?: 'xp' | 'strike';
  strikeName?: string;
  bonus?: number;
}

const activePoints = ref<FloatingPoint[]>([]);
let pointIdCounter = 0;

const handlePointsEarned = (detail: { points: number; taskUuid?: string; tier?: string | null; isLegendary: boolean }) => {
  const { points, taskUuid, isLegendary } = detail;
  // `tier` from the dispatch site can be null (e.g. before the API response
  // arrives); the runtime treats null and undefined identically in the
  // template's `point.tier?.toLowerCase()` expression.
  const tier = detail.tier ?? undefined;

  // Try to find the task element to position the floating points
  const taskElement = document.querySelector(`[data-task-uuid="${taskUuid}"]`);

  let x = window.innerWidth / 2;
  let y = window.innerHeight / 2;

  if (taskElement) {
    const rect = taskElement.getBoundingClientRect();
    x = rect.left + rect.width / 2;
    y = rect.top + rect.height / 2;
  }

  // Add slight random horizontal offset for visual variety
  const offsetX = (Math.random() - 0.5) * 30;

  const newPoint: FloatingPoint = {
    id: pointIdCounter++,
    points,
    x,
    y,
    offsetX,
    tier,
    isLegendary,
    kind: 'xp',
  };

  activePoints.value.push(newPoint);

  // Remove after animation completes (2.5 seconds for legendary, 2 seconds for normal)
  const duration = isLegendary ? 2500 : 2000;
  setTimeout(() => {
    const index = activePoints.value.findIndex(p => p.id === newPoint.id);
    if (index !== -1) {
      activePoints.value.splice(index, 1);
    }
  }, duration);
};

// v2.2: subscribe to the typed `strike` event. Renders a "DOUBLE
// STRIKE +5"-style popup anchored on the just-checked row's DOM rect.
// Honors reduced motion (handled at the CSS level by the static
// transform keyframes — same as the XP variant).
const handleStrike = (detail: {
  taskUuid: string;
  combo: number;
  name: string | null;
  bonus: number;
}) => {
  const { taskUuid, name, bonus } = detail;
  const taskElement = document.querySelector(`[data-task-uuid="${taskUuid}"]`);
  let x = window.innerWidth / 2;
  let y = window.innerHeight / 2;
  if (taskElement) {
    const rect = taskElement.getBoundingClientRect();
    x = rect.left + rect.width / 2;
    y = rect.top + rect.height / 2;
  }
  const offsetX = (Math.random() - 0.5) * 30;
  // Defensive: never show a useless popup when `name` is missing.
  const strikeName = (name && name.length > 0) ? name : 'STRIKE';
  const safeBonus = Math.max(0, Math.round(Number(bonus) || 0));
  const newPoint: FloatingPoint = {
    id: pointIdCounter++,
    points: 0,
    x,
    y,
    offsetX,
    kind: 'strike',
    strikeName,
    bonus: safeBonus,
  };
  activePoints.value.push(newPoint);
  // Strike popup is short by spec: 1.4 s, then dismissed.
  const duration = 1400;
  setTimeout(() => {
    const index = activePoints.value.findIndex(p => p.id === newPoint.id);
    if (index !== -1) {
      activePoints.value.splice(index, 1);
    }
  }, duration);
};

// Typed-bus subscription (UB-54). Returned fn unsubscribes in onBeforeUnmount.
const unsubscribeXp = onAppEvent('pointsEarned', handlePointsEarned);
const unsubscribeStrike = onAppEvent('strike', handleStrike);

onBeforeUnmount(() => {
  unsubscribeXp();
  unsubscribeStrike();
});
</script>

<style scoped lang="scss">
.floating-points-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 9999;
}

.floating-point {
  position: absolute;
  font-family: "JetBrains Mono", ui-monospace, monospace;
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  white-space: nowrap;
  transform: translate(-50%, -50%);
  text-shadow: 0 0 6px rgba(0, 0, 0, 0.6);
}

.floating-point--positive {
  color: var(--pp-cyan);

  &.floating-point--bronze {
    color: var(--pp-bronze);
  }
  &.floating-point--silver {
    color: var(--pp-silver);
  }
  &.floating-point--gold {
    color: var(--pp-amber);
  }
  &.floating-point--champion {
    color: var(--pp-champion);
  }
  &.floating-point--final {
    color: var(--pp-cyan);
  }
}

.floating-point--negative {
  color: var(--pp-danger);
}

.floating-point--legendary {
  font-size: 1.25rem;
  color: var(--pp-magenta);
}

/* v2.2 strike popup: magenta-tinted, no tier, single popup per check.
   Static transform from the existing `@keyframes floatUp` keyframes —
   no extra animation here so reduced-motion still kills motion. */
.floating-point--strike {
  display: inline-flex;
  align-items: baseline;
  gap: 0.35rem;
  padding: 2px 8px;
  background: rgba(255, 0, 127, 0.22);
  border: 1px solid var(--pp-magenta);
  color: var(--pp-magenta);
  letter-spacing: 0.06em;
  font-size: 0.95rem;
}
.floating-point--strike .floating-point__strike {
  font-size: 0.95rem;
  color: var(--pp-magenta);
}
.floating-point--strike .floating-point__value {
  font-size: 1rem;
  font-weight: 800;
}
.floating-point--strike .floating-point__label {
  font-size: 0.85rem;
  opacity: 1;
  font-weight: 700;
}

.floating-point__icon {
  font-size: 1rem;
  color: var(--pp-magenta);
}

.floating-point__value {
  font-size: 1.1rem;
}

.floating-point__label {
  font-size: 0.75rem;
  opacity: 0.9;
}

.floating-point__mult {
  font-size: 0.7rem;
  background: var(--pp-magenta);
  color: var(--pp-void);
  padding: 0 0.4rem;
  border: 1px solid var(--pp-magenta);
}

/* Float-in / fade-out (static transitions only). */
.float-enter-active {
  animation: floatUp 2000ms ease-out;
}
.float-leave-active {
  animation: fadeOut 400ms ease-out forwards;
}

.floating-point--legendary.float-enter-active {
  animation-duration: 2500ms;
}

/*
  UB-56 / W4b: respect `prefers-reduced-motion`. The popup still appears
  (so users see the points earned) but does not float / fade.
*/
@media (prefers-reduced-motion: reduce) {
  .float-enter-active,
  .float-leave-active {
    animation: none !important;
  }
}

@keyframes floatUp {
  0% {
    transform: translate(calc(-50% + var(--float-offset-x, 0px)), -50%) scale(0.7);
    opacity: 0;
  }
  12% {
    transform: translate(calc(-50% + var(--float-offset-x, 0px)), -50%) scale(1.1);
    opacity: 1;
  }
  20% {
    transform: translate(calc(-50% + var(--float-offset-x, 0px)), -50%) scale(1);
  }
  100% {
    transform: translate(calc(-50% + var(--float-offset-x, 0px)), calc(-50% - 60px)) scale(1);
    opacity: 0;
  }
}

@keyframes fadeOut {
  to {
    opacity: 0;
  }
}
</style>