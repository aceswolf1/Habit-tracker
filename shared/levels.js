/**
 * Player level curve (v2.1).
 *
 * Sourced from total lifetime XP. The curve is a sqrt-shaped milestone
 * progression: every level requires more XP than the last, so a casual
 * hit-hard player doesn't outpace the roster titles.
 *
 *   level = floor(sqrt(max(0, xp) / 25)) + 1
 *   level n starts at 25 * (n - 1)^2 XP
 *
 * So level 1 = 0 XP, level 2 = 25, level 3 = 100, level 4 = 225, level 5 = 400 …
 * Cap growth stays sub-linear so real players stay near the middle of the
 * roster for a meaningful time.
 *
 * Titles by level band:
 *   1..4   RECRUIT
 *   5..9   OPERATIVE
 *   10..19 RUNNER
 *   20..29 SPECTER
 *   30..39 VANGUARD
 *   40+    ARCHON
 */
'use strict';

const TITLE_RULES = [
  // higher titles first — first match wins
  { minLevel: 40, title: 'ARCHON' },
  { minLevel: 30, title: 'VANGUARD' },
  { minLevel: 20, title: 'SPECTER' },
  { minLevel: 10, title: 'RUNNER' },
  { minLevel: 5,  title: 'OPERATIVE' },
  { minLevel: 1,  title: 'RECRUIT' },
];

const XP_PER_LEVEL_STEP = 25;

/**
 * @param {number} lifetimeXp non-negative integer (clamped; negatives → 0)
 * @returns {{ level:number, title:string, xpIntoLevel:number, xpForNext:number|null, progress:number }}
 *
 *   - `level`         integer ≥ 1
 *   - `title`         one of the bands above
 *   - `xpIntoLevel`   XP earned since hitting this level
 *   - `xpForNext`     XP needed to reach the next level (`null` if max band)
 *   - `progress`      0..100, percent through the current level
 */
function levelInfo(lifetimeXp) {
  const xp = Math.max(0, Math.floor(Number(lifetimeXp) || 0));
  const level = Math.floor(Math.sqrt(xp / XP_PER_LEVEL_STEP)) + 1;
  const startOfLevel = XP_PER_LEVEL_STEP * (level - 1) * (level - 1);
  const startOfNext  = XP_PER_LEVEL_STEP * level * level;

  // Title: walk rules in order, pick the highest band that includes `level`.
  let title = 'RECRUIT';
  for (const rule of TITLE_RULES) {
    if (level >= rule.minLevel) {
      title = rule.title;
      break;
    }
  }

  const xpIntoLevel = xp - startOfLevel;
  const isArchon = title === 'ARCHON';
  const xpForNext = isArchon ? null : startOfNext - startOfLevel;
  const progress = (isArchon || xpForNext === 0)
    ? 100
    : Math.max(0, Math.min(100, Math.round((xpIntoLevel / xpForNext) * 100)));

  return {
    level,
    title,
    xpIntoLevel,
    xpForNext,
    progress,
  };
}

module.exports = {
  levelInfo,
  // exported for tests that want to assert the formula independently
  _XP_PER_LEVEL_STEP: XP_PER_LEVEL_STEP,
};
