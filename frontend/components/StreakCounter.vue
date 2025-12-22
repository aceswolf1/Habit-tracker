<template>
  <div
    style="
      background-color: #374151;
      border: 2px solid black;
      padding: 1rem;
      text-align: center;
    "
  >
    <div
      style="
        color: white;
        font-family: 'Press Start 2P', cursive;
        font-size: 0.875rem;
        margin-bottom: 0.5rem;
      "
    >
      {{ title }}
    </div>
    <div
      :style="{ color: color }"
      style="
        font-family: 'Press Start 2P', cursive;
        font-size: 1.25rem;
        display: flex;
        align-items: center;
        justify-content: center;
      "
    >
      <span v-if="icon" style="margin-right: 0.25rem">{{ icon }}</span>
      <span :style="{ fontSize: !icon ? '1.875rem' : '1.25rem' }">{{
        count
      }}</span>
    </div>
    <div
      style="
        color: #9ca3af;
        font-family: 'Press Start 2P', cursive;
        font-size: 0.75rem;
      "
    >
      {{ subtitle }}
    </div>
  </div>
</template>

<script setup>
defineProps({
  title: {
    type: String,
    required: true,
  },
  count: {
    type: [String, Number],
    required: true,
  },
  subtitle: {
    type: String,
    required: true,
  },
  icon: {
    type: String,
    default: null,
  },
  color: {
    type: String,
    default: "#4ade80", // Default green color
  },
});
</script>
