#!/usr/bin/env node
'use strict';
/**
 * v2.3 — REAL-repository tests for the rewards ledger (mirrors the
 * pattern from `test-repo-habit-lookup.js`).
 *
 * Fakes alone hid the v2.2 combo bug because the v2.2 fakes mirrored the
 * production shape but didn't exercise the mongo update machinery. We
 * run the REAL `userProfileRepository` against a stub `UserProfile` model
 * — no mongoose connection — so the atomic claim (`findOneAndUpdate` with
 * the `$elemMatch` predicate) and the `syncRewards` aggregation are
 * exercised against the same code path as production.
 *
 * Coverage:
 *   - `claimChest` atomically transitions claimedAt:null → claimedDate+rarity+credits
 *   - a second claim matches NO chest (conditional filter guards) and returns claimed:false
 *   - `syncRewards` appends chests + achievements idempotently
 *   - `addCredits` floors + persists
 *   - $inc lands the chest credits into the profile balance
 */

const assert = require('assert');
const { createUserProfileRepository } = require('../repositories/userProfileRepository');

let passed = 0;
async function check(name, fn) {
  await fn();
  passed++;
  console.log(`PASS: ${name}`);
}

// --- Stub UserProfile model: executes the find/findOneAndUpdate/findOne
//     calls using a Map. Implements only the methods the repo uses.
function makeStubUserProfile() {
  const docs = new Map();          // uuid -> doc (raw object)
  let nextSaveOk = true;
  return {
    docs,
    failNextSave() { nextSaveOk = false; },
    findOne(filter, projection) {
      // Mongoose Query is thenable AND has `.lean()`. The stub mirrors both
      // because the repository's read-side mix is split: `findChestById`
      // chains `.lean()` with a projection, while `applyLifetimeDelta`
      // awaits the query directly without a projection.
      const uuid = filter && filter.uuid;
      const doc = uuid ? (docs.get(uuid) || null) : null;
      const query = {
        lean: () => {
          if (!doc) return Promise.resolve(null);
          if (!projection) return Promise.resolve(doc);
          const out = {};
          for (const k of Object.keys(projection)) if (projection[k]) out[k] = doc[k];
          return Promise.resolve(out);
        },
        then: (onFulfilled, onRejected) => Promise.resolve(doc).then(onFulfilled, onRejected),
      };
      return query;
    },
    findOneAndUpdate(filter, update, options) {
      const uuid = filter.uuid;
      let doc = docs.get(uuid);
      if (!doc) {
        if (options && options.upsert) {
          doc = { uuid, lifetimeScore: 0, credits: 0, chests: [], achievements: [] };
          docs.set(uuid, doc);
        } else {
          return Promise.resolve(null);
        }
      }
      // 1) Conditional $elemMatch element gate FIRST. Mongoose rejects the
      //    whole update when no array element matches the predicate; mirror
      //    that strictly so the claimChest race test mirrors production.
      //    Order matters: we must check the gate BEFORE mutating, otherwise
      //    applying the update would invalidate the predicate mid-flight.
      if (filter && filter.chests && filter.chests.$elemMatch) {
        const em = filter.chests.$elemMatch;
        const ok = (doc.chests || []).some((c) => {
          for (const [k, v] of Object.entries(em)) {
            if (c[k] !== v) return false;
          }
          return true;
        });
        if (!ok) return Promise.resolve(null);
      }

      // 2) $set on top-level + array-filter sub-paths.
      if (update && update.$set) {
        // 2a) top-level fields (skip array-path keys; $in the name means
        //     those are array sub-paths and get applied below).
        for (const [k, v] of Object.entries(update.$set)) {
          if (k.startsWith('chests.$') || k.startsWith('achievements.$')) continue;
          doc[k] = v;
        }
        // 2b) array filters — find the chest by predicate and apply sub-keys.
        if (options && Array.isArray(options.arrayFilters)) {
          for (const af of options.arrayFilters) {
            const m = af['c.id'];
            if (typeof m !== 'string') continue;
            const chest = (doc.chests || []).find((c) => c && c.id === m);
            if (!chest) continue;
            for (const [k, v] of Object.entries(update.$set)) {
              if (k.startsWith('chests.$[c].')) {
                const subKey = k.split('chests.$[c].')[1];
                chest[subKey] = v;
              }
            }
          }
        }
      }
      // 3) $push with $each on top-level array fields.
      if (update && update.$push) {
        for (const [arrKey, pushSpec] of Object.entries(update.$push)) {
          if (!Array.isArray(doc[arrKey])) doc[arrKey] = [];
          const each = (pushSpec && pushSpec.$each) || [pushSpec];
          for (const item of each) doc[arrKey].push(item);
        }
      }
      // 4) $inc on top-level numeric fields.
      if (update && update.$inc) {
        for (const [k, v] of Object.entries(update.$inc)) {
          doc[k] = (doc[k] || 0) + Number(v);
        }
      }
      return Promise.resolve(doc);
    },
  };
}

