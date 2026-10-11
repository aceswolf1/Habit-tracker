'use strict';
/**
 * Single source of truth for backend configuration constants.
 *
 * The user-profile uuid is the only stable identifier tying lifetime score
 * to a single user (single-user / small-family deployment). Keep it in ONE
 * place so services, repositories and any future multi-user plumbing can
 * swap it without grepping the codebase.
 */

const PROFILE_UUID = 'default-user';

module.exports = {
  PROFILE_UUID,
};