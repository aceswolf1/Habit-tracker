/**
 * Rewards service (v2.3) — chest backfill + achievement unlocks.
 *
 * The contract (development/v2-features/orchestration-ctx/decisions/
 * contract-v2.3.md §2-§3) says:
 *
 *   1. Calling `syncRewards(profile, stats)` must be IDEMPOTENT.
 *      Running it twice leaves the same set of chests + achievements.
 *   2. Chests get backfilled for every level 2..current the player has
 *      already reached (F1). The same level never produces a second chest.
 *   3. Achievements unlock from `stats` (history-driven; strike-based ones
 *      use `bestCombo`, etc.). Each ID's credits are added once.
 *   4. Calls return `{ newChests: [...], newAchievements: [...] }` so the
 *      caller (PATCH / finish / GET /rewards) can flash toasts.
 *
 * Layers (W3 contract): services → repositories. No mongoose imports; no
 * HTTP concerns. `cycleRepository` is here because we compute stats from
 * history; `userProfileRepository` is the write side.
 *
 * DomainErrors thrown here are mapped by the controller (NOT_FOUND,
 * ALREADY_CLAIMED, …). Stats builders live in this file so the data flow
 * is testable without controllers.
 */

'use strict';

const { notFound, alreadyClaimed } = require('./errors');
const { generateUuid } = require('../../shared/progress');
const { levelInfo, _XP_PER_LEVEL_STEP } = require('../../shared/levels');
const { evaluateAchievements, ACHIEVEMENT_CREDITS } = require('../../shared/achievements');
const { CHEST_CREDITS, rollRarity } = require('../../shared/rewards');
const { getTierFromProgress } = require('../../shared/scoring');
const { habitKey } = require('../../shared/habits');

/**
 * Build a service bound to the repositories. The optional `now` clock
 * makes tests deterministic.
 *
 * @param {{
 *   profileRepo: {
 *     getOrCreate(uuid): Promise<object>,
 *     syncRewards(uuid, {chestsToAdd, achievementsToAdd, now?}):
 *       Promise<object>,
 *   },
 *   cycleRepo?: {
 *     findAllForInsights(): Promise<object[]>,
 *   },
 *   clock?: () => Date,
 * }} deps
 */
