'use strict';
/**
 * Default service instances wired to the default repositories (which are
 * wired to the real mongoose models in `repositories/index.js`).
 *
 * Controllers should import from HERE — never instantiate services
 * themselves, and never reach into repositories or models directly.
 *
 * `taskMutationService` is wired in C3 once w3-mutation's M2 has been
 * observed in this workspace (it's already on disk); for now we expose
 * only the lifecycle service so the boot path stays minimal.
 */

const {
  cycleRepository,
  userProfileRepository,
} = require('../repositories');

const { createCycleLifecycleService } = require('./cycleLifecycleService');
const { createTaskMutationService } = require('./taskMutationService');
const { createInsightsService } = require('./insightsService');
const scoreService = require('./scoreService');

const cycleLifecycleService = createCycleLifecycleService({
  cycleRepo: cycleRepository,
  profileRepo: userProfileRepository,
});

const taskMutationService = createTaskMutationService({
  cycleRepo: cycleRepository,
  profileRepo: userProfileRepository,
  scoreService,
});

// v2.2: insights endpoint service (read-only, computed on demand).
const insightsService = createInsightsService({
  cycleRepo: cycleRepository,
});

module.exports = {
  // Default wired services (controllers import these)
  cycleLifecycleService,
  taskMutationService,
  insightsService,
  scoreService,
  // Underlying repositories for server boot housekeeping only.
  cycleRepository,
  userProfileRepository,
};