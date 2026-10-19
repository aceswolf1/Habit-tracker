'use strict';
/**
 * UserProfileRepository — the only module allowed to touch the UserProfile
 * mongoose model.
 *
 * The interface is intentionally narrow:
 *   - getOrCreate(uuid)              — profile doc (creates lifetimeScore 0 if missing)
 *   - applyLifetimeDelta(uuid, delta) — max(0, current + delta), updatedAt bumped, saved
 *   - updateProfile(uuid, updates)    — partial-profile PATCH (v2.1)
 *   - addCredits(uuid, amount)        — add (signed, floored at 0) to credits (v2.3)
 *   - findChestById(uuid, chestId)    — single chest from profile.chests (v2.3)
 *   - claimChest(uuid, chestId, {rarity,credits,now?}) — atomic claim (v2.3)
 *       Conditional `claimedAt: null` filter guards against double-claim
 *       races — returns the updated chest, or `null` if it was already
 *       claimed / missing. Credits are added in the same operation.
 *   - syncRewards(uuid, {chestsToAdd:[…], achievementsToAdd:[…]}) — v2.3
 *       Atomically apply a batch of NEW chests and achievements, crediting
 *       each achievement's credits. Idempotent at the service layer (it
 *       only forwards items that aren't already on the profile).
 *
 * Higher layers (services, controllers) must not `require('../models/UserProfile')`.
 */

