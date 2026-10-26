/**
 * Thin FE re-export of `shared/labels.js` (custom task labels) so the task
 * dialog, rows and the day grouping normalize labels exactly like the API.
 */

import * as labelsModule from "#shared/labels";

type AnyModule = Record<string, any>;

const pick = <K extends string>(key: K): any =>
  (labelsModule as unknown as AnyModule)[key] ??
  (labelsModule as unknown as AnyModule).default?.[key];

export const MAX_LABELS = pick("MAX_LABELS") as number;
export const MAX_LABEL_LENGTH = pick("MAX_LABEL_LENGTH") as number;
export const normalizeLabel = pick("normalizeLabel") as (value: string) => string;
export const normalizeLabels = pick("normalizeLabels") as (values: string[]) => string[];
export const labelColorIndex = pick("labelColorIndex") as (label: string) => number;
export const collectLabels = pick("collectLabels") as (cycle: unknown) => string[];

export default labelsModule;
