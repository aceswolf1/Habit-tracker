/**
 * Thin FE re-export of shared scoring helpers (UB-13/14).
 *
 * `shared/scoring.js` is a CJS file (`module.exports = { … }`). See
 * `sharedProgress.ts` for the rationale on the namespace import.
 */

import * as scoringModule from "#shared/scoring";

type AnyModule = Record<string, any>;

const pick = <K extends string>(key: K): any =>
  (scoringModule as unknown as AnyModule)[key] ??
  (scoringModule as unknown as AnyModule).default?.[key];

export const getTierFromProgress = pick("getTierFromProgress") as (
  progress: number,
) => string;
export const getPointsForTier = pick("getPointsForTier") as (
  tier: string,
) => { required: number; optional: number };
export const calculateTaskPoints = pick("calculateTaskPoints") as (
  isOptional: boolean,
  currentProgress: number,
  isLegendary?: boolean,
) => number;
export const calculateMonthScore = pick("calculateMonthScore") as (
  month: any,
) => number;
export const TIER_POINTS = pick("TIER_POINTS");
export const TIER_THRESHOLDS = pick("TIER_THRESHOLDS");

export default scoringModule;
