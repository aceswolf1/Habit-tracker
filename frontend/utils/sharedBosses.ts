/**
 * Thin FE re-export of shared boss roster (v2.1 contract §1).
 *
 * See `sharedDates.ts` for the CJS→ESM pick pattern rationale. W1 owns
 * the canonical `shared/bosses.js`; this module is the FE re-export
 * layer so `components/campaign/WeekTabs.vue`, the cockpit, and the
 * level-up toast can all `import { bossForWeek } from "@/utils/sharedBosses"`.
 */

import * as bossesModule from "#shared/bosses";

type AnyModule = Record<string, any>;

const pick = <K extends string>(key: K): any =>
  (bossesModule as unknown as AnyModule)[key] ??
  (bossesModule as unknown as AnyModule).default?.[key];

export interface Boss {
  name: string;
  codename: string;
}

export const BOSSES = pick("BOSSES") as Boss[];
export const bossForWeek = pick("bossForWeek") as (
  weekIndex: number,
) => Boss;

export default bossesModule;