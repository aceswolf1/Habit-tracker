/**
 * Pure Task constructors and the dedup check used by `monthStore.bulkAddTasks`.
 *
 * No store, no DOM, no API — these functions only know about `Task`
 * (from `frontend/types/index.ts`) and a shared recurrenceId pattern.
 *
 * The `t-…` UUID format matches the existing optimistic-add behavior:
 * `t-${Math.random().toString(36).slice(2)}`. We keep the exact shape so
 * we don't introduce a separate client-side UUID space.
 */

import type { Task } from "../types/index";

/** Generate an optimistic task UUID. Format: `t-<base36>`. */
export function generateTaskUuid(): string {
  return `t-${Math.random().toString(36).slice(2)}`;
}

/**
 * Recurrence id for bulk-add. Generates a fresh `rec-…` id when one is
 * not provided (this is the path new habits take).
 */
export function generateRecurrenceId(): string {
  return `rec-${Math.random().toString(36).slice(2)}`;
}

export interface TaskDraftInput {
  description: string;
  optional: boolean;
  legendary: boolean;
  /** Emoji icon (or undefined). */
  icon?: string;
  /** GIF URL (or undefined). */
  gifUrl?: string;
  /** Required for grouping recurring habits. */
  recurrenceId: string;
  /** Position within the day — pass the current tasks length for append. */
  order: number;
}

/**
 * Build a fresh Task draft (uuid = fresh, completed = false).
 * No persistence side effects.
 */
export function createTaskDraft(input: TaskDraftInput): Task {
  return {
    uuid: generateTaskUuid(),
    description: input.description,
    optional: input.optional,
    legendary: input.legendary,
    completed: false,
    recurrenceId: input.recurrenceId,
    order: input.order,
    icon: input.icon,
    gifUrl: input.gifUrl,
  };
}

export interface AddPayload {
  description: string;
  optional: boolean;
  legendary: boolean;
  icon?: string;
  gifUrl?: string;
}

/**
 * Equality test for the "same task already added this submit run" dedup
 * in `bulkAddTasks`. Mirrors the inline check that lived in the store:
 *
 *   - icon and gifUrl are only compared when supplied (undefined = "don't
 *     care, the existing visual is fine");
 *   - description/optional/legendary always participate in the match.
 */
export function isSameAddPayload(existing: Task, candidate: AddPayload): boolean {
  if (existing.description !== candidate.description) return false;
  if (existing.optional !== candidate.optional) return false;
  if (existing.legendary !== candidate.legendary) return false;
  if (candidate.icon && existing.icon !== candidate.icon) return false;
  if (candidate.gifUrl && existing.gifUrl !== candidate.gifUrl) return false;
  return true;
}