function createRewardsService({ profileRepo, cycleRepo, clock } = {}) {
  if (!profileRepo) throw new Error('createRewardsService requires { profileRepo }');
  const now = typeof clock === 'function' ? clock : () => new Date();

  /**
   * Compute the historical stats (contract §2) by walking the same data
   * the insights service reads. We don't import insightsService because
   * that pulls in the combat log + weekday rates we don't need here.
   *
   *   `legendaryCompletions` is counted alongside `completions`. Tier is
   *   the max progress tier index across ALL cycles (Bronze=0..Final=4).
   */
  async function buildStats() {
    if (!cycleRepo || typeof cycleRepo.findAllForInsights !== 'function') {
      return {
        completions: 0,
        finishedMonths: 0,
        bestTierReached: 0,
        longestPerfectStreak: 0,
        bestCombo: 0,
        level: 1,
        legendaryCompletions: 0,
      };
    }
    const cycles = await cycleRepo.findAllForInsights();
    return buildStatsFromCycles(cycles);
  }

  /**
   * Idempotent sync (contract §2). Reads the profile, computes the desired
   * chests + achievements, forwards ONLY the missing ones to the repo,
   * and returns `{ newChests, newAchievements }`. Safe to call from any
   * write path; calling twice yields an empty delta the second time.
   *
   * `profileOverride` is for tests; in normal flow we read via
   * `profileRepo.getOrCreate`.
   */
  async function syncRewards(uuid, opts) {
    const profile = (opts && opts.profileOverride) || await profileRepo.getOrCreate(uuid);
    const stats = (opts && opts.stats) || await buildStats();
    const stamp = now();

    const existingChestLevels = new Set();
    const existingAchIds = new Set();
    if (profile.chests && profile.chests.length) {
      for (const c of profile.chests) {
        if (c && typeof c.level === 'number') existingChestLevels.add(c.level);
      }
    }
    if (profile.achievements && profile.achievements.length) {
      for (const a of profile.achievements) {
        if (a && typeof a.id === 'string') existingAchIds.add(a.id);
      }
    }

    // ---- chests: F1 — one chest per level from 2..current ----
    const newChests = [];
    const chestsToAdd = [];
    const li = levelInfo(profile.lifetimeScore || 0);
    // `li.level` is 1-based; we backfill every level 2..li.level when there
    // is none. The server-assigned `id` is `ch-<level>` so the deterministic
    // shape helps smoke tests and FE identity.
    for (let lv = 2; lv <= li.level; lv++) {
      if (existingChestLevels.has(lv)) continue;
      const chest = {
        id: `ch-${lv}`,
        level: lv,
        earnedAt: stamp,
        claimedAt: null,
        rarity: null,
        credits: null,
      };
      newChests.push(chest);
      chestsToAdd.push(chest);
    }

    // ---- achievements: F4 — unlock + credit once per id ----
    const newAchievements = [];
    const achievementsToAdd = [];
    const rows = evaluateAchievements(stats);
    for (const row of rows) {
      if (!row.unlocked) continue;
      if (existingAchIds.has(row.id)) continue;
      const credits = (ACHIEVEMENT_CREDITS && ACHIEVEMENT_CREDITS[row.size]) || row.credits || 0;
      const entry = { id: row.id, credits, unlockedAt: stamp };
      newAchievements.push(entry);
      achievementsToAdd.push(entry);
    }

    if (chestsToAdd.length || achievementsToAdd.length) {
      await profileRepo.syncRewards(uuid, {
        chestsToAdd,
        achievementsToAdd,
        now: stamp,
      });
    }

    return { newChests, newAchievements };
  }

  /**
   * GET /rewards: resolve the profile, run syncRewards, and project the
   * contract response shape. `now` is clock-driven; `inventory` orders
   * chests newest-first per spec.
   */
  async function getRewardsResponse(uuid) {
    const profile = await profileRepo.getOrCreate(uuid);
    // Compute stats once with `level` set from the profile so the
    // achievement evaluator sees BOTH the history-based metrics AND the
    // current level (level-10 must unlock at level ≥ 10).
    const li = levelInfo(profile.lifetimeScore || 0);
    const cycleStats = await buildStats();
    const stats = { ...cycleStats, level: li.level };
    await syncRewards(uuid, { profileOverride: profile, stats });
    const fresh = await profileRepo.getOrCreate(uuid);
    return projectRewardsResponse(fresh, { ...cycleStats, level: li.level });
  }

  /**
   * POST /rewards/chests/:chestId/claim — atomic claim (must be done by
   * the repository to avoid double-credit races). Throws:
   *   - `NOT_FOUND`  when the chest id is unknown.
   *   - `ALREADY_CLAIMED` when the chest's `claimedAt` is already set.
   *
   * On success returns `{ chest, credits }`.
   */
  async function claimChest(uuid, chestId) {
    if (!chestId) throw notFound(`Chest ${chestId || ''} not found`);
    // Sync first — a chest only becomes claimable once it exists on the
    // profile, and the sync is the path that creates it (F1 backfill).
    await syncRewards(uuid);
    const existing = await profileRepo.findChestById(uuid, chestId);
    if (!existing) {
      throw notFound(`Chest ${chestId} not found`);
    }
    if (existing.claimedAt) {
      throw alreadyClaimed(`Chest ${chestId} already claimed`);
    }
    const rarity = rollRarity(existing.level);
    const credits = CHEST_CREDITS[rarity];
    const stamp = now();
    const result = await profileRepo.claimChest(uuid, chestId, { rarity, credits, now: stamp });
    if (result && result.claimed) {
      return { chest: result.chest, credits };
    }
    if (result && result.chest && result.chest.claimedAt) {
      throw alreadyClaimed(`Chest ${chestId} already claimed`);
    }
    throw notFound(`Chest ${chestId} not found`);
  }

  return {
    buildStats,
    syncRewards,
    getRewardsResponse,
    claimChest,
    // exposed for tests
    projectRewardsResponse,
    buildStatsFromCycles,
  };
}

// ---------- helpers (also exported for direct unit testing) ----------------

/**
 * Pure stats builder. Mirrors insightsService in the relevant slice and
 * returns the exact `stats` shape `evaluateAchievements` consumes.
 */
