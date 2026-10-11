'use strict';
/**
 * Default repository instances wired to the real mongoose models.
 *
 * `server.js` should import models from HERE (only for `syncIndexes` boot
 * housekeeping). Services and controllers should import the wired instances
 * from `backend/services/index.js`, never from `../models/*` directly.
 */

const Cycle = require('../models/Cycle');
const UserProfile = require('../models/UserProfile');

const { createCycleRepository } = require('./cycleRepository');
const { createUserProfileRepository } = require('./userProfileRepository');

const cycleRepository = createCycleRepository({ Cycle });
const userProfileRepository = createUserProfileRepository({ UserProfile });

module.exports = {
  // Default instances (used by services + server boot)
  cycleRepository,
  userProfileRepository,
  // Models (only for server boot housekeeping like syncIndexes).
  // No other file outside repositories/ may import models.
  Cycle,
  UserProfile,
  // Factories (re-exported for tests / fakes)
  createCycleRepository,
  createUserProfileRepository,
};