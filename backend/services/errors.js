'use strict';
/**
 * Domain errors thrown by services.
 *
 * Controllers map these to HTTP status codes:
 *   NOT_FOUND        → 404
 *   CYCLE_FINISHED   → 409
 *   ALREADY_CLAIMED  → 409 (v2.3 chest double-claim guard)
 *   VALIDATION_ERROR → 400 (with details)
 * Anything else thrown from a service is caught by the controller and
 * turned into a generic 500 INTERNAL (no leaked details).
 */
class DomainError extends Error {
  constructor(code, message, details) {
    super(message);
    this.name = 'DomainError';
    this.code = code; // 'NOT_FOUND' | 'CYCLE_FINISHED' | 'ALREADY_CLAIMED' | 'VALIDATION_ERROR'
    if (details !== undefined) this.details = details;
  }
}

const notFound = (msg) => new DomainError('NOT_FOUND', msg);
const cycleFinished = (msg) => new DomainError('CYCLE_FINISHED', msg);
const alreadyClaimed = (msg) => new DomainError('ALREADY_CLAIMED', msg);

module.exports = {
  DomainError,
  notFound,
  cycleFinished,
  alreadyClaimed,
};