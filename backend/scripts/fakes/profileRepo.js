'use strict';

/**
 * W3-qa fake — in-memory implementation of the `userProfileRepository`
 * contract from `development/remediation-w3/orchestration-ctx/decisions/
 * layer-contract-w3.md` §"Repositories".
 *
 * Mirrors the contract exactly:
 * - `getOrCreate(uuid)` returns profile doc, creating with lifetimeScore 0
 *   if missing.
 * - `applyLifetimeDelta(uuid, delta)` floors lifetime at 0 and stamps
 *   `updatedAt`.
 *
 * Plain objects only — no mongoose.
 *
 * v2.3: also implements `addCredits`, `findChestById`, `claimChest`
 * (atomic conditional update), and `syncRewards` (idempotent batch).
 */

function createFakeUserProfileRepository({ defaultUuid = 'default-user' } = {}) {
  /** @type {Map<string, object>} */
  const store = new Map();

  function ensure(uuid) {
    const key = uuid || defaultUuid;
    let profile = store.get(key);
    if (!profile) {
      profile = {
        uuid: key,
        lifetimeScore: 0,
        credits: 0,
        chests: [],
        achievements: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      store.set(key, profile);
    }
    if (typeof profile.credits !== 'number') profile.credits = 0;
    if (!Array.isArray(profile.chests)) profile.chests = [];
    if (!Array.isArray(profile.achievements)) profile.achievements = [];
    return profile;
  }

  async function getOrCreate(uuid) {
    return clone(ensure(uuid));
  }

  async function applyLifetimeDelta(uuid, delta) {
    const profile = ensure(uuid);
    profile.lifetimeScore = Math.max(0, (profile.lifetimeScore || 0) + (Number(delta) || 0));
    profile.updatedAt = new Date();
    return clone(profile);
  }

  // v2.1 partial profile PATCH.
  async function updateProfile(uuid, updates) {
    const profile = ensure(uuid);
    if (updates && typeof updates === 'object' && updates.displayName !== undefined) {
      profile.displayName = updates.displayName;
    }
    profile.updatedAt = new Date();
    return clone(profile);
  }

  // ------ v2.3 rewards ------------------------------------------------------

  async function addCredits(uuid, amount) {
    const profile = ensure(uuid);
    const delta = Number(amount);
    if (Number.isFinite(delta) && delta > 0) {
      profile.credits = (profile.credits || 0) + delta;
      profile.updatedAt = new Date();
    }
    return clone(profile);
  }

  async function findChestById(uuid, chestId) {
    if (!chestId) return null;
    const profile = ensure(uuid);
    return (profile.chests || []).find((c) => c && c.id === chestId) || null;
  }

  async function claimChest(uuid, chestId, { rarity, credits, now } = {}) {
    if (!['common', 'rare', 'epic', 'legendary'].includes(rarity)) {
      throw new TypeError(`claimChest: invalid rarity ${rarity}`);
    }
    if (!Number.isFinite(credits) || credits <= 0) {
      throw new TypeError(`claimChest: invalid credits ${credits}`);
    }
    const profile = ensure(uuid);
    const chest = (profile.chests || []).find((c) => c && c.id === chestId);
    if (!chest) return { chest: null, profile: clone(profile), claimed: false };
    if (chest.claimedAt) {
      return { chest: clone(chest), profile: clone(profile), claimed: false };
    }
    chest.claimedAt = now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date();
    chest.rarity = rarity;
    chest.credits = credits;
    profile.credits = (profile.credits || 0) + credits;
    profile.updatedAt = chest.claimedAt;
    return { chest: clone(chest), profile: clone(profile), claimed: true };
  }

  async function syncRewards(uuid, { chestsToAdd, achievementsToAdd, now } = {}) {
    const profile = ensure(uuid);
    const stamp = now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date();
    if (Array.isArray(chestsToAdd)) {
      for (const c of chestsToAdd) {
        if (profile.chests.some((x) => x && x.level === c.level)) continue;
        profile.chests.push({
          id: c.id || `ch-${c.level}`,
          level: c.level,
          earnedAt: stamp,
          claimedAt: null,
          rarity: null,
          credits: null,
        });
      }
    }
    if (Array.isArray(achievementsToAdd)) {
      for (const a of achievementsToAdd) {
        if (!a || !a.id) continue;
        if (profile.achievements.some((x) => x && x.id === a.id)) continue;
        profile.achievements.push({
          id: a.id,
          credits: Number(a.credits) || 0,
          unlockedAt: stamp,
        });
        profile.credits = (profile.credits || 0) + (Number(a.credits) || 0);
      }
    }
    profile.updatedAt = stamp;
    return clone(profile);
  }

  // Test helpers (NOT part of the contract).
  function _reset() {
    store.clear();
  }
  function _raw(uuid) {
    const v = store.get(uuid);
    return v == null ? null : clone(v);
  }

  return {
    getOrCreate,
    applyLifetimeDelta,
    updateProfile,
    // v2.3
    addCredits,
    findChestById,
    claimChest,
    syncRewards,
    _reset,
    _raw,
  };
}

function clone(v) {
  return v == null ? v : JSON.parse(JSON.stringify(v));
}

module.exports = { createFakeUserProfileRepository };