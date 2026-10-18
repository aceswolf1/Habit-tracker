/**
 * Strike-combo helpers for v2.2 (habit intelligence).
 *
 * Decisions (authoritative: `development/v2-features/orchestration-ctx/
 * decisions/contract-v2.2.md` §1, E1–E4):
 *   - Completing the same habit again within `COMBO_GAP_DAYS` (=2) calendar
 *     days of its previous completion increments the combo.
 *   - Bonus XP per level above 1: `+25%`, capped at ×2.
 *   - Combo names: 'DOUBLE STRIKE' (2) → 'PENTA STRIKE' (5), then `×N STRIKE`.
 *   - `completedOn` is the user's *local* calendar date (`YYYY-MM-DD`).
 *   - Same-day re-completion does NOT increase the combo (diff == 0 → no-op).
 *   - Forward-only: un-checking a task subtracts its stored bonus; later
 *     combos are NOT recomputed. E4 also locks in that pre-v2.2
 *     completions are never rescored.
 *
 * This is pure CJS — usable by the backend scoring service and by the FE
 * via `frontend/utils/sharedCombos.ts`.
 */
'use strict';

const { isIsoDate } = require('./dates');

/**
 * The maximum number of days that may separate two completions of the
 * same habit for the later one to count as a continuation of the combo.
 * Diff of 0 (same day) is a no-op; diff of 1 or 2 increments; diff of
 * 3+ resets to 1.
 */
const COMBO_GAP_DAYS = 2;

/**
 * The XP multiplier for a given combo level.
 *   - `combo <= 1` → 1× (no bonus).
 *   - `combo = 2`  → 1.25×
 *   - `combo = 3`  → 1.50×
 *   - `combo = 4`  → 1.75×
 *   - `combo ≥ 5`  → 2× (cap).
 *
 * The bonus (over the base) is `comboMultiplier(combo) - 1`, used by the
 * scoring service to compute the per-task `comboBonus` field.
 */
function comboMultiplier(combo) {
  const n = Math.max(1, Math.floor(Number(combo) || 1));
  // Cap at 2 (= base × 2, +100%). Round to 4 decimal places to avoid
  // floating-point churn in tests (1.25, 1.5, 1.75, 2.00).
  const raw = 1 + 0.25 * (n - 1);
  return Math.min(raw, 2);
}

/**
 * Display name for a combo level.
 *   - < 2 (or null/undefined) → null
 *   - 2 → 'DOUBLE STRIKE'
 *   - 3 → 'TRIPLE STRIKE'
 *   - 4 → 'QUAD STRIKE'
 *   - 5 → 'PENTA STRIKE'
 *   - ≥ 6 → '×N STRIKE' (with the actual N)
 */
function comboName(combo) {
  const n = Math.floor(Number(combo) || 0);
  if (n < 2) return null;
  switch (n) {
    case 2: return 'DOUBLE STRIKE';
    case 3: return 'TRIPLE STRIKE';
    case 4: return 'QUAD STRIKE';
    case 5: return 'PENTA STRIKE';
    default: return `×${n} STRIKE`;
  }
}

/**
 * Calendar-day difference between two ISO 'YYYY-MM-DD' dates
 * (`isoB` minus `isoA`). Returns an integer.
 *
 * Math happens at UTC noon so DST shifts can't push the count by one.
 * Both inputs must be valid ISO dates per `isIsoDate`; otherwise we
 * return `NaN` (defensive — callers should never pass garbage).
 */
function daysBetween(isoA, isoB) {
  if (!isIsoDate(isoA) || !isIsoDate(isoB)) return NaN;
  const [ya, ma, da] = isoA.split('-').map(Number);
  const [yb, mb, db] = isoB.split('-').map(Number);
  const a = Date.UTC(ya, ma - 1, da, 12, 0, 0);
  const b = Date.UTC(yb, mb - 1, db, 12, 0, 0);
  return Math.round((b - a) / 86_400_000);
}

/**
 * Compute the next combo level given the previous completion's date +
 * level and the new completion's date.
 *
 * Rules:
 *   - `prevCompletedOn` falsy or no `prevCombo` → 1 (first ever or
 *     combo was reset).
 *   - `daysBetween(prevCompletedOn, completedOn) <= 2` → `prevCombo + 1`,
 *     BUT a same-day re-check (diff === 0) keeps the combo unchanged
 *     (no increase).
 *   - Otherwise (gap > 2) → 1 (chain broken).
 *
 * Both dates must be 'YYYY-MM-DD' strings; an invalid `completedOn`
 * returns 1 (safe default — callers never see bonuses for malformed
 * completions).
 */
function nextCombo(prevCompletedOn, prevCombo, completedOn) {
  if (!isIsoDate(completedOn)) return 1;
  if (!isIsoDate(prevCompletedOn)) return 1;
  const prevN = Math.floor(Number(prevCombo) || 0);
  if (prevN < 1) return 1;
  const diff = daysBetween(prevCompletedOn, completedOn);
  if (diff < 0) return 1; // Defensive: out-of-order dates collapse to a fresh chain.
  if (diff === 0) return prevN; // Same day → no increase.
  if (diff <= COMBO_GAP_DAYS) return prevN + 1;
  return 1; // Gap > 2 → chain broken, restart at 1.
}

module.exports = {
  COMBO_GAP_DAYS,
  comboMultiplier,
  comboName,
  daysBetween,
  nextCombo,
};