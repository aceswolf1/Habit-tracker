<template>
  <div
    class="weekly-boss-container"
    :class="{ active: isActive }"
    :data-progress="Math.round(progress / 10) * 10"
    @click="emit('set-current-week', weekUuid)"
  >
    <div class="boss-header" :class="{ 'has-rank': hasRank }">
      <div v-if="hasRank" class="rank-banner" :data-rank="rankInfo.rank">
        RANK {{ rankInfo.rank }}
      </div>
    </div>
    <div class="weekly-boss-image">
      <img v-if="renderMode === 'image'" :src="imageSrc" :alt="weekName" />
      <video v-if="renderMode === 'video'" class="boss-subtitle-video" autoplay loop muted>
        <source :src="computedVideoSrc" type="video/mp4" />
      </video>

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

      <!-- Rank Badge Overlay -->
      <div v-if="hasRank" class="rank-badge-overlay" :data-rank="rankInfo.rank">
        <div class="rank-badge-container">
          <!-- Rank Letter -->
          <div class="rank-letter" :style="{ color: rankInfo.color, textShadow: `0 0 20px ${rankInfo.glow}` }">
            {{ rankInfo.rank }}
          </div>
          <!-- Percentage Badge -->
          <div class="percentage-badge" :style="{ background: rankInfo.gradient }">
            <span class="percentage-text">{{ progress }}%</span>
            <span class="completion-label">COMPLETE</span>
          </div>
          <!-- Particle burst effect -->
          <div class="rank-particles">
            <div class="particle" v-for="n in 12" :key="n"></div>
          </div>
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
      <div v-if="hasRank" class="rpg-progress-complete" :style="{ color: rankInfo.color, textShadow: `0 0 8px ${rankInfo.glow}` }">
        RANK {{ rankInfo.rank }} ACHIEVED!
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { useSettingsStore } from "../stores/settingsStore";

