<template>
  <div
    class="weekly-boss-container"
    :class="{ active: isActive }"
    :data-progress="Math.round(progress / 10) * 10"
    @click="emit('set-current-week', weekUuid)"
  >
    <div class="boss-header" :class="{ conquered: conquered }">
      <div v-if="conquered" class="conquered-banner">CONQUERED</div>
    </div>
    <div class="weekly-boss-image">
      <img :src="imageSrc" :alt="weekName" />

      <!-- Holographic Call UI Overlay (only on active week) -->
      <div v-if="isActive" class="holo-overlay">
        <!-- Scan lines -->
        <div class="holo-scanlines"></div>

        <!-- Interference glitch effect -->
        <div class="holo-glitch"></div>

        <!-- UI Frame -->
        <div class="holo-frame">
          <!-- Top UI Bar -->
          <div class="holo-top-bar">
            <div class="holo-signal">
              <span class="signal-dot"></span>
              <span class="signal-dot"></span>
              <span class="signal-dot"></span>
              <span class="holo-text">SIGNAL</span>
            </div>
            <div class="holo-battery">
              <div class="battery-level"></div>
              <span class="holo-text">85%</span>
            </div>
          </div>

          <!-- Corner brackets -->
          <div class="holo-corner top-left"></div>
          <div class="holo-corner top-right"></div>
          <div class="holo-corner bottom-left"></div>
          <div class="holo-corner bottom-right"></div>

          <!-- Grid lines -->
          <div class="holo-grid-lines"></div>

          <!-- Data stream effect -->
          <div class="holo-data-stream">
            <div class="data-line"></div>
            <div class="data-line"></div>
            <div class="data-line"></div>
          </div>
        </div>

        <!-- Parallax layers -->
        <div class="holo-parallax-layer layer-1"></div>
        <div class="holo-parallax-layer layer-2"></div>
      </div>

      <div v-if="conquered" class="completion-badge">
        <div class="badge-content">
          <span class="crown-icon">👑</span>
          <span class="completion-text">COMPLETED</span>
        </div>
      </div>
    </div>
    <div class="week-label">{{ weekName }}</div>

    <!-- RPG Style Progress Bar -->
    <div class="rpg-progress-container">
      <div class="progress-label">
        <span>PROGRESS</span>
        <span :class="{ 'completed-text': conquered }">{{ progress }}%</span>
      </div>
      <div class="rpg-progress-bar-outer">
        <div
          class="rpg-progress-bar-inner"
          :style="[{ width: `${progress}%` }, progressBarColor]"
        >
          <div class="progress-glow"></div>
        </div>
        <div class="progress-markers">
          <div class="marker" v-for="n in 5" :key="n"></div>
        </div>
      </div>
      <div v-if="conquered" class="rpg-progress-complete">BOSS DEFEATED!</div>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  weekUuid: {
    type: String,
    required: true,
  },
  imageSrc: {
    type: String,
    required: true,
  },
  weekName: {
    type: String,
    required: true,
  },
  isActive: {
    type: Boolean,
    default: false,
  },
  progress: {
    type: Number,
    default: 0,
    validator: (value) => value >= 0 && value <= 100,
  },
  conquered: {
    type: Boolean,
    default: false,
  },
  subtitle: {
    type: String,
    default: "",
  },
});

const emit = defineEmits(["set-current-week"]);

const progressBarColor = computed(() => {
  // Red component decreases as progress increases
  const redComponent = Math.max(0, 200 - props.progress * 1.5);

  // Green component increases as progress increases
  const greenComponent = Math.min(185, props.progress * 1.85);

  return {
    background: `linear-gradient(to right, 
      rgb(${redComponent}, ${greenComponent}, 20),
      rgb(${redComponent - 20}, ${greenComponent + 20}, 40)
    )`,
  };
});
</script>

