/**
 * Thin FE re-export of shared level helpers (v2.1 contract §1).
 *
 * `shared/levels.js` is CJS (`module.exports = { … }`). See
 * `frontend/utils/sharedDates.ts` for the CJS→ESM pick pattern rationale.
 * W1 owns the canonical source; this module is the FE re-export layer so
 * the header, the level-up toast, and the FE's `LevelInfo` consumers all
 * import through the same `#shared` resolution path.
 */

import * as levelsModule from "#shared/levels";

type AnyModule = Record<string, any>;

const pick = <K extends string>(key: K): any =>
  (levelsModule as unknown as AnyModule)[key] ??
  (levelsModule as unknown as AnyModule).default?.[key];

export const levelInfo = pick("levelInfo") as (
  lifetimeXp: number | null | undefined,
) => {
  level: number;
  title: string;
  xpIntoLevel: number;
  xpForNext: number | null;
  progress: number;
};

export default levelsModule;
