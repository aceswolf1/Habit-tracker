/**
 * Thin FE re-export of shared rewards helpers (v2.3 contract §1).
 *
 * `shared/rewards.js` is CJS (`module.exports = { … }`). This file is
 * the FE-side re-export layer that resolves the CJS namespace import
 * under both client (Vite + `pp-shared-cjs-dev` plugin) and Nitro SSR
 * (`@rollup/plugin-commonjs`). Same pattern as `sharedLevels.ts`.
 *
 * The `pick()` helper falls back to `.default[key]` so the module
 * works whether the transform synthesises named exports, only the ESM
 * `default`, or both.
 */

import * as rewardsModule from "#shared/rewards";

type AnyModule = Record<string, any>;

const pick = <K extends string>(key: K): any =>
  (rewardsModule as unknown as AnyModule)[key] ??
  (rewardsModule as unknown as AnyModule).default?.[key];

export const CHEST_CREDITS = pick("CHEST_CREDITS") as {
  common: number;
  rare: number;
  epic: number;
  legendary: number;
};

export const chestOdds = pick("chestOdds") as (level: number) => {
  common: number;
  rare: number;
  epic: number;
  legendary: number;
};

export const rollRarity = pick("rollRarity") as (
  level: number,
  rand?: () => number,
) => "common" | "rare" | "epic" | "legendary";

export const nextRewardInfo = pick("nextRewardInfo") as (
  lifetimeXp: number,
) => { level: number | null; xpRemaining: number | null };

export default rewardsModule;