<style lang="scss" scoped>
.weekly-boss-container {
  text-align: center;
  position: relative;

  .boss-header {
    height: 0.25rem;
    background-color: #10b981;
    margin-bottom: 0.5rem;
    border: 2px solid black;
    position: relative;
    overflow: visible;

    &.conquered {
      background-color: #fbbf24;
      height: 0.5rem;
    }

    .conquered-banner {
      position: absolute;
      top: -1.5rem;
      left: 50%;
      transform: translateX(-50%);
      background-color: #dc2626;
      color: white;
      font-family: "Press Start 2P", cursive;
      font-size: 0.7rem;
      padding: 0.25rem 1rem;
      border: 2px solid black;
      z-index: 10;
      box-shadow: 0 0 10px rgba(220, 38, 38, 0.7);
      animation: float 3s ease-in-out infinite;
      text-shadow: 2px 2px 0 black;
    }
  }

  &.active {
    background-color: #f59e0b;
    border-bottom-right-radius: 20px;
    border-bottom-left-radius: 20px;
  }

  .weekly-boss-image {
    height: 30rem;
    margin: 0 auto;
    border: 2px solid black;
    background-color: #374151;
    position: relative;
    overflow: hidden;
    margin-bottom: 0.75rem;
    display: flex;
    align-items: baseline;
    justify-content: center;

    img {
      width: 100%;
      height: 100%;
      max-width: 100%;
      max-height: 100%;
      object-fit: cover;
    }

    .completion-badge {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: rgba(0, 0, 0, 0.6);

      .badge-content {
        background-color: #f59e0b;
        padding: 1rem 2rem;
        border: 3px solid black;
        transform: rotate(-15deg) scale(1.2);
        box-shadow: 0 0 20px rgba(251, 191, 36, 0.8);
        animation: pulse 2s infinite;

        .crown-icon {
          font-size: 2rem;
          margin-right: 0.5rem;
          display: inline-block;
        }

        .completion-text {
          font-family: "Press Start 2P", cursive;
          font-size: 1.25rem;
          color: black;
          font-weight: bold;
        }
      }
    }
  }

  .week-label {
    color: white;
    font-family: "Press Start 2P", cursive;
    font-size: 0.75rem;
    margin-bottom: 0.75rem;
  }

  // RPG Progress Bar Styles
  .rpg-progress-container {
    background-color: #1f2937;
    border: 2px solid black;
    padding: 0.5rem;
    border-radius: 2px;
  }

  .progress-label {
    display: flex;
    justify-content: space-between;
    color: white;
    font-family: "Press Start 2P", cursive;
    font-size: 0.7rem;
    margin-bottom: 0.5rem;

    .completed-text {
      color: #fbbf24;
    }
  }

  .rpg-progress-bar-outer {
    height: 1.25rem;
    background-color: #111827;
    border: 2px solid #4b5563;
    position: relative;
    overflow: hidden;
    margin-bottom: 0.25rem;
  }

  .rpg-progress-bar-inner {
    height: 100%;
    position: relative;
    transition: all 1s ease;

    &::before {
      content: "";
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 40%;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 0 0 50% 50%;
    }
  }

  .progress-glow {
    position: absolute;
    top: 0;
    right: 0;
    width: 20px;
    height: 100%;
    background: linear-gradient(
      to right,
      transparent,
      rgba(255, 255, 255, 0.6)
    );
    filter: blur(5px);
    animation: glow-move 2s infinite;
    mix-blend-mode: overlay;
  }

  .progress-markers {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    justify-content: space-between;
    padding: 0 5%;
    pointer-events: none;

    .marker {
      width: 1px;
      height: 100%;
      background-color: rgba(255, 255, 255, 0.3);

      &:first-child {
        opacity: 0;
      }
    }
  }

  .rpg-progress-complete {
    color: #fbbf24;
    font-family: "Press Start 2P", cursive;
    font-size: 0.75rem;
    margin-top: 0.5rem;
    animation: text-flicker 2s infinite;
    text-shadow: 0 0 5px #fbbf24;
  }
}

@keyframes pulse {
  0% {
    transform: rotate(-15deg) scale(1.2);
  }
  50% {
    transform: rotate(-15deg) scale(1.3);
  }
  100% {
    transform: rotate(-15deg) scale(1.2);
  }
}

@keyframes glow-move {
  0% {
    opacity: 0.5;
  }
  50% {
    opacity: 1;
  }
  100% {
    opacity: 0.5;
  }
}