function buildStatsFromCycles(cycles) {
  let completions = 0;
  let legendaryCompletions = 0;
  let finishedMonths = 0;
  let longestPerfectStreak = 0;
  let activeStreak = 0;
  let bestCombo = 0;
  let bestProgress = 0;

  const sorted = sortChronologically(cycles || []);
  for (const cycle of sorted) {
    if (!cycle || !cycle.weeks) continue;
    if (cycle.finished) finishedMonths++;

    for (const week of cycle.weeks) {
      for (const day of week.days || []) {
        let requiredTotal = 0;
        let requiredDone = 0;
        let hasAnyTask = false;
        for (const t of day.tasks || []) {
          hasAnyTask = true;
          if (!t.optional) {
            requiredTotal++;
            if (t.completed) requiredDone++;
          }
          if (t.completed) {
            completions++;
            if (t.legendary) legendaryCompletions++;
          }
          const combo = Number(t.combo) || 1;
          if (combo > bestCombo) bestCombo = combo;
        }
        if (hasAnyTask && requiredTotal > 0 && requiredDone === requiredTotal) {
          activeStreak++;
          if (activeStreak > longestPerfectStreak) longestPerfectStreak = activeStreak;
        } else if (hasAnyTask) {
          activeStreak = 0;
        }
        // No-task days preserve the streak (matches insightsService).
      }
    }

    const cycleProgress = Math.round(cycle.progress || 0);
    if (cycleProgress > bestProgress) bestProgress = cycleProgress;
  }

  // `level` is computed later from the profile's lifetimeScore; pass 0 here
  // and let the caller re-stamp it. (We don't read profile here to keep
  // buildStatsFromCycles dependency-free; syncRewards sets it before passing
  // to evaluateAchievements.)
  return {
    completions,
    finishedMonths,
    bestTierReached: indexOfTierFromProgress(bestProgress),
    longestPerfectStreak,
    bestCombo,
    level: 0,
    legendaryCompletions,
  };
}

function indexOfTierFromProgress(progress) {
  // Bronze=0, Silver=1, Gold=2, Champion=3, Final=4 (matches achievements.js / scoring).
  const v = Math.max(0, Math.round(Number(progress) || 0));
  if (v >= 100) return 4;
  if (v >= 75)  return 3;
  if (v >= 50)  return 2;
  if (v >= 25)  return 1;
  return 0;
}

function sortChronologically(cycles) {
  return [...(cycles || [])].sort((a, b) => {
    const ax = (a && a.startDate) || '';
    const bx = (b && b.startDate) || '';
    if (ax && bx) return ax < bx ? -1 : ax > bx ? 1 : 0;
    if (ax) return -1;
    if (bx) return 1;
    const ac = a && a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bc = b && b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return ac - bc;
  });
}

/**
 * Build the API response payload. Chests newest-first; achievements
 * blend the catalog order (so locked rows are still in a stable spot)
 * with the profile's `unlockedAt` date when present. `stats` is the
 * computed cycle walk; callers that don't have it (tests) may pass
 * `{level}` alone and accept zero-progress rows.
 */
function projectRewardsResponse(profile, stats) {
  const li = levelInfo(profile.lifetimeScore || 0);
  // Always include the player's level so the level-10 row evaluates.
  const mergedStats = { ...(stats || {}), level: li.level };
  const achRows = evaluateAchievements(mergedStats);
  const achIds = new Map();
  for (const a of profile.achievements || []) {
    if (a && a.id) achIds.set(a.id, a);
  }
  const achievements = achRows.map((row) => {
    const stored = achIds.get(row.id);
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      size: row.size,
      credits: row.credits,
      unlocked: !!stored,
      unlockedAt: stored ? toIso(stored.unlockedAt) : null,
      progress: row.progress,
      current: row.current,
      target: row.target,
    };
  });

  const chests = (profile.chests || [])
    .slice()
    .sort((a, b) => (b.level || 0) - (a.level || 0))
    .map((c) => ({
      id: c.id,
      level: c.level,
      earnedAt: toIso(c.earnedAt),
      claimedAt: c.claimedAt ? toIso(c.claimedAt) : null,
      rarity: c.rarity || null,
      credits: typeof c.credits === 'number' ? c.credits : null,
    }));

  // nextReward: derive once at the response layer so the FE doesn't have
  // to mirror shared/rewards + shared/levels.
  const { nextRewardInfo } = require('../../shared/rewards');
  const nr = nextRewardInfo(profile.lifetimeScore || 0);

  return {
    credits: profile.credits || 0,
    level: li.level,
    title: li.title,
    lifetimeScore: profile.lifetimeScore || 0,
    nextReward: { level: nr.level, xpRemaining: nr.xpRemaining },
    chests,
    achievements,
  };
}

function toIso(d) {
  if (!d) return null;
  if (d instanceof Date) return d.toISOString();
  // mongoose sometimes hands back lean dates as ISO strings already; tolerate that.
  return typeof d === 'string' ? d : null;
}

module.exports = {
  createRewardsService,
  // exposed for direct testing
  buildStatsFromCycles,
  projectRewardsResponse,
  indexOfTierFromProgress,
  _internal: {
    XP_PER_LEVEL_STEP: _XP_PER_LEVEL_STEP,
    getTierFromProgress,
    habitKey,
    generateUuid,
  },
};
