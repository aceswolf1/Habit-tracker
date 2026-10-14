/**
 * Thin FE re-export of shared habit helpers (v2.1 contract §1 / D3).
 *
 * `shared/habits.js` is CJS (`module.exports = { … }`). See
 * `frontend/utils/sharedDates.ts` for the CJS→ESM pick pattern rationale.
 * W1 owns the canonical source; this module is the FE re-export layer so
 * `utils/cycleMutations.ts` and the v2.2 streaks module both reach the
 * same `habitKey` implementation.
 */

import * as habitsModule from "#shared/habits";

type AnyModule = Record<string, any>;

const pick = <K extends string>(key: K): any =>
  (habitsModule as unknown as AnyModule)[key] ??
  (habitsModule as unknown as AnyModule).default?.[key];

export const normalizeDescription = pick("normalizeDescription") as (
  s: string,
) => string;
export const habitKey = pick("habitKey") as (task: {
  habitId?: string;
  description?: string;
}) => string;
export const newHabitId = pick("newHabitId") as () => string;

export default habitsModule;
