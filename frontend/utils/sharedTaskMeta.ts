/**
 * Thin FE re-export of shared task metadata (v2.1 contract §1 / §5).
 *
 * Tags + times of day are a fixed list — they're authored in
 * `shared/taskMeta.js` so the BE validator and the FE dialog agree. W1
 * owns the canonical source; this module is the FE re-export layer so
 * `TaskModalDetails.vue`, `TaskRow.vue`, and `TaskTile.vue` can
 * `import { TAGS, TIMES_OF_DAY, isHHMM } from "@/utils/sharedTaskMeta"`.
 *
 * The `TaskTag` / `TaskTimeOfDay` TS aliases are re-declared in
 * `types/index.ts` (W1's surface) — components should import them
 * directly from there; this module exports `TAGS` / `TIMES_OF_DAY` /
 * `isHHMM` only.
 */

import * as taskMetaModule from "#shared/taskMeta";

type AnyModule = Record<string, any>;

const pick = <K extends string>(key: K): any =>
  (taskMetaModule as unknown as AnyModule)[key] ??
  (taskMetaModule as unknown as AnyModule).default?.[key];

export const TAGS = pick("TAGS") as readonly ("common" | "rare" | "essential" | "defense")[];
export const TIMES_OF_DAY = pick("TIMES_OF_DAY") as readonly ("morning" | "afternoon" | "evening" | "night")[];
export const isHHMM = pick("isHHMM") as (s: string) => boolean;

export default taskMetaModule;