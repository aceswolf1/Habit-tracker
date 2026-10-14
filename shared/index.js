/**
 * Barrel export for shared PixelPaladin domain helpers (v2.1).
 *
 * Every shared module is CJS (`module.exports = { ... }`). The bundle
 * mergers below intentionally keep the keys distinct so consumers can
 * `require('../shared')` without colliding identical names.
 *
 * Test entry point: `shared/test-shared.js`.
 */
'use strict';

const progress = require('./progress');
const scoring  = require('./scoring');
const dates    = require('./dates');
const habits   = require('./habits');
const levels   = require('./levels');
const bosses   = require('./bosses');
const taskMeta = require('./taskMeta');

module.exports = {
  ...progress,
  ...scoring,
  ...dates,
  ...habits,
  ...levels,
  ...bosses,
  ...taskMeta,
};
