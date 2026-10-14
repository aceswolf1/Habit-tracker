/**
 * Thin FE re-export of shared date helpers (v2.1 contract §1).
 *
 * `shared/dates.js` is a CJS file (`module.exports = { … }`). The
 * authoritative implementation is owned by W1 (w1-data); this module is
 * the FE-side re-export layer that resolves the CJS namespace import
 * under both client (Vite + `pp-shared-cjs-dev` plugin) and Nitro SSR
 * (`@rollup/plugin-commonjs`). Same pattern as `sharedProgress.ts`.
 *
 * The `pick()` helper falls back to `.default[key]` so the module works
 * whether the transform synthesises named exports, only the ESM
 * `default`, or both.
 */

import * as datesModule from "#shared/dates";

type AnyModule = Record<string, any>;

const pick = <K extends string>(key: K): any =>
  (datesModule as unknown as AnyModule)[key] ??
  (datesModule as unknown as AnyModule).default?.[key];

export const isIsoDate = pick("isIsoDate") as (
  s: string,
) => boolean;
export const isMonday = pick("isMonday") as (
  isoDate: string,
) => boolean;
export const mondayOf = pick("mondayOf") as (
  date?: Date,
) => string;
export const dayDate = pick("dayDate") as (
  startDate: string | null | undefined,
  weekIndex: number,
  dayIndex: number,
) => string | null;
export const dayOfMonth = pick("dayOfMonth") as (
  isoDate: string,
) => number;
export const todayIso = pick("todayIso") as (
  now?: Date,
) => string;
export const findToday = pick("findToday") as (
  cycle: { startDate?: string | null } | null | undefined,
  now?: Date,
) => { weekIndex: number; dayIndex: number } | null;

export default datesModule;