/**
 * Single source of truth for PixelPaladin cycle + task types.
 *
 * These shapes mirror the authoritative W2b API contract
 * (`development/remediation-w2/orchestration-ctx/decisions/api-contract-v2.md`
 * §2 / §3 / §5) extended with the v2.1 contract (`development/v2-features/
 * orchestration-ctx/decisions/contract-v2.1.md`). Code that touches cycle
 * data — the store, services, and components — must import from this module
 * rather than redeclaring its own interfaces.
 *
 * Naming: the API speaks **cycle** everywhere. The exported `Month = Cycle`
 * alias is preserved only so existing component code that hasn't been renamed
 * yet keeps compiling; do not introduce new references to `Month`.
 */

// ---------- Domain model ----------

export type TaskTag = "common" | "rare" | "essential" | "defense";
export type TaskTimeOfDay = "morning" | "afternoon" | "evening" | "night";
export const TASK_TAGS = ["common", "rare", "essential", "defense"] as const;
export const TASK_TIMES_OF_DAY = ["morning", "afternoon", "evening", "night"] as const;

export interface Task {
  uuid: string;
  description: string;
  optional: boolean;
  completed: boolean;
  /** Legendary tasks award 3× score. */
  legendary?: boolean;
  /** Cluster tasks that belong to a single recurring habit. */
  recurrenceId?: string;
  /** Ordering within the day. */
  order?: number;
  /** Emoji icon for this task. */
  icon?: string;
  /** GIF URL from the Klipy API. */
  gifUrl?: string;
  /** W5: MP4 rendition of the same GIF (played instead of the GIF when set). */
  gifVideoUrl?: string;
  /** W5: JPG still frame of the same GIF (poster / paused frame). */
  gifStillUrl?: string;
  /** V2: optional free-form memo (≤ 280 chars) attached to the task. */
  notes?: string;
  /** v2.1: server-stamped completion timestamp (set on false→true, cleared on reverse). */
  completedAt?: string | null;
  /** v2.1 (D3): shared cluster id for the same recurring habit. */
  habitId?: string;
  /** v2.1 (D4): one of 'common' | 'rare' | 'essential' | 'defense'. */
  tag?: TaskTag;
  /** v2.1: estimated duration in minutes (1..1440). */
  durationMin?: number;
  /** v2.1: one of 'morning' | 'afternoon' | 'evening' | 'night'. */
  timeOfDay?: TaskTimeOfDay;
  /** v2.1: 24-hour HH:MM string; only meaningful on dated days. */
  dueTime?: string;
  /** v2.2: server-stamped local calendar date ('YYYY-MM-DD') of the
   * last completion. `null` when the task is currently un-completed. */
  completedOn?: string | null;
  /** v2.2: latest strike-combo level (>= 1 when completed). */
  combo?: number;
  /** v2.2: extra XP awarded on top of base for the latest completion. */
  comboBonus?: number;
}

export interface Day {
  uuid: string;
  name: string;
  subtitle: string;
  tasks: Task[];
}

export interface Week {
  uuid: string;
  name: string;
  subtitle: string;
  /** 0–100 — required-tasks-only completion percentage. */
  progress: number;
  conquered?: boolean;
  days: Day[];
}

/**
 * A finished-cycle rollup. Field names mirror what MonthStatistics.vue
 * already reads; each is optional because the backend computes them and
 * older cycles may not have every rollup populated.
 */
export interface Statistics {
  finalTier?: string;
  totalXP?: number;
  finalProgress?: number;
  totalPerfectDays?: number;
  longestStreak?: number;
  weekStats?: Array<{
    weekName: string;
    progress: number;
    conquered: boolean;
  }>;
  bestWeek?: { weekName: string; progress: number } | null;
  worstWeek?: { weekName: string; progress: number } | null;
  weekConsistency?: number;
  requiredTasksCompleted?: number;
  requiredTasksTotal?: number;
  requiredCompletionRate?: number;
  optionalTasksCompleted?: number;
  optionalTasksTotal?: number;
  optionalCompletionRate?: number;
  legendaryTasksCompleted?: number;
  taskCompletionRate?: number;
  completedTasks?: number;
  totalTasks?: number;
  bestHabit?: { description: string; completionRate: number } | null;
}

