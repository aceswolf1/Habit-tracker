/**
 * Boss roster + week-by-week picker (v2.1).
 *
 * Every week in a month faces one of four bosses. The roster rotates:
 *   weekIndex 0  → SYNTHIA   (CHRONO ARCHON)
 *   weekIndex 1  → KAGE      (NEON WRAITH)
 *   weekIndex 2  → MERIDIAN  (DATA HYDRA)
 *   weekIndex 3  → NYX       (VOID SOVEREIGN)
 *   weekIndex 4  → SYNTHIA   (cycles with ≥5 weeks wrap around)
 *
 * Single source of truth so the FE cockpit and the BE share the same
 * names (the W3 FE renders "name // codename" in the cockpit header).
 */
'use strict';

/**
 * The roster. Order is intentional — `bossForWeek(i)` indexes by
 * `i % 4`. Add new bosses by appending; don't reorder existing entries.
 */
const BOSSES = [
  { name: 'CHRONO ARCHON', codename: 'SYNTHIA' },
  { name: 'NEON WRAITH',    codename: 'KAGE' },
  { name: 'DATA HYDRA',     codename: 'MERIDIAN' },
  { name: 'VOID SOVEREIGN', codename: 'NYX' },
];

/**
 * Pick the boss for `weekIndex`. Cycle-safe (any non-negative int works).
 * Negative weekIndex falls back to the first boss rather than throwing —
 * keeping callers robust against partial render states.
 */
function bossForWeek(weekIndex) {
  const n = Number.isInteger(weekIndex) ? weekIndex : 0;
  if (n < 0) return BOSSES[0];
  return BOSSES[n % BOSSES.length];
}

module.exports = {
  BOSSES,
  bossForWeek,
};
