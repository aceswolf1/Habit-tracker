const mongoose = require('mongoose');

const ChestSchema = new mongoose.Schema({
  // Server-assigned uuid; looks like `ch-<base36>` (see shared/progress.generateUuid).
  id: { type: String, required: true, unique: false },
  // 2..N: the level that earned this chest. F1 guarantees one chest per level.
  level: { type: Number, required: true },
  // When the chest was added to the profile (Date).
  earnedAt: { type: Date, default: Date.now },
  // When the player OPENED the chest. `null` while unclaimed.
  claimedAt: { type: Date, default: null },
  // Server-side roll; present only after claim.
  rarity: { type: String, enum: ['common', 'rare', 'epic', 'legendary'], default: null },
  // Credits awarded on claim. Mirrors shared/rewards.CHEST_CREDITS[rarity].
  credits: { type: Number, default: null },
}, { _id: false });

const AchievementSchema = new mongoose.Schema({
  // Catalog id (`first-blood`, `grinder-100`, …).
  id: { type: String, required: true },
  unlockedAt: { type: Date, default: Date.now },
  // Credits granted ONCE per id; mirrors shared/achievements.ACHIEVEMENT_CREDITS[size].
  credits: { type: Number, required: true },
}, { _id: false });

const UserProfileSchema = new mongoose.Schema({
  uuid: { type: String, default: 'default-user', unique: true },
  lifetimeScore: { type: Number, default: 0 },
  // v2.1: optional player display name (1..24 chars). Set via
  // `PATCH /api/cycles/profile` with body `{ displayName: string|null }`.
  // `null` clears the field. Distinct from `uuid` which is the canonical
  // profile identifier; `displayName` is purely cosmetic.
  displayName: { type: String, maxlength: 24, default: null },
  // v2.3 (D5): separate credits balance granted by chest + achievement
  // unlocks. Spending lives in v2.4 and never touches XP/tier/lifetime.
  credits: { type: Number, default: 0, min: 0 },
  // v2.3: per-level chests. The shape is declared in `ChestSchema`;
  // `id` is the deterministic server id keyed off `level` so backfilling
  // is idempotent.
  chests: { type: [ChestSchema], default: [] },
  // v2.3: unlocked-achievement ledger. `id` is the catalog id; rows
  // accumulate once per id (achievementUnlocked fires only on a NEW row).
  achievements: { type: [AchievementSchema], default: [] },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('UserProfile', UserProfileSchema);
