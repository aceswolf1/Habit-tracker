/**
 * Thin FE re-export of shared progress helpers (UB-13/14).
 *
 * `shared/progress.js` is a CJS file (`module.exports = { … }`) that lives
 * outside the FE bundle root. Vite's rollup-commonjs plugin synthesizes
 * named ESM exports from `module.exports` keys but NOT a synthetic default,
 * so we use a namespace import and pick fields off it. Both client and
 * server bundles resolve this via the `#shared/progress` alias declared in
 * `nuxt.config.ts`.
 */

import * as progressModule from "#shared/progress";

type AnyModule = Record<string, any>;

const pick = <K extends string>(key: K): any =>
  (progressModule as unknown as AnyModule)[key] ??
  (progressModule as unknown as AnyModule).default?.[key];

export const calculateProgress = pick("calculateProgress") as (
  cycle: any,
) => void;
export const calculateDayProgress =
  (pick("calculateDayProgress") as ((day: any) => number) | undefined) ??
  ((_day: any) => 0);
export const createEmptyMonth = pick("createEmptyMonth") as (
  name?: string,
) => any;
export const generateUuid = pick("generateUuid") as (
  prefix?: string,
) => string;

export default progressModule;
