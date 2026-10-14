'use strict';
/**
 * Wiring only. All HTTP semantics live in the controller; all business
 * rules live in the services; all I/O lives in the repositories.
 *
 * Route order matters in Express: literal paths (`/profile`, `/current`)
 * must be registered before the `:id` wildcard.
 */

const express = require('express');

const { createCycleController } = require('../controllers/cycleController');
const {
  cycleLifecycleService,
  taskMutationService,
} = require('../services');

const router = express.Router();
const c = createCycleController({
  lifecycleService: cycleLifecycleService,
  taskMutationService,
});

router.get('/profile', c.getProfile);
router.patch('/profile', c.patchProfile);
router.get('/current', c.getCurrent);
router.get('/', c.list);
router.post('/', c.create);
router.get('/:id', c.getById);
router.patch('/:id', c.patch);
router.post('/:id/finish', c.finish);

module.exports = router;
