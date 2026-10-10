'use strict';
/**
 * UB-18 / W2b — single response envelope for `/api/cycles`.
 *
 * Success: { success: true, data: <payload>, meta?: <pagination> }
 * Error:   { success: false, error: { code, message, details? } }
 *
 * Use `ok(res, data)` for 200s, `created(res, data)` for 201s, and
 * `fail(res, status, code, message, details?)` for everything else.
 * 500s should log the underlying error via `console.error` and use
 * `internal(res, err)` so the client only sees a generic message.
 */

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
 */
function internal(res, err, fallbackMessage = 'Internal server error') {
  console.error('[api/internal]', err && err.stack ? err.stack : err);
  return fail(res, 500, 'INTERNAL', fallbackMessage);
}

/** Convenience for the common 4xx cases. */
const failValidation = (res, details, message = 'Request validation failed') =>
  fail(res, 400, 'VALIDATION_ERROR', message, details);
const failNotFound = (res, message = 'Not found') =>
  fail(res, 404, 'NOT_FOUND', message);
const failFinished = (res, message = 'Cannot modify a finished cycle') =>
  fail(res, 409, 'CYCLE_FINISHED', message);

module.exports = {
  ok,
  created,
  fail,
  internal,
  failValidation,
  failNotFound,
  failFinished,
};