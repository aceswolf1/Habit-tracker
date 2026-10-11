'use strict';
/**
 * UserProfileRepository — the only module allowed to touch the UserProfile
 * mongoose model.
 *
 * The interface is intentionally narrow:
 *   - getOrCreate(uuid)              — profile doc (creates lifetimeScore 0 if missing)
 *   - applyLifetimeDelta(uuid, delta) — max(0, current + delta), updatedAt bumped, saved
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
  };
}

module.exports = { createUserProfileRepository };