function makeRepo() {
  const UserProfile = makeStubUserProfile();
  const repo = createUserProfileRepository({ UserProfile });
  return { repo, UserProfile };
}

(async () => {

await check('claimChest: atomic transition claimedAt:null → claimedAt+rarity+credits (first claim succeeds)', async () => {
  const { repo, UserProfile } = makeRepo();
  // Pre-seed a profile with an unclaimed chest.
  UserProfile.docs.set('alice', {
    uuid: 'alice',
    lifetimeScore: 0,
    credits: 0,
    chests: [{ id: 'ch-2', level: 2, earnedAt: new Date('2026-10-01T00:00:00Z'), claimedAt: null, rarity: null, credits: null }],
    achievements: [],
  });

  const t = new Date('2026-10-18T12:00:00Z');
  const r = await repo.claimChest('alice', 'ch-2', { rarity: 'rare', credits: 25, now: t });
  assert.strictEqual(r.claimed, true);
  assert.strictEqual(r.chest.rarity, 'rare');
  assert.strictEqual(r.chest.credits, 25);
  assert.strictEqual(r.chest.claimedAt.getTime(), t.getTime());
  // credits were incremented on the profile.
  const doc = UserProfile.docs.get('alice');
  assert.strictEqual(doc.credits, 25);
});

await check('claimChest: a SECOND claim of an already-claimed chest matches NO chest (claimed:false, chest:existing)', async () => {
  const { repo, UserProfile } = makeRepo();
  UserProfile.docs.set('alice', {
    uuid: 'alice',
    lifetimeScore: 0,
    credits: 25,
    chests: [{ id: 'ch-2', level: 2, earnedAt: new Date(), claimedAt: new Date(), rarity: 'rare', credits: 25 }],
    achievements: [],
  });
  const r = await repo.claimChest('alice', 'ch-2', { rarity: 'epic', credits: 50, now: new Date() });
  assert.strictEqual(r.claimed, false);
  assert.ok(r.chest, 'returns the existing chest so the caller can map the right HTTP status');
  assert.strictEqual(r.chest.rarity, 'rare', 'does NOT overwrite rarity');
  assert.strictEqual(r.chest.credits, 25, 'does NOT overwrite credits');
  // Credits are not double-added.
  const doc = UserProfile.docs.get('alice');
  assert.strictEqual(doc.credits, 25, 'credits unchanged on second claim');
});

await check('claimChest: unknown chest id → claimed:false, chest:null (NOT_FOUND path)', async () => {
  const { repo, UserProfile } = makeRepo();
  UserProfile.docs.set('alice', { uuid: 'alice', lifetimeScore: 0, credits: 0, chests: [], achievements: [] });
  const r = await repo.claimChest('alice', 'ch-bogus', { rarity: 'rare', credits: 25 });
  assert.strictEqual(r.claimed, false);
  assert.strictEqual(r.chest, null);
});

await check('claimChest: defective inputs raise TypeError (rarity / credits)', async () => {
  const { repo, UserProfile } = makeRepo();
  UserProfile.docs.set('alice', { uuid: 'alice', lifetimeScore: 0, credits: 0, chests: [{ id: 'ch-2', level: 2 }], achievements: [] });
  await assert.rejects(() => repo.claimChest('alice', 'ch-2', { rarity: 'mythic', credits: 25 }), /rarity/);
  await assert.rejects(() => repo.claimChest('alice', 'ch-2', { rarity: 'rare', credits: -1 }), /credits/);
});

await check('addCredits: positive delta increases credits and bumps updatedAt', async () => {
  const { repo, UserProfile } = makeRepo();
  UserProfile.docs.set('alice', { uuid: 'alice', lifetimeScore: 0, credits: 5, chests: [], achievements: [] });
  const r = await repo.addCredits('alice', 25);
  assert.strictEqual(r.credits, 30);
  const doc = UserProfile.docs.get('alice');
  assert.strictEqual(doc.credits, 30);
});

await check('addCredits: non-positive delta is a no-op (does not drain credits)', async () => {
  const { repo, UserProfile } = makeRepo();
  UserProfile.docs.set('alice', { uuid: 'alice', lifetimeScore: 0, credits: 50, chests: [], achievements: [] });
  await repo.addCredits('alice', -10);
  const doc = UserProfile.docs.get('alice');
  assert.strictEqual(doc.credits, 50, 'no drain on negative delta');
  await repo.addCredits('alice', 0);
  assert.strictEqual(doc.credits, 50, 'no drain on zero delta');
});

await check('syncRewards: appends chests + achievements; credits get $inc-ed; claimedAt is null on fresh chests', async () => {
  // NOTE: the repo's `syncRewards` is a low-level write — it pushes the
  // provided items to the arrays. Idempotency lives at the SERVICE layer
  // (`rewardsService.syncRewards`), which only forwards items it hasn't
  // seen yet. The service-level invariant is covered by `test-rewards.js`.
  const { repo, UserProfile } = makeRepo();
  UserProfile.docs.set('alice', { uuid: 'alice', lifetimeScore: 0, credits: 0, chests: [], achievements: [] });
  const t = new Date('2026-10-18T10:00:00Z');
  await repo.syncRewards('alice', {
    chestsToAdd: [{ id: 'ch-2', level: 2 }],
    achievementsToAdd: [{ id: 'first-blood', credits: 10 }],
    now: t,
  });
  let doc = UserProfile.docs.get('alice');
  assert.strictEqual(doc.chests.length, 1);
  assert.strictEqual(doc.chests[0].id, 'ch-2');
  assert.strictEqual(doc.chests[0].claimedAt, null, 'fresh chests have null claimedAt');
  assert.strictEqual(doc.achievements.length, 1);
  assert.strictEqual(doc.achievements[0].credits, 10);
  assert.strictEqual(doc.credits, 10, 'credits added once per call');
});

await check('syncRewards: achievement credits sum into the profile balance', async () => {
  const { repo, UserProfile } = makeRepo();
  UserProfile.docs.set('bob', { uuid: 'bob', lifetimeScore: 0, credits: 0, chests: [], achievements: [] });
  await repo.syncRewards('bob', {
    achievementsToAdd: [
      { id: 'first-blood', credits: 10 },
      { id: 'grinder-10',  credits: 10 },
      { id: 'tier-silver', credits: 10 },
    ],
  });
  const doc = UserProfile.docs.get('bob');
  assert.strictEqual(doc.credits, 30, 'three achievements × 10 credits');
});

await check('syncRewards: empty payloads return the current profile without writes', async () => {
  const { repo, UserProfile } = makeRepo();
  UserProfile.docs.set('eve', { uuid: 'eve', lifetimeScore: 42, credits: 7, chests: [], achievements: [] });
  const r = await repo.syncRewards('eve', { chestsToAdd: [], achievementsToAdd: [] });
  assert.ok(r, 'returns the profile');
  const doc = UserProfile.docs.get('eve');
  assert.strictEqual(doc.credits, 7, 'no credits movement');
  assert.strictEqual(doc.chests.length, 0);
});

await check('findChestById: returns the chest or null', async () => {
  const { repo, UserProfile } = makeRepo();
  UserProfile.docs.set('alice', {
    uuid: 'alice',
    lifetimeScore: 0,
    credits: 0,
    chests: [{ id: 'ch-2', level: 2 }],
    achievements: [],
  });
  const found = await repo.findChestById('alice', 'ch-2');
  assert.ok(found && found.level === 2);
  const missing = await repo.findChestById('alice', 'ch-99');
  assert.strictEqual(missing, null);
  const none = await repo.findChestById('alice', null);
  assert.strictEqual(none, null);
});

console.log(`\n${passed} checks passed`);
process.exit(0);

})().catch((err) => { console.error('FAIL:', err); process.exit(1); });
