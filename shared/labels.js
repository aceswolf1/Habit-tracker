/**
 * Custom task labels (e.g. HEALTH, WORK, STUDY) — shared by backend + frontend.
 *
 * Labels are free text the user creates. They are separate from the fixed
 * rarity `tag` (common/rare/essential/defense).
 *
 * Rules:
 *   - trimmed, inner whitespace collapsed, upper-cased;
 *   - 1..MAX_LABEL_LENGTH characters after normalization;
 *   - at most MAX_LABELS per task, duplicates removed (first one wins).
 */

'use strict';

const MAX_LABELS = 5;
const MAX_LABEL_LENGTH = 24;
const LABEL_HUES = 8; // number of colour slots the UI cycles through

function normalizeLabel(value) {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/\s+/g, ' ').toUpperCase().slice(0, MAX_LABEL_LENGTH);
}

/** Normalize a list: drop empties, de-duplicate, cap at MAX_LABELS. */
function normalizeLabels(values) {
  if (!Array.isArray(values)) return [];
  const out = [];
  for (const v of values) {
    const label = normalizeLabel(v);
    if (label && !out.includes(label)) out.push(label);
    if (out.length === MAX_LABELS) break;
  }
  return out;
}

/** Stable colour slot (0..LABEL_HUES-1) for a label, so a label keeps its colour. */
function labelColorIndex(label) {
  const s = normalizeLabel(label);
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  return hash % LABEL_HUES;
}

/** All distinct labels used in a cycle, sorted alphabetically (for autocomplete). */
function collectLabels(cycle) {
  const seen = new Set();
  for (const week of (cycle && cycle.weeks) || []) {
    for (const day of week.days || []) {
      for (const task of day.tasks || []) {
        for (const label of task.labels || []) {
          const n = normalizeLabel(label);
          if (n) seen.add(n);
        }
      }
    }
  }
  return [...seen].sort();
}

module.exports = {
  MAX_LABELS,
  MAX_LABEL_LENGTH,
  LABEL_HUES,
  normalizeLabel,
  normalizeLabels,
  labelColorIndex,
  collectLabels,
};
