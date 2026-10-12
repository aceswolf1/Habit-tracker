<template>
  <div>
    <div class="section-header">
      <h2>📅 DAY OF WEEK ANALYSIS</h2>
    </div>
    <div class="day-grid">
      <div
        v-for="day in statistics?.dayOfWeekStats || []"
        :key="day.dayName"
        class="day-stat"
        :class="{ 'best-day': isBestDay(day.dayName), 'worst-day': isWorstDay(day.dayName) }"
      >
        <div class="day-name">{{ day.dayName.substring(0, 3).toUpperCase() }}</div>
        <div class="day-progress-bar">
          <div class="day-progress-fill" :style="{ width: day.averageCompletion + '%' }"></div>
        </div>
        <div class="day-value">{{ day.averageCompletion }}%</div>
        <div class="day-perfect" v-if="day.perfectDays > 0">
          ✨ {{ day.perfectDays }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  statistics: any;
}>();

function isBestDay(dayName: string) {
  return dayName === props.statistics?.bestDayOfWeek?.dayName;
}
function isWorstDay(dayName: string) {
  return dayName === props.statistics?.worstDayOfWeek?.dayName;
}
</script>

<style scoped lang="scss">
.section-header {
  margin-top: 1rem;
}

.section-header h2 {
  font-family: 'Press Start 2P', cursive;
  font-size: 1rem;
  color: var(--pp-gold-acc);
  text-shadow: 2px 2px 0 #000;
  padding-bottom: 0.5rem;
  border-bottom: 3px solid var(--pp-gold-acc);
}

.day-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 0.5rem;
}

.day-stat {
  background-color: rgba(26, 32, 44, 0.9);
  border: 3px solid var(--pp-gray);
  padding: 1rem 0.5rem;
  box-shadow: 3px 3px 0 rgba(0, 0, 0, 0.8);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.best-day {
  border-color: var(--pp-gold);
  box-shadow: 3px 3px 0 rgba(0, 0, 0, 0.8), 0 0 15px rgba(255, 215, 0, 0.3);
}

.worst-day {
  border-color: var(--pp-danger);
}

.day-name {
  font-family: 'Press Start 2P', cursive;
  font-size: 0.6rem;
  color: var(--pp-gold-acc);
  text-shadow: 1px 1px 0 #000;
}

.day-progress-bar {
  width: 100%;
  height: 1rem;
  background-color: var(--pp-gray);
  border: 2px solid #000;
  position: relative;
  overflow: hidden;
}

.day-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--pp-blue-mid), var(--pp-purple));
  transition: width 0.3s ease;
}

.day-value {
  font-family: 'Press Start 2P', cursive;
  font-size: 0.7rem;
  color: white;
  text-shadow: 1px 1px 0 #000;
}

.day-perfect {
  font-size: 0.6rem;
  color: var(--pp-gold-acc);
}
</style>