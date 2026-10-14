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
 */

function createFakeUserProfileRepository({ defaultUuid = 'default-user' } = {}) {
  /** @type {Map<string, object>} */
  const store = new Map();

  async function getOrCreate(uuid) {
    const key = uuid || defaultUuid;
    if (store.has(key)) return clone(store.get(key));
    const profile = {
      uuid: key,
      lifetimeScore: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    store.set(key, profile);
    return clone(profile);
  }

  async function applyLifetimeDelta(uuid, delta) {
    const key = uuid || defaultUuid;
    let profile = store.get(key);
    if (!profile) {
      profile = {
        uuid: key,
        lifetimeScore: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      store.set(key, profile);
    }
    const next = Math.max(0, (profile.lifetimeScore || 0) + (Number(delta) || 0));
    profile.lifetimeScore = next;
    profile.updatedAt = new Date();
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
    // v2.1: partial profile PATCH (displayName). Mirrors the real repo.
    async updateProfile(uuid, updates) {
      const key = uuid || defaultUuid;
      let profile = store.get(key);
      if (!profile) {
        profile = {
          uuid: key,
          lifetimeScore: 0,
          displayName: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        store.set(key, profile);
      }
      if (!updates || typeof updates !== 'object') {
        return clone(profile);
      }
      if (updates.displayName !== undefined) profile.displayName = updates.displayName;
      profile.updatedAt = new Date();
      return clone(profile);
    },
    _reset,
    _raw,
  };
}

function clone(v) {
  return v == null ? v : JSON.parse(JSON.stringify(v));
}

module.exports = { createFakeUserProfileRepository };