const props = defineProps({
  weekUuid: {
    type: String,
    required: true,
  },
  mode: {
    type: String,
    default: "image",
  },
  imageSrc: {
    type: String,
    required: true,
  },
  videoSrc: {
    type: String,
    default: "",
  },
  weekName: {
    type: String,
    required: true,
  },
  weekIndex: {
    type: [Number, String],
    required: false,
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

// Calculate rank based on progress percentage
const rankInfo = computed(() => {
  const p = props.progress;
  if (p >= 100) return { rank: 'S', threshold: 100, color: '#a855f7', gradient: 'linear-gradient(135deg, #a855f7, #ec4899, #f59e0b)', glow: 'rgba(168, 85, 247, 0.6)' };
  if (p >= 95) return { rank: 'A', threshold: 95, color: '#fbbf24', gradient: 'linear-gradient(135deg, #fbbf24, #f59e0b)', glow: 'rgba(251, 191, 36, 0.6)' };
  if (p >= 90) return { rank: 'B', threshold: 90, color: '#60a5fa', gradient: 'linear-gradient(135deg, #60a5fa, #3b82f6)', glow: 'rgba(96, 165, 250, 0.6)' };
  if (p >= 85) return { rank: 'C', threshold: 85, color: '#f97316', gradient: 'linear-gradient(135deg, #f97316, #ea580c)', glow: 'rgba(249, 115, 22, 0.6)' };
  if (p >= 80) return { rank: 'D', threshold: 80, color: '#9ca3af', gradient: 'linear-gradient(135deg, #9ca3af, #6b7280)', glow: 'rgba(156, 163, 175, 0.6)' };
  return null;
});

const hasRank = computed(() => rankInfo.value !== null);

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

// Settings-driven render mode and computed video src
const settings = useSettingsStore();

const renderMode = computed(() => {
  // If user enabled videos globally, prefer video backgrounds
  if (settings.useWeekVideos) return "video";
  return props.mode || "image";
});

const computedVideoSrc = computed(() => {
  if (settings.useWeekVideos) {
    // Prefer using numeric weekIndex to form filenames like week-1.mp4
    if (props.weekIndex !== undefined && props.weekIndex !== null) {
      const idx = Number(props.weekIndex) + 1;
      return `/videos/week-${idx}.mp4`;
    }
    // Fallback: slugify the weekName to a filename-friendly form
    const slug = String(props.weekName)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    return `/videos/${slug}.mp4`;
  }
  return props.videoSrc || "";
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

    &.has-rank {
      background-color: #fbbf24;
      height: 0.5rem;
    }

    .rank-banner {
      position: absolute;
      top: -1.5rem;
      left: 50%;
      transform: translateX(-50%);
      color: white;
      font-family: "Press Start 2P", cursive;
      font-size: 0.7rem;
      padding: 0.25rem 1rem;
      border: 3px solid black;
      z-index: 10;
      text-shadow: 2px 2px 0 black;
      animation: rank-float 3s ease-in-out infinite, rank-pulse 2s ease-in-out infinite;

      // Rank-specific colors
      &[data-rank="S"] {
        background: linear-gradient(135deg, #a855f7, #ec4899, #f59e0b);
        box-shadow: 0 0 20px rgba(168, 85, 247, 0.8), 0 0 40px rgba(236, 72, 153, 0.5);
        animation: rank-float 3s ease-in-out infinite, rank-pulse 2s ease-in-out infinite, rainbow-shift 3s linear infinite;
      }
      &[data-rank="A"] {
        background: linear-gradient(135deg, #fbbf24, #f59e0b);
        box-shadow: 0 0 20px rgba(251, 191, 36, 0.8);
      }
      &[data-rank="B"] {
        background: linear-gradient(135deg, #60a5fa, #3b82f6);
        box-shadow: 0 0 20px rgba(96, 165, 250, 0.8);
      }
      &[data-rank="C"] {
        background: linear-gradient(135deg, #f97316, #ea580c);
        box-shadow: 0 0 20px rgba(249, 115, 22, 0.8);
      }
      &[data-rank="D"] {
        background: linear-gradient(135deg, #9ca3af, #6b7280);
        box-shadow: 0 0 20px rgba(156, 163, 175, 0.6);
      }
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
    video {
      width: 100%;
      height: 100%;
      max-width: 100%;
      max-height: 100%;
      object-fit: cover;
      position: absolute;
      inset: 0;
    }

    .rank-badge-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(2px);
      z-index: 6;
    }

    .rank-badge-container {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
      animation: rank-reveal 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    }

    .rank-letter {
      font-family: "Press Start 2P", cursive;
      font-size: 8rem;
      font-weight: bold;
      line-height: 1;
      animation: rank-letter-pop 1s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
      text-shadow:
        3px 3px 0 black,
        -1px -1px 0 black,
        1px -1px 0 black,
        -1px 1px 0 black;
      filter: drop-shadow(0 0 30px currentColor);
    }

    .percentage-badge {
      padding: 0.75rem 1.5rem;
      border: 3px solid black;
      border-radius: 4px;
      display: flex;
      flex-direction: column;
      align-items: center;
      box-shadow:
        0 0 20px rgba(0, 0, 0, 0.5),
        inset 0 2px 0 rgba(255, 255, 255, 0.3);
      animation: badge-shimmer 2s ease-in-out infinite;

      .percentage-text {
        font-family: "Press Start 2P", cursive;
        font-size: 1.5rem;
        color: white;
        font-weight: bold;
        text-shadow: 2px 2px 0 black;
        margin-bottom: 0.25rem;
      }

      .completion-label {
        font-family: "Press Start 2P", cursive;
        font-size: 0.6rem;
        color: rgba(255, 255, 255, 0.9);
        text-shadow: 1px 1px 0 black;
        letter-spacing: 2px;
      }
    }

    .rank-particles {
      position: absolute;
      inset: 0;
      pointer-events: none;
      overflow: visible;

      .particle {
        position: absolute;
        width: 8px;
        height: 8px;
        background: white;
        border-radius: 50%;
        top: 50%;
        left: 50%;
        opacity: 0;
        animation: particle-burst 1.5s ease-out forwards;
        box-shadow: 0 0 10px currentColor;

        @for $i from 1 through 12 {
          &:nth-child(#{$i}) {
            animation-delay: #{$i * 0.05}s;
            $angle: #{$i * 30}deg;
            --particle-angle: #{$angle};
          }
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

/* ==================== RANK ANIMATIONS ==================== */

@keyframes rank-float {
  0% {
    transform: translateX(-50%) translateY(0);
  }
  50% {
    transform: translateX(-50%) translateY(-8px);
  }
  100% {
    transform: translateX(-50%) translateY(0);
  }
}

@keyframes rank-pulse {
  0%, 100% {
    transform: translateX(-50%) scale(1);
  }
  50% {
    transform: translateX(-50%) scale(1.05);
  }
}

@keyframes rainbow-shift {
  0% {
    filter: hue-rotate(0deg) brightness(1.1);
  }
  50% {
    filter: hue-rotate(20deg) brightness(1.2);
  }
  100% {
    filter: hue-rotate(0deg) brightness(1.1);
  }
}

@keyframes rank-reveal {
  0% {
    opacity: 0;
    transform: scale(0.5) rotate(-10deg);
  }
  60% {
    opacity: 1;
    transform: scale(1.1) rotate(2deg);
  }
  100% {
    opacity: 1;
    transform: scale(1) rotate(0deg);
  }
}

@keyframes rank-letter-pop {
  0% {
    opacity: 0;
    transform: scale(0) rotate(-45deg);
  }
  50% {
    opacity: 1;
    transform: scale(1.3) rotate(10deg);
  }
  70% {
    transform: scale(0.95) rotate(-5deg);
  }
  100% {
    opacity: 1;
    transform: scale(1) rotate(0deg);
  }
}

@keyframes badge-shimmer {
  0%, 100% {
    box-shadow:
      0 0 20px rgba(0, 0, 0, 0.5),
      inset 0 2px 0 rgba(255, 255, 255, 0.3);
  }
  50% {
    box-shadow:
      0 0 30px rgba(255, 255, 255, 0.4),
      inset 0 2px 0 rgba(255, 255, 255, 0.5);
  }
}

@keyframes particle-burst {
  0% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(0);
  }
  50% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform:
      translate(-50%, -50%)
      translate(
        calc(cos(var(--particle-angle, 0deg)) * 100px),
        calc(sin(var(--particle-angle, 0deg)) * 100px)
      )
      scale(1);
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
