<!--
  TaskCompletionEffect.vue (W4 split, UB-55).

  Owns the sparkle / spark / particle / backdrop animation subtree that
  Task.vue mounts inside its `.task` root when `completed` is true.

  The parent passes an `effectKey` so the :key on the root div can be re-set
  to replay the animation each time the task is toggled to completed. Same
  SVG path / particle count / spark positions / DOM structure as before —
  the only change is the wrapper template now lives in this subcomponent.
-->
<template>
  <div class="completion-effect" :key="effectKey">
    <span class="spark" v-for="n in 3" :key="'s' + n"></span>
    <span class="backdrop"></span>
    <svg
      class="sparkle-core"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M14.187 8.096L15 5.25L15.813 8.096C16.023 8.831 16.417 9.501 16.958 10.041C17.498 10.582 18.168 10.976 18.903 11.186L21.75 12L18.904 12.813C18.169 13.023 17.499 13.417 16.959 13.958C16.418 14.498 16.024 15.168 15.814 15.903L15 18.75L14.187 15.904C13.977 15.169 13.583 14.499 13.042 13.959C12.502 13.418 11.832 13.024 11.097 12.814L8.25 12L11.096 11.187C11.831 10.977 12.501 10.583 13.041 10.042C13.582 9.502 13.976 8.832 14.186 8.097L14.187 8.096Z"
        stroke="#000"
        stroke-linecap="round"
        stroke-linejoin="round"
        :fill="goldFill"
      />
    </svg>
    <span
      aria-hidden="true"
      class="particle"
      v-for="n in 8"
      :key="'p' + n"
    ></span>
  </div>
</template>

<script setup>
import { computed } from "vue";

const goldFill = computed(() => "rgb(var(--pp-gold-rgb, 255 215 0))");
/** Replay key — bumped by parent (Task.vue) each completion. */
defineProps({
  effectKey: { type: [String, Number], required: true },
});
</script>

<style scoped>
.completion-effect {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: visible;
  z-index: 2;
}
.sparkle-core {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) scale(0);
  width: 2.25rem;
  height: 2.25rem;
  opacity: 0;
  animation: core-pop 950ms ease-out forwards;
  filter: drop-shadow(0 0 4px rgb(var(--pp-gold-rgb, 255 215 0))) drop-shadow(0 0 10px #ffefa3);
}
@keyframes core-pop {
  0% {
    transform: translate(-50%, -50%) scale(0.2) rotate(-20deg);
    opacity: 0;
  }
  40% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1) rotate(8deg);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.4) rotate(25deg);
  }
}

.spark {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0.65rem;
  height: 0.65rem;
  background: radial-gradient(
    circle at 30% 30%,
    #fff7d1 0%,
    rgb(var(--pp-gold-rgb, 255 215 0)) 60%,
    #c89900 100%
  );
  border-radius: 50%;
  transform: translate(-50%, -50%) scale(0);
  animation: spark-pop 900ms ease-out forwards;
  mix-blend-mode: screen;
}
.spark:nth-child(1) {
  animation-delay: 40ms;
  --tx: -140%;
  --ty: -40%;
}
.spark:nth-child(2) {
  animation-delay: 120ms;
  --tx: 90%;
  --ty: -110%;
}
.spark:nth-child(3) {
  animation-delay: 180ms;
  --tx: 120%;
  --ty: 60%;
}
@keyframes spark-pop {
  0% {
    transform: translate(-50%, -50%) scale(0);
    opacity: 0;
  }
  45% {
    opacity: 1;
  }
  60% {
    transform: translate(calc(-50% + var(--tx)), calc(-50% + var(--ty)))
      scale(1);
    opacity: 1;
  }
  100% {
    transform: translate(calc(-50% + var(--tx)), calc(-50% + var(--ty)))
      scale(0);
    opacity: 0;
  }
}

.backdrop {
  position: absolute;
  inset: 0;
  background: radial-gradient(
    circle at center,
    rgb(var(--pp-gold-rgb, 255 215 0) / 0.2) 0%,
    rgb(var(--pp-gold-rgb, 255 215 0) / 0.02) 70%,
    transparent 80%
  );
  opacity: 0;
  animation: backdrop-fade 1100ms ease-out forwards;
}
@keyframes backdrop-fade {
  0% {
    opacity: 0;
  }
  30% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}

.particle {
  position: absolute;
  width: 0.45rem;
  height: 0.45rem;
  background: radial-gradient(
    circle at center,
    #fffbe6 0%,
    rgb(var(--pp-gold-rgb, 255 215 0)) 70%,
    #a07000 100%
  );
  border-radius: 50%;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) scale(0.2);
  opacity: 0;
  animation: particle-move 1500ms ease-out forwards;
}
.particle:nth-of-type(1) {
  --ang: 15deg;
  --dist: 230%;
  animation-delay: 40ms;
}
.particle:nth-of-type(2) {
  --ang: 75deg;
  --dist: 190%;
  animation-delay: 90ms;
}
.particle:nth-of-type(3) {
  --ang: 140deg;
  --dist: 210%;
  animation-delay: 130ms;
}
.particle:nth-of-type(4) {
  --ang: 200deg;
  --dist: 200%;
  animation-delay: 170ms;
}
.particle:nth-of-type(5) {
  --ang: 260deg;
  --dist: 220%;
  animation-delay: 210ms;
}
.particle:nth-of-type(6) {
  --ang: 310deg;
  --dist: 180%;
  animation-delay: 250ms;
}
.particle:nth-of-type(7) {
  --ang: 330deg;
  --dist: 240%;
  animation-delay: 290ms;
}
.particle:nth-of-type(8) {
  --ang: 45deg;
  --dist: 250%;
  animation-delay: 330ms;
}
@keyframes particle-move {
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.2);
  }
  20% {
    opacity: 1;
  }
  55% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translate(
        calc(-50% + cos(var(--ang)) * var(--dist)),
        calc(-50% + sin(var(--ang)) * var(--dist))
      )
      scale(0.05);
  }
}

/* Fallback for browsers without trig in calc - degrade to outward scatter */
@supports not (transform: translate(calc(-50% + cos(10deg) * 10%), -50%)) {
  @keyframes particle-move {
    0% {
      opacity: 0;
      transform: translate(-50%, -50%) scale(0.2);
    }
    20% {
      opacity: 1;
    }
    55% {
      opacity: 1;
    }
    100% {
      opacity: 0;
      transform: translate(-50%, -250%) scale(0.05);
    }
  }
}

/* B-T5: under prefers-reduced-motion the completion burst is essentially
 * static — the sparkle still appears (so the completed-state is
 * visible) but nothing animates. */
@media (prefers-reduced-motion: reduce) {
  .completion-effect .sparkle-core,
  .completion-effect .spark,
  .completion-effect .backdrop,
  .completion-effect .particle {
    animation: none !important;
    transform: none !important;
    opacity: 0;
  }
}
</style>