@keyframes text-flicker {
  0% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
  100% {
    opacity: 1;
  }
}

@keyframes float {
  0% {
    transform: translateX(-50%) translateY(0);
  }
  50% {
    transform: translateX(-50%) translateY(-5px);
  }
  100% {
    transform: translateX(-50%) translateY(0);
  }
}

/* ==================== HOLOGRAPHIC CALL UI EFFECTS ==================== */

.holo-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 5;
  overflow: hidden;
}

/* Animated scan lines */
.holo-scanlines {
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    0deg,
    rgba(0, 255, 255, 0.03) 0px,
    rgba(0, 255, 255, 0.03) 1px,
    transparent 1px,
    transparent 2px
  );
  animation: scanlines-move 8s linear infinite;
  opacity: 0.6;
}

@keyframes scanlines-move {
  0% {
    transform: translateY(0);
  }
  100% {
    transform: translateY(20px);
  }
}

/* Glitch interference effect */
.holo-glitch {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(0, 255, 255, 0.1) 48%,
    rgba(0, 255, 255, 0.2) 50%,
    rgba(0, 255, 255, 0.1) 52%,
    transparent 100%
  );
  background-size: 200% 100%;
  animation: glitch-sweep 3s ease-in-out infinite;
  mix-blend-mode: screen;
}

@keyframes glitch-sweep {
  0%,
  100% {
    background-position: -200% 0;
    opacity: 0;
  }
  10% {
    opacity: 0.8;
  }
  20% {
    background-position: 200% 0;
    opacity: 0;
  }
}

/* Main holographic frame */
.holo-frame {
  position: absolute;
  inset: 0;
  border: 2px solid rgba(0, 255, 255, 0.4);
  box-shadow:
    0 0 10px rgba(0, 255, 255, 0.3),
    inset 0 0 10px rgba(0, 255, 255, 0.1);
  animation: holo-pulse 2s ease-in-out infinite;
}

@keyframes holo-pulse {
  0%, 100% {
    border-color: rgba(0, 255, 255, 0.4);
    box-shadow:
      0 0 10px rgba(0, 255, 255, 0.3),
      inset 0 0 10px rgba(0, 255, 255, 0.1);
  }
  50% {
    border-color: rgba(0, 255, 255, 0.6);
    box-shadow:
      0 0 20px rgba(0, 255, 255, 0.5),
      inset 0 0 20px rgba(0, 255, 255, 0.2);
  }
}

/* Top UI bar with signal and battery */
.holo-top-bar {
  position: absolute;
  top: 10px;
  left: 10px;
  right: 10px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: rgba(0, 20, 40, 0.8);
  border: 1px solid rgba(0, 255, 255, 0.3);
  backdrop-filter: blur(4px);
  font-family: 'Press Start 2P', monospace;
  font-size: 8px;
  color: #00ffff;
  text-shadow: 0 0 5px #00ffff;
}

.holo-signal {
  display: flex;
  align-items: center;
  gap: 4px;
}

.signal-dot {
  width: 4px;
  height: 4px;
  background: #00ffff;
  border-radius: 50%;
  box-shadow: 0 0 4px #00ffff;
  animation: signal-blink 1.5s ease-in-out infinite;
}

.signal-dot:nth-child(2) {
  animation-delay: 0.2s;
}

.signal-dot:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes signal-blink {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.3;
  }
}

.holo-battery {
  display: flex;
  align-items: center;
  gap: 6px;
  position: relative;
}

