/**
 * Task metadata constants + validators (D4 + v2.1 task detail fields).
 *
 *   - TAGS         the fixed tag list (D4)
 *   - TIMES_OF_DAY the four slots
 *   - isHHMM       a strict HH:MM validator (24h, no leading whitespace)
 */
'use strict';

const TAGS = Object.freeze(['common', 'rare', 'essential', 'defense']);
const TIMES_OF_DAY = Object.freeze(['morning', 'afternoon', 'evening', 'night']);

/**
 * True when `s` matches `^([01]\d|2[0-3]):[0-5]\d$` — 24-hour HH:MM with
 * no seconds, no AM/PM, no leading whitespace, no AM/PM markers.
 *   '09:00' → true
 *   '23:59' → true
 *   '9:00'  → false (single-digit hour)
 *   '24:00' → false (hour out of range)
 *   ''      → false
 */
function isHHMM(s) {
  if (typeof s !== 'string') return false;
  if (s.length !== 5) return false;
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

module.exports = {
  TAGS,
  TIMES_OF_DAY,
  isHHMM,
};
