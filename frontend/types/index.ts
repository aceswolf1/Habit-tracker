/**
 * Single source of truth for PixelPaladin cycle + task types.
 *
 * These shapes mirror the authoritative W2b API contract
 * (`development/remediation-w2/orchestration-ctx/decisions/api-contract-v2.md`
 * §2 / §3 / §5). Code that touches cycle data — the store, services, and
 * components — must import from this module rather than redeclaring its own
 * interfaces.
 *
 * Naming: the API speaks **cycle** everywhere. The exported `Month = Cycle`
 * alias is preserved only so existing component code that hasn't been renamed
 * yet keeps compiling; do not introduce new references to `Month`.
 */

// ---------- Domain model ----------

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
}

export interface FinishResult {
  cycle: Cycle;
  statistics: Statistics | null;
  alreadyFinished: boolean;
}

// ---------- Discriminated PATCH bodies (contract §4) ----------

export interface PatchAddTasks {
  type: "addTasks";
  additions: Array<{
    weekUuid: string;
    dayUuid: string;
    task: Pick<
      Task,
      "description" | "optional" | "completed" | "legendary" | "uuid" | "recurrenceId" | "order" | "icon" | "gifUrl" | "gifVideoUrl" | "gifStillUrl"
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
    order?: number;
  }>;
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

export type PatchBody =
  | PatchAddTasks
  | PatchUpdateTasks
  | PatchDeleteTasks
  | PatchMoveTasks;
