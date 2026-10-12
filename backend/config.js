'use strict';
/**
 * Single source of truth for backend configuration constants.
 *
 * The user-profile uuid is the only stable identifier tying lifetime score
 * to a single user (single-user / small-family deployment). Keep it in ONE
 * place so services, repositories and any future multi-user plumbing can
 * swap it without grepping the codebase.
 *
 * UB-58: read from the `USER_PROFILE_UUID` env var so a multi-tenant NAS
 * can run isolated backend instances (different uuid per family member)
 * without code changes. Default stays `default-user` for back-compat.
 */

const PROFILE_UUID = process.env.USER_PROFILE_UUID || 'default-user';

module.exports = {
  PROFILE_UUID,
};