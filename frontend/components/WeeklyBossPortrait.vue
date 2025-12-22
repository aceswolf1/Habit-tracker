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
</style>
