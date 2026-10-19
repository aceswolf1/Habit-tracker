'use strict';
/**
 * UB-18 / W2b — single response envelope for `/api/cycles`.
 *
 * Success: { success: true, data: <payload>, meta?: <pagination> }
 * Error:   { success: false, error: { code, message, details? } }
 *
 * Use `ok(res, data)` for 200s, `created(res, data)` for 201s, and
 * `fail(res, status, code, message, details?)` for everything else.
 * 500s should log the underlying error and use `internal(res, err)` so
 * the client only sees a generic message.
 *
 * UB-59: when the JSON logger is present (utils/logger.js), `internal()`
 * records the error as a JSON line with `reqId` when available. We require
 * the logger lazily so this module remains usable from non-HTTP callers
 * (e.g. test-envelope.js) without dragging the whole logger stack in.
 */

let _log = null;
function _getLog() {
  if (_log) return _log;
  try { _log = require('./logger'); } catch { _log = null; }
  return _log;
}

function ok(res, data, meta, status = 200) {
  const body = { success: true, data };
  if (meta) body.meta = meta;
  return res.status(status).json(body);
}

function created(res, data) {
  return ok(res, data, undefined, 201);
}

function fail(res, status, code, message, details) {
  const error = { code, message };
  if (details !== undefined) error.details = details;
  return res.status(status).json({ success: false, error });
}

/**
 * 500 INTERNAL — log the real error server-side, return a generic message.
 *
 * Always calls `console.error` so test-envelope.js (which stubs
 * console.error to verify the underlying error surfaces) keeps passing.
 * When the JSON logger is present it ALSO emits a structured line with
 * reqId so log shippers can correlate the failure with the request.
 */
function internal(res, err, fallbackMessage = 'Internal server error') {
  const stack = err && err.stack ? err.stack : err;
  console.error('[api/internal]', stack);
  const log = _getLog();
  if (log) {
    log.error({
      msg: 'api/internal',
      reqId: (res && res.req && res.req.reqId) || undefined,
      err: String(stack),
    });
  }
  return fail(res, 500, 'INTERNAL', fallbackMessage);
}

/** Convenience for the common 4xx cases. */
const failValidation = (res, details, message = 'Request validation failed') =>
  fail(res, 400, 'VALIDATION_ERROR', message, details);
const failNotFound = (res, message = 'Not found') =>
  fail(res, 404, 'NOT_FOUND', message);
const failFinished = (res, message = 'Cannot modify a finished cycle') =>
  fail(res, 409, 'CYCLE_FINISHED', message);
const failAlreadyClaimed = (res, message = 'Chest already claimed') =>
  fail(res, 409, 'ALREADY_CLAIMED', message);

module.exports = {
  ok,
  created,
  fail,
  internal,
  failValidation,
  failNotFound,
  failFinished,
  failAlreadyClaimed,
};