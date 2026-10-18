/**
 * Thin FE re-export of shared strike-combo helpers (v2.2 contract §1).
 *
 * `shared/combos.js` is CJS (`module.exports = { … }`). See
 * `frontend/utils/sharedDates.ts` for the CJS→ESM pick pattern rationale.
 * W1 owns the canonical source; this module is the FE re-export layer so
 * `composables/useCampaignStats`, `stores/monthStore`, and the v2.2 UI
 * all reach the same `comboMultiplier` / `nextCombo` implementation.
 */

import * as combosModule from "#shared/combos";

type AnyModule = Record<string, any>;

const pick = <K extends string>(key: K): any =>
  (combosModule as unknown as AnyModule)[key] ??
  (combosModule as unknown as AnyModule).default?.[key];

export const COMBO_GAP_DAYS = pick("COMBO_GAP_DAYS") as number;
export const comboMultiplier = pick("comboMultiplier") as (combo: number) => number;
export const comboName = pick("comboName") as (combo: number) => string | null;
export const daysBetween = pick("daysBetween") as (isoA: string, isoB: string) => number;
export const nextCombo = pick("nextCombo") as (
  prevCompletedOn: string | null,
  prevCombo: number | null,
  completedOn: string,
) => number;

export default combosModule;