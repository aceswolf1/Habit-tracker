const mongoose = require('mongoose');

const UserProfileSchema = new mongoose.Schema({
  uuid: { type: String, default: 'default-user', unique: true },
  lifetimeScore: { type: Number, default: 0 },
  // v2.1: optional player display name (1..24 chars). Set via
  // `PATCH /api/cycles/profile` with body `{ displayName: string|null }`.
  // `null` clears the field. Distinct from `uuid` which is the canonical
  // profile identifier; `displayName` is purely cosmetic.
  displayName: { type: String, maxlength: 24, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('UserProfile', UserProfileSchema);
