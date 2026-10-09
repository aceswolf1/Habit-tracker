#!/usr/bin/env node
/**
 * Thin wrapper so CI / W3 can run: node backend/scripts/test-shared.js
 * Delegates to repo-root shared/test-shared.js (UB-13/14).
 */
'use strict';
require('../../shared/test-shared.js');
