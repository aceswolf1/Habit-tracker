'use strict';
/**
 * Wiring only. All HTTP semantics live in the controller; all business
 * rules live in the services; all I/O lives in the repositories.
 *
 * Route order matters: literal paths (`/profile`, `/insights`, `/rewards`,
 * `/current`) and `/rewards/chests/:chestId/claim` MUST come before `/:id`.
 */

const express = require('express');
const { createCycleController } = require('../controllers/cycleController');
const {
  cycleLifecycleService, taskMutationService, insightsService,
} = require('../services');

const router = express.Router();
const c = createCycleController({
  lifecycleService: cycleLifecycleService,
  taskMutationService,
  insightsService,
});

router.get('/profile', c.getProfile);
router.patch('/profile', c.patchProfile);
router.get('/insights', c.getInsights);
router.get('/rewards', c.getRewards);
router.post('/rewards/chests/:chestId/claim', c.claimChest);
router.get('/current', c.getCurrent);
router.get('/', c.list);
router.post('/', c.create);
router.get('/:id', c.getById);
router.patch('/:id', c.patch);
router.post('/:id/finish', c.finish);

module.exports = router;