/**
 * Lightweight projection of a cycle returned by `GET /api/cycles`.
 * Excludes `weeks` and `statistics`. Suitable for selectors, summaries,
 * the month switcher, etc.
 */
export interface CycleSummary {
  uuid: string;
  name: string;
  subtitle?: string;
  /** 0–110 — base average + optional bonus. */
  progress: number;
  score: number;
  finished: boolean;
  createdAt: string;
  finishedAt?: string | null;
  /** v2.1: 'YYYY-MM-DD' Monday that the cycle starts on. Undated months get `null`. */
  startDate?: string | null;
}

/**
 * Full cycle payload returned by `GET /api/cycles/current`,
 * `GET /api/cycles/:id`, `POST /api/cycles`, and the `cycle` field embedded
 * in PATCH / finish responses.
 */
export interface Cycle extends CycleSummary {
  weeks: Week[];
  statistics?: Statistics | null;
}

/** Minimal known-namespace alias for code that still uses "Month". Prefer `Cycle`. */
export type Month = Cycle;

export interface Profile {
  uuid: string;
  lifetimeScore: number;
  /** v2.1: optional player display name (1..24 chars). `null` when unset. */
  displayName?: string | null;
}

/**
 * v2.1: level curve info returned by `shared/levels.levelInfo(lifetimeXp)`.
 * `xpForNext: null` + `progress: 100` once the player hits the ARCHON band.
 */
export interface LevelInfo {
  level: number;
  title: string;
  xpIntoLevel: number;
  xpForNext: number | null;
  progress: number;
}

// ---------- Envelope (contract §1) ----------

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: PaginationMeta;
}

export interface ApiFailure {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
}

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "CYCLE_FINISHED"
  | "INTERNAL"
  | string; // forward-compat — backend may add codes faster than the FE tracks them

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export interface PaginationMeta {
  total: number;
  limit: number;
  offset: number;
}

// ---------- PATCH body / result (contract §3, §4) ----------

export interface PatchResult {
  cycle: Cycle;
  pointsEarned: number;
  isLegendary: boolean;
  currentTier: string;
  /** v2.2: present when the LAST update in the request was an
   * `updateTasks` that completed a task. Carries the strike info the
   * FloatingPoints component flashes. */
  combo?: {
    taskUuid: string;
    combo: number;
    /** Display name (e.g. 'DOUBLE STRIKE'). `null` when combo === 1. */
    name: string | null;
    bonus: number;
  };
  /** v2.3: present when the PATCH earned new chests or unlocked
   *  achievements. The FE merges names by id on the next fetchRewards. */
  rewards?: PatchRewardEvent;
}

export interface FinishResult {
  cycle: Cycle;
  statistics: Statistics | null;
  alreadyFinished: boolean;
  /** v2.3: present when the finish unlocked a chest or achievement. */
  rewards?: PatchRewardEvent;
}

// ---------- Discriminated PATCH bodies (contract §4) ----------

export interface PatchAddTasks {
  type: "addTasks";
  additions: Array<{
    weekUuid: string;
    dayUuid: string;
    task: Pick<
      Task,
      | "description"
      | "optional"
      | "completed"
      | "legendary"
      | "uuid"
      | "recurrenceId"
      | "order"
      | "icon"
      | "gifUrl"
      | "gifVideoUrl"
      | "gifStillUrl"
      | "notes"
      | "habitId"
      | "tag"
      | "durationMin"
      | "timeOfDay"
      | "dueTime"
    >;
  }>;
}

export interface PatchUpdateTasks {
  type: "updateTasks";
  updates: Array<{
    uuid: string;
    description?: string;
    optional?: boolean;
    completed?: boolean;
    legendary?: boolean;
    icon?: string | null;
    gifUrl?: string | null;
    gifVideoUrl?: string | null;
    gifStillUrl?: string | null;
    /** V2: pass `null` to clear the notes field, omit to leave it alone. */
    notes?: string | null;
    order?: number;
    /** v2.1: pass a string to set; omit to leave alone. */
    habitId?: string;
    /** v2.1: pass null to clear, omit to leave alone. */
    tag?: TaskTag | null;
    durationMin?: number | null;
    timeOfDay?: TaskTimeOfDay | null;
    dueTime?: string | null;
  }>;
  /** v2.2: optional browser-local 'YYYY-MM-DD'. When present, used as
   * the task's `completedOn` stamp on a false→true flip; falls back to
   * the UTC date of `completedAt` otherwise. */
  clientDate?: string;
}

