<template>
  <div class="month-statistics">
    <!-- Hero Section -->
    <div class="hero-section">
      <div class="tier-badge" :class="`tier-${tierClass}`">
        <div class="tier-icon">{{ tierIcon }}</div>
        <div class="tier-text">{{ statistics?.finalTier || 'Bronze' }} TIER</div>
      </div>
      <div class="hero-stats">
        <StatCard
          title="Total XP"
          :value="`${statistics?.totalXP || 0} XP`"
          icon="⚔️"
          color="#ffd700"
        />
        <StatCard
          title="Completion"
          :value="`${statistics?.finalProgress || 0}%`"
          :subtitle="bonusText"
          icon="🎯"
          color="#4ade80"
        />
        <StatCard
          title="Perfect Days"
          :value="statistics?.totalPerfectDays || 0"
          subtitle="100% Completed"
          icon="✨"
          color="#a78bfa"
        />
        <StatCard
          title="Best Streak"
          :value="`${statistics?.longestStreak || 0} Days`"
          subtitle="Consecutive Perfect"
          icon="🔥"
          color="#fb923c"
        />
      </div>
    </div>

    <!-- Week Performance Section -->
    <div class="section-header">
      <h2>📊 WEEKLY PERFORMANCE</h2>
    </div>
    <div class="week-grid">
      <StatCard
        v-for="week in statistics?.weekStats || []"
        :key="week.weekUuid"
        :title="week.weekName"
        :value="`${week.progress}%`"
        :subtitle="`${week.requiredCompleted}/${week.requiredTotal} Tasks`"
        icon="🏰"
        :rank="getWeekRank(week)"
      />
    </div>

    <!-- Week Highlights -->
    <div class="highlights-grid">
      <StatCard
        title="Best Week"
        :value="statistics?.bestWeek?.weekName || 'N/A'"
        :subtitle="`${statistics?.bestWeek?.progress || 0}% Complete`"
        icon="🏆"
        rank="best"
      />
      <StatCard
        title="Worst Week"
        :value="statistics?.worstWeek?.weekName || 'N/A'"
        :subtitle="`${statistics?.worstWeek?.progress || 0}% Complete`"
        icon="⚠️"
        rank="worst"
      />
      <StatCard
        title="Consistency"
        :value="consistencyScore"
        :subtitle="`Std Dev: ${statistics?.weekConsistency?.toFixed(1) || 0}`"
        icon="📈"
        color="#8b5cf6"
      />
    </div>

    <!-- Task Insights Section -->
    <div class="section-header">
      <h2>✅ TASK INSIGHTS</h2>
    </div>
    <div class="task-stats-grid">
      <StatCard
        title="Required Tasks"
        :value="`${statistics?.requiredTasksCompleted || 0}/${statistics?.requiredTasksTotal || 0}`"
        :subtitle="`${statistics?.requiredCompletionRate || 0}% Complete`"
        icon="⚡"
        color="#ef4444"
      />
      <StatCard
        title="Optional Tasks"
        :value="`${statistics?.optionalTasksCompleted || 0}/${statistics?.optionalTasksTotal || 0}`"
        :subtitle="`${statistics?.optionalCompletionRate || 0}% Complete`"
        icon="💎"
        color="#3b82f6"
      />
      <StatCard
        title="Legendary Tasks"
        :value="statistics?.legendaryTasksCompleted || 0"
        subtitle="3x XP Earned"
        icon="👑"
        color="#fbbf24"
      />
      <StatCard
        title="Overall Rate"
        :value="`${statistics?.taskCompletionRate || 0}%`"
        :subtitle="`${statistics?.completedTasks || 0}/${statistics?.totalTasks || 0} Total`"
        icon="📋"
        color="#10b981"
      />
    </div>

    <!-- Best & Worst Habits -->
    <div class="habits-grid">
      <div class="habit-card best-habit" v-if="statistics?.bestHabit">
        <div class="habit-header">
          <span class="habit-badge">BEST HABIT</span>
        </div>
        <div class="habit-icon">{{ statistics.bestHabit.icon || '⭐' }}</div>
        <div class="habit-name">{{ statistics.bestHabit.description }}</div>
        <div class="habit-stat">
          <span class="habit-rate">{{ statistics.bestHabit.completionRate }}%</span>
          <span class="habit-count">{{ statistics.bestHabit.timesCompleted }}/{{ statistics.bestHabit.timesAppeared }}</span>
        </div>
      </div>

      <div class="habit-card worst-habit" v-if="statistics?.worstHabit">
        <div class="habit-header">
          <span class="habit-badge">NEEDS WORK</span>
        </div>
        <div class="habit-icon">{{ statistics.worstHabit.icon || '💪' }}</div>
        <div class="habit-name">{{ statistics.worstHabit.description }}</div>
        <div class="habit-stat">
          <span class="habit-rate">{{ statistics.worstHabit.completionRate }}%</span>
          <span class="habit-count">{{ statistics.worstHabit.timesCompleted }}/{{ statistics.worstHabit.timesAppeared }}</span>
        </div>
      </div>
    </div>

    <!-- Day of Week Analysis -->
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

    <!-- Achievement Summary -->
    <div class="achievement-section">
      <div class="achievement-title">🏅 ACHIEVEMENTS UNLOCKED</div>
      <div class="achievement-grid">
        <div class="achievement" v-if="(statistics?.finalProgress || 0) >= 100">
          <span class="achievement-icon">🎊</span>
          <span class="achievement-text">Month Completed!</span>
        </div>
        <div class="achievement" v-if="(statistics?.bonusPercentage || 0) > 0">
          <span class="achievement-icon">💯</span>
          <span class="achievement-text">+{{ statistics?.bonusPercentage }}% Bonus</span>
        </div>
        <div class="achievement" v-if="(statistics?.longestStreak || 0) >= 7">
          <span class="achievement-icon">🔥</span>
          <span class="achievement-text">Week Streak!</span>
        </div>
        <div class="achievement" v-if="(statistics?.requiredCompletionRate || 0) === 100">
          <span class="achievement-icon">⚡</span>
          <span class="achievement-text">Perfect Required!</span>
        </div>
        <div class="achievement" v-if="(statistics?.legendaryTasksCompleted || 0) > 0">
          <span class="achievement-icon">👑</span>
          <span class="achievement-text">Legendary Hero</span>
        </div>
      </div>
    </div>

    <!-- Footer Info -->
    <div class="stats-footer">
      <div class="finish-date">
        Completed on {{ formatDate(month?.finishedAt) }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import StatCard from './StatCard.vue';

interface Props {
  month: any;
  statistics: any;
}

const props = defineProps<Props>();

const tierClass = computed(() => {
  const tier = props.statistics?.finalTier || 'Bronze';
  return tier.toLowerCase();
});

const tierIcon = computed(() => {
  const tier = props.statistics?.finalTier || 'Bronze';
  switch (tier) {
    case 'Final': return '✨';
    case 'Champion': return '👑';
    case 'Gold': return '⚔️';
    case 'Silver': return '🏆';
    case 'Bronze': return '🏆';
    default: return '🏆';
  }
});

const bonusText = computed(() => {
  const bonus = props.statistics?.bonusPercentage || 0;
  return bonus > 0 ? `+${bonus}% Bonus!` : 'Base Progress';
});

const consistencyScore = computed(() => {
  const stdDev = props.statistics?.weekConsistency || 0;
  if (stdDev < 10) return 'Excellent';
  if (stdDev < 20) return 'Good';
  if (stdDev < 30) return 'Fair';
  return 'Variable';
});

function getWeekRank(week: any) {
  if (week.weekUuid === props.statistics?.bestWeek?.weekUuid) return 'best';
  if (week.weekUuid === props.statistics?.worstWeek?.weekUuid) return 'worst';
  return null;
}

function isBestDay(dayName: string) {
  return dayName === props.statistics?.bestDayOfWeek?.dayName;
}

function isWorstDay(dayName: string) {
  return dayName === props.statistics?.worstDayOfWeek?.dayName;
}

function formatDate(date: any) {
  if (!date) return 'Unknown';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}
</script>

<style scoped lang="scss">
.month-statistics {
  display: flex;
  flex-direction: column;
  gap: 2rem;
  animation: fadeIn 0.5s ease-in;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.hero-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
  padding: 2rem;
  background: linear-gradient(135deg, rgba(29, 78, 216, 0.2) 0%, rgba(139, 92, 246, 0.2) 100%);
  border: 3px solid #1d4ed8;
  box-shadow: 4px 4px 0 rgba(0, 0, 0, 0.8);
}

.tier-badge {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 1.5rem;
  border: 4px solid;
  box-shadow: 6px 6px 0 rgba(0, 0, 0, 0.8);
  min-width: 200px;
  text-align: center;
}

.tier-bronze { border-color: #cd7f32; background: rgba(205, 127, 50, 0.2); }
.tier-silver { border-color: #c0c0c0; background: rgba(192, 192, 192, 0.2); }
.tier-gold { border-color: #ffd700; background: rgba(255, 215, 0, 0.2); }
.tier-champion { border-color: #a78bfa; background: rgba(167, 139, 250, 0.2); }
.tier-final {
  border-color: #ffd700;
  background: rgba(255, 215, 0, 0.2);
  animation: final-tier-glow 2s ease-in-out infinite;
}

@keyframes final-tier-glow {
  0%, 100% {
    box-shadow: 6px 6px 0 rgba(0, 0, 0, 0.8), 0 0 20px rgba(255, 215, 0, 0.5);
  }
  50% {
    box-shadow: 6px 6px 0 rgba(0, 0, 0, 0.8), 0 0 40px rgba(255, 215, 0, 0.8);
  }
}

.tier-icon {
  font-size: 4rem;
}

.tier-text {
  font-family: 'Press Start 2P', cursive;
  font-size: 1.25rem;
  color: white;
  text-shadow: 3px 3px 0 #000;
}

.hero-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  width: 100%;
}

.section-header {
  margin-top: 1rem;
}

.section-header h2 {
  font-family: 'Press Start 2P', cursive;
  font-size: 1rem;
  color: #fbbf24;
  text-shadow: 2px 2px 0 #000;
  padding-bottom: 0.5rem;
  border-bottom: 3px solid #fbbf24;
}

.week-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
}

.highlights-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
}

.task-stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.habits-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1rem;
}

.habit-card {
  background-color: rgba(26, 32, 44, 0.9);
  border: 3px solid;
  padding: 1.5rem;
  box-shadow: 4px 4px 0 rgba(0, 0, 0, 0.8);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  text-align: center;
}

.best-habit {
  border-color: #ffd700;
  box-shadow: 4px 4px 0 rgba(0, 0, 0, 0.8), 0 0 20px rgba(255, 215, 0, 0.3);
}

.worst-habit {
  border-color: #ef4444;
}

.habit-header {
  width: 100%;
}

.habit-badge {
  font-family: 'Press Start 2P', cursive;
  font-size: 0.6rem;
  background-color: #ffd700;
  color: #000;
  padding: 0.5rem 1rem;
  border: 2px solid #000;
  box-shadow: 2px 2px 0 rgba(0, 0, 0, 0.5);
}

.worst-habit .habit-badge {
  background-color: #ef4444;
  color: white;
}

.habit-icon {
  font-size: 3rem;
}

.habit-name {
  font-family: 'Press Start 2P', cursive;
  font-size: 0.75rem;
  color: white;
  text-shadow: 2px 2px 0 #000;
  line-height: 1.4;
}

.habit-stat {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.habit-rate {
  font-family: 'Press Start 2P', cursive;
  font-size: 1.5rem;
  color: #fbbf24;
  text-shadow: 2px 2px 0 #000;
}

.habit-count {
  font-family: 'Press Start 2P', cursive;
  font-size: 0.6rem;
  color: #9ca3af;
  text-shadow: 1px 1px 0 #000;
}

.day-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 0.5rem;
}

.day-stat {
  background-color: rgba(26, 32, 44, 0.9);
  border: 3px solid #374151;
  padding: 1rem 0.5rem;
  box-shadow: 3px 3px 0 rgba(0, 0, 0, 0.8);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.best-day {
  border-color: #ffd700;
  box-shadow: 3px 3px 0 rgba(0, 0, 0, 0.8), 0 0 15px rgba(255, 215, 0, 0.3);
}

.worst-day {
  border-color: #ef4444;
}

.day-name {
  font-family: 'Press Start 2P', cursive;
  font-size: 0.6rem;
  color: #fbbf24;
  text-shadow: 1px 1px 0 #000;
}

.day-progress-bar {
  width: 100%;
  height: 1rem;
  background-color: #374151;
  border: 2px solid #000;
  position: relative;
  overflow: hidden;
}

.day-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6, #8b5cf6);
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
  color: #fbbf24;
}

.achievement-section {
  background: linear-gradient(135deg, rgba(167, 139, 250, 0.2) 0%, rgba(139, 92, 246, 0.3) 100%);
  border: 3px solid #a78bfa;
  padding: 1.5rem;
  box-shadow: 4px 4px 0 rgba(0, 0, 0, 0.8);
}

.achievement-title {
  font-family: 'Press Start 2P', cursive;
  font-size: 1rem;
  color: #fbbf24;
  text-shadow: 2px 2px 0 #000;
  margin-bottom: 1rem;
  text-align: center;
}

.achievement-grid {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 1rem;
}

.achievement {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background-color: rgba(26, 32, 44, 0.9);
  border: 2px solid #fbbf24;
  padding: 0.75rem 1.25rem;
  box-shadow: 3px 3px 0 rgba(0, 0, 0, 0.8);
}

.achievement-icon {
  font-size: 1.5rem;
}

.achievement-text {
  font-family: 'Press Start 2P', cursive;
  font-size: 0.65rem;
  color: white;
  text-shadow: 1px 1px 0 #000;
}

.stats-footer {
  text-align: center;
  padding: 1rem;
  border-top: 2px solid #374151;
}

.finish-date {
  font-family: 'Press Start 2P', cursive;
  font-size: 0.6rem;
  color: #9ca3af;
  text-shadow: 1px 1px 0 #000;
}
</style>
