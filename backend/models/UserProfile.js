const mongoose = require('mongoose');

const UserProfileSchema = new mongoose.Schema({
  uuid: { type: String, default: 'default-user' },
  lifetimeScore: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('UserProfile', UserProfileSchema);