.battery-level {
  width: 20px;
  height: 10px;
  border: 1px solid #00ffff;
  position: relative;

  &::before {
    content: '';
    position: absolute;
    left: 1px;
    top: 1px;
    bottom: 1px;
    width: 70%;
    background: linear-gradient(90deg, #00ffff, #00cccc);
    box-shadow: 0 0 5px #00ffff;
  }

  &::after {
    content: '';
    position: absolute;
    right: -3px;
    top: 3px;
    width: 2px;
    height: 4px;
    background: #00ffff;
  }
}

.holo-text {
  color: #00ffff;
  text-shadow: 0 0 5px #00ffff;
  letter-spacing: 1px;
}

/* Corner brackets */
.holo-corner {
  position: absolute;
  width: 20px;
  height: 20px;
  border-color: #00ffff;
  border-style: solid;
  box-shadow: 0 0 5px rgba(0, 255, 255, 0.5);
}

.holo-corner.top-left {
  top: 5px;
  left: 5px;
  border-width: 2px 0 0 2px;
}

.holo-corner.top-right {
  top: 5px;
  right: 5px;
  border-width: 2px 2px 0 0;
}

.holo-corner.bottom-left {
  bottom: 5px;
  left: 5px;
  border-width: 0 0 2px 2px;
}

.holo-corner.bottom-right {
  bottom: 5px;
  right: 5px;
  border-width: 0 2px 2px 0;
}

/* Animated grid lines */
.holo-grid-lines {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(90deg, rgba(0, 255, 255, 0.05) 1px, transparent 1px),
    linear-gradient(0deg, rgba(0, 255, 255, 0.05) 1px, transparent 1px);
  background-size: 30px 30px;
  animation: grid-drift 20s linear infinite;
  opacity: 0.4;
}

@keyframes grid-drift {
  0% {
    background-position: 0 0;
  }
  100% {
    background-position: 30px 30px;
  }
}

/* Data stream lines */
.holo-data-stream {
  position: absolute;
  bottom: 60px;
  left: 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.data-line {
  height: 2px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    #00ffff 50%,
    transparent 100%
  );
  animation: data-flow 2s ease-in-out infinite;
  box-shadow: 0 0 4px #00ffff;
}

.data-line:nth-child(1) {
  width: 80px;
  animation-delay: 0s;
}

.data-line:nth-child(2) {
  width: 120px;
  animation-delay: 0.3s;
}

.data-line:nth-child(3) {
  width: 60px;
  animation-delay: 0.6s;
}

@keyframes data-flow {
  0%, 100% {
    opacity: 0.3;
    transform: scaleX(0.8);
  }
  50% {
    opacity: 1;
    transform: scaleX(1);
  }
}

/* Parallax layers for depth */
.holo-parallax-layer {
  position: absolute;
  inset: 0;
  background: radial-gradient(
    circle at var(--mouse-x, 50%) var(--mouse-y, 50%),
    rgba(0, 255, 255, 0.1) 0%,
    transparent 60%
  );
  opacity: 0;
  transition: opacity 0.5s ease;
  pointer-events: none;
}

.weekly-boss-container.active:hover .holo-parallax-layer {
  opacity: 1;
}

.holo-parallax-layer.layer-1 {
  animation: parallax-float-1 6s ease-in-out infinite;
}

.holo-parallax-layer.layer-2 {
  animation: parallax-float-2 8s ease-in-out infinite;
}

@keyframes parallax-float-1 {
  0%, 100% {
    transform: translate(0, 0) scale(1);
  }
  33% {
    transform: translate(5px, -5px) scale(1.02);
  }
  66% {
    transform: translate(-5px, 5px) scale(0.98);
  }
}

@keyframes parallax-float-2 {
  0%, 100% {
    transform: translate(0, 0) scale(1);
  }
  33% {
    transform: translate(-3px, 3px) scale(0.99);
  }
  66% {
    transform: translate(3px, -3px) scale(1.01);
  }
}

/* Enhanced active state with holographic glow */
.weekly-boss-container.active .weekly-boss-image {
  box-shadow:
    0 0 20px rgba(0, 255, 255, 0.4),
    0 0 40px rgba(0, 255, 255, 0.2),
    inset 0 0 20px rgba(0, 255, 255, 0.1);
  border-color: rgba(0, 255, 255, 0.5);
  animation: holo-glow 2s ease-in-out infinite;
}

@keyframes holo-glow {
  0%, 100% {
    box-shadow:
      0 0 20px rgba(0, 255, 255, 0.4),
      0 0 40px rgba(0, 255, 255, 0.2),
      inset 0 0 20px rgba(0, 255, 255, 0.1);
  }
  50% {
    box-shadow:
      0 0 30px rgba(0, 255, 255, 0.6),
      0 0 60px rgba(0, 255, 255, 0.3),
      inset 0 0 30px rgba(0, 255, 255, 0.15);
  }
}
</style>