export interface PatchDeleteTasks {
  type: "deleteTasks";
  taskUuids?: string[];
  recurrenceId?: string;
}

export interface PatchMoveTasks {
  type: "moveTasks";
  taskUuid: string;
  targetDayUuid: string;
  targetIndex?: number;
}

/**
 * v2.1: edit a cycle's `name` and/or `startDate` without touching its
 * weeks. `startDate: null` clears the date. At least one key is required.
 */
export interface PatchUpdateCycle {
  type: "updateCycle";
  name?: string;
  startDate?: string | null;
}

export type PatchBody =
  | PatchAddTasks
  | PatchUpdateTasks
  | PatchDeleteTasks
  | PatchMoveTasks
  | PatchUpdateCycle;

// ---------- Profile PATCH body (v2.1) ----------

export interface ProfilePatch {
  displayName?: string | null;
}

// ---------- v2.3: rewards payload (contract §3) ----------

export type ChestRarity = 'common' | 'rare' | 'epic' | 'legendary';
export const CHEST_RARITIES = ['common', 'rare', 'epic', 'legendary'] as const;

export interface Chest {
  id: string;
  level: number;
  earnedAt: string;
  claimedAt: string | null;
  rarity: ChestRarity | null;
  credits: number | null;
}

export type AchievementSize = 'small' | 'medium' | 'large';
export const ACHIEVEMENT_SIZES = ['small', 'medium', 'large'] as const;

export interface Achievement {
  id: string;
  name: string;
  description: string;
  size: AchievementSize;
  credits: number;
  unlocked: boolean;
  unlockedAt: string | null;
  /** 0..1 — percent toward unlocking. UI shows locked rows as dimmed + bar. */
  progress: number;
  current: number;
  target: number;
}

export interface RewardsNextReward {
  level: number | null;
  xpRemaining: number | null;
}

export interface Rewards {
  credits: number;
  level: number;
  title: string;
  lifetimeScore: number;
  nextReward: RewardsNextReward;
  chests: Chest[];
  achievements: Achievement[];
}

/**
 * PATCH /:id and POST /:id/finish responses may carry a `rewards` field
 * when something new was earned. The names are NOT included server-side
 * (the FE merges by id against the rewards store on the next fetchRewards).
 */
export interface PatchRewardEvent {
  newChests: number[];
  newAchievements: Array<{
    id: string;
    credits: number;
  }>;
}

export interface ClaimChestResult {
  chest: Chest;
  credits: number;
}

// ---------- v2.2: insights payload (contract §3) ----------

export interface InsightsPerfectDays {
  current: number;
  longest: number;
}

export interface InsightsFinishedMonths {
  total: number;
  streak: number;
}

export interface InsightsHabit {
  habitKey: string;
  name: string;
  completions: number;
  currentCombo: number;
  bestCombo: number;
  lastCompletedOn: string | null;
}

export interface InsightsMonth {
  uuid: string;
  name: string;
  startDate: string | null;
  finished: boolean;
  progress: number;
  score: number;
  perfectDays: number;
  completionRate: number;
}

export interface InsightsCombatLogEntry {
  completedAt: string;
  completedOn: string;
  taskUuid: string;
  description: string;
  xp: number;
  combo: number | null;
  comboName: string | null;
  cycleUuid: string;
}

export interface Insights {
  perfectDays: InsightsPerfectDays;
  finishedMonths: InsightsFinishedMonths;
  habits: InsightsHabit[];
  months: InsightsMonth[];
  /** Mon..Sun (0..6) — % of tasks completed. */
  weekdayRates: number[];
  /** Last 7 days by `completedOn`, newest first, capped at 100. */
  combatLog: InsightsCombatLogEntry[];
}