function createUserProfileRepository({ UserProfile }) {
  if (!UserProfile) throw new Error('createUserProfileRepository requires { UserProfile }');

  return {
    /**
     * Fetch the profile, creating it with lifetimeScore 0 if missing.
     * The new doc is saved so callers can read `lifetimeScore` immediately.
     */
    async getOrCreate(uuid) {
      let profile = await UserProfile.findOne({ uuid });
      if (!profile) {
        profile = new UserProfile({ uuid, lifetimeScore: 0 });
        await profile.save();
      }
      return profile;
    },

    /**
     * Apply a signed delta to `lifetimeScore`, flooring at 0 and bumping `updatedAt`.
     * Mirrors the UB-10 guarantee that was previously inlined in cycleRoutes:
     *   lifetimeScore = max(0, current + delta)
     * Returns the saved doc.
     */
    async applyLifetimeDelta(uuid, delta) {
      const profile = await UserProfile.findOne({ uuid });
      if (!profile) {
        // Mirror the create-on-miss that existed in the original PATCH path —
        // a delta on a missing profile still has to bootstrap one.
        const fresh = new UserProfile({ uuid, lifetimeScore: 0 });
        fresh.lifetimeScore = Math.max(0, 0 + delta);
        fresh.updatedAt = new Date();
        return fresh.save();
      }
      profile.lifetimeScore = Math.max(0, (profile.lifetimeScore || 0) + delta);
      profile.updatedAt = new Date();
      return profile.save();
    },

    /**
     * v2.1: patch the player display name (or any future cosmetic fields).
     *
     * `updates` is a partial object. The service layer is responsible for
     * shaping the request body and stripping unknown keys; we just apply
     * the listed fields, bump `updatedAt`, and return the saved doc.
     * Auto-creates the profile if missing (mirrors `applyLifetimeDelta`).
     *
     * Only writes fields that are explicitly provided; `undefined` skips a
     * field. A `null` writes `null` (useful for "clear the display name"
     * semantics that the FE expects).
     */
    async updateProfile(uuid, updates) {
      if (!updates || typeof updates !== 'object') {
        throw new TypeError('updateProfile: `updates` must be an object');
      }
      const profile = await UserProfile.findOne({ uuid });
      if (!profile) {
        const fresh = new UserProfile({ uuid, lifetimeScore: 0 });
        if (updates.displayName !== undefined) fresh.displayName = updates.displayName;
        fresh.updatedAt = new Date();
        return fresh.save();
      }
      if (updates.displayName !== undefined) profile.displayName = updates.displayName;
      profile.updatedAt = new Date();
      return profile.save();
    },

    // ---------------- v2.3 — rewards ledger methods ----------------

    /**
     * Add a non-negative credit delta to `profile.credits`, flooring at 0.
     * Mirrors `applyLifetimeDelta`'s signed + floored pattern. Pass
     * positive numbers only on the happy path; a non-positive amount is a
     * no-op so concurrent callers can't accidentally drain credits that
     * v2.3 doesn't yet spend.
     */
    async addCredits(uuid, amount) {
      const delta = Number(amount);
      if (!Number.isFinite(delta) || delta <= 0) {
        // Defensive: credits are only added, never subtracted, in v2.3.
        return this.getOrCreate(uuid);
      }
      const profile = await UserProfile.findOneAndUpdate(
        { uuid },
        {
          $inc: { credits: delta },
          $set: { updatedAt: new Date() },
        },
        { new: true }
      );
      if (profile) return profile;
      // Auto-create with the delta baked in so the next read sees it.
      const fresh = new UserProfile({ uuid, lifetimeScore: 0 });
      fresh.credits = delta;
      fresh.updatedAt = new Date();
      return fresh.save();
    },

    /**
     * Locate a chest on the profile by its id. Returns the chest object
     * (or `null` when missing). The caller reads `claimedAt` etc. without
     * mutating anything; the atomic claim lives in `claimChest`.
     */
    async findChestById(uuid, chestId) {
      if (!chestId) return null;
      const profile = await UserProfile.findOne(
        { uuid },
        { chests: 1 }
      ).lean();
      if (!profile || !Array.isArray(profile.chests)) return null;
      return profile.chests.find((c) => c && c.id === chestId) || null;
    },

    /**
     * Atomic claim (F1 / F2):
     *
     *   1. Match by `{uuid, "chests.id": chestId, "chests.claimedAt": null}`.
     *   2. `$set` the matched chest's `claimedAt / rarity / credits`.
     *   3. `$inc` `profile.credits` by the chest's awarded amount.
     *
     * A second concurrent call with the same chest id matches NO chest
     * (the one it's racing for is already claimedAt !== null) and the
     * atomic update silently no-ops; we then re-read to confirm `null`.
     *
     * Returns `{ chest, profile, claimed }`:
     *   - `claimed === true` + `chest` populated on success.
     *   - `claimed === false` when the chest id is unknown (`chest: null`).
     *   - `claimed === false` when the chest is already claimedAt !== null
     *     (`chest: <the existing chest>`).
     *
     * `now` is injectable for tests; default = `new Date()`.
     */
    async claimChest(uuid, chestId, { rarity, credits, now } = {}) {
      if (!chestId) return { chest: null, profile: null, claimed: false };
      if (!['common', 'rare', 'epic', 'legendary'].includes(rarity)) {
        throw new TypeError(`claimChest: invalid rarity ${rarity}`);
      }
      if (!Number.isFinite(credits) || credits <= 0) {
        throw new TypeError(`claimChest: invalid credits ${credits}`);
      }
      const claimedAt = now instanceof Date && !Number.isNaN(now.getTime())
        ? now : new Date();

      // Step 1+2+3: atomic conditional update. The array-filter positional
      // operator `$` targets the chest that matches all three predicates
      // (correct uuid + correct chest id + claimedAt: null).
      const updated = await UserProfile.findOneAndUpdate(
        {
          uuid,
          chests: { $elemMatch: { id: chestId, claimedAt: null } },
        },
        {
          $set: {
            'chests.$[c].claimedAt': claimedAt,
            'chests.$[c].rarity': rarity,
            'chests.$[c].credits': credits,
            updatedAt: claimedAt,
          },
          $inc: { credits },
        },
        {
          arrayFilters: [{ 'c.id': chestId }],
          new: true,
        }
      );

      if (updated) {
        const claimedChest = (updated.chests || []).find((c) => c && c.id === chestId) || null;
        return { chest: claimedChest, profile: updated, claimed: true };
      }

      // No claim happened — figure out why so the caller can map the right HTTP status.
      const profile = await UserProfile.findOne({ uuid }, { chests: 1, credits: 1 }).lean();
      const existing = profile && Array.isArray(profile.chests)
        ? profile.chests.find((c) => c && c.id === chestId)
        : null;
      return {
        chest: existing || null,
        profile: profile || null,
        claimed: false,
      };
    },

    /**
     * v2.3: apply a batch of NEW chests and achievements in one write.
     *
     * Idempotency lives at the SERVICE layer (`syncRewards`):
     *   - chestsToAdd: only levels that don't already have a chest are
     *     forwarded here. We push them; the server-assigned `id` is
     *     `<chest.id>` already (the service generates it deterministically
     *     from level).
     *   - achievementsToAdd: only catalog ids not already on the profile;
     *     we push them and $inc `credits` for each.
     *
     * `now` is injectable for tests.
     */
    async syncRewards(uuid, { chestsToAdd, achievementsToAdd, now } = {}) {
      const stamp = now instanceof Date && !Number.isNaN(now.getTime())
        ? now : new Date();
      const newChests = Array.isArray(chestsToAdd) ? chestsToAdd : [];
      const newAchs = Array.isArray(achievementsToAdd) ? achievementsToAdd : [];

      const setOps = { updatedAt: stamp };
      // Ensure each pushed chest row carries a server-stamped `earnedAt`
      // (the object the service forwards already has `earnedAt`, but we
      // repeat it for safety — mongo sets it from the same Date).
      const chestPush = newChests.map((c) => ({
        ...c,
        earnedAt: stamp,
        claimedAt: null,
        rarity: null,
        credits: null,
      }));
      const achPush = newAchs.map((a) => ({
        ...a,
        unlockedAt: stamp,
      }));

      const totalAchCredits = achPush.reduce((s, a) => s + (Number(a.credits) || 0), 0);

      const update = {};
      if (chestPush.length) update.$push = { ...(update.$push || {}), chests: { $each: chestPush } };
      if (achPush.length) {
        update.$push = { ...(update.$push || {}), achievements: { $each: achPush } };
      }
      if (totalAchCredits > 0) {
        update.$inc = { ...(update.$inc || {}), credits: totalAchCredits };
      }
      if (Object.keys(setOps).length) update.$set = setOps;

      if (!Object.keys(update).length) {
        // Nothing to do — just return the current profile.
        return UserProfile.findOne({ uuid });
      }

      // Upsert so a profile missing the rewards sub-doc arrays still gets them.
      return UserProfile.findOneAndUpdate(
        { uuid },
        update,
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
    },
  };
}

module.exports = { createUserProfileRepository };
