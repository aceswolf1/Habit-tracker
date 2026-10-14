'use strict';
/**
 * UB-19 / W2b — Zod validation schemas for `/api/cycles`.
 * Single source of truth for request bodies on this router.
 * Fields derived from `frontend/stores/monthStore.ts` action call sites.
 */

const { z } = require('zod');

// --- Primitives --------------------------------------------------------------

const uuid = z.string().min(1, 'uuid required').max(128);
// short non-empty string with a sanity cap; front-end drives lengths
const shortText = (max) => z.string().min(1).max(max);

// Shared enums for v2.1 task metadata.
const { TAGS, TIMES_OF_DAY } = require('../../shared/taskMeta');
const { isIsoDate, isMonday } = require('../../shared/dates');

const tagEnum = z.enum(TAGS);
const timeOfDayEnum = z.enum(TIMES_OF_DAY);
// `inputDurationMin` is the optional-on-add variant (omitted = no duration set).
// `updateDurationMin` is the nullable-on-update variant that lets the FE
// explicitly clear `durationMin` (FIX-01 parity).
const inputDurationMin = z.number().int().min(1).max(1440).optional();
const updateDurationMin = z.number().int().min(1).max(1440).nullable().optional();

/** 'YYYY-MM-DD' that is also a Monday. Used by createCycleSchema.startDate
 *  and by updateCycleSchema.startDate. Both reject invalid dates AND
 *  dates that exist but aren't Mondays. */
const mondayIso = z.string().refine(isIsoDate, { message: 'startDate must be YYYY-MM-DD' })
  .refine(isMonday, { message: 'startDate must be a Monday' });

// --- Task sub-shapes (shared by addTasks + updateTasks) ----------------------

const taskInputSchema = z
  .object({
    uuid: uuid.optional(), // FE always supplies today; allow omission for server-assigned
    description: shortText(280),
    optional: z.boolean(),
    completed: z.boolean().optional().default(false),
    legendary: z.boolean().optional().default(false),
    recurrenceId: z.string().min(1).max(128).optional(),
    order: z.number().int().nonnegative().optional(),
    icon: z.string().min(1).max(32).optional(),
    gifUrl: z.string().url().max(2048).optional(),
    // W5: MP4 + JPG renditions of the same GIF (optional; travel with gifUrl).
    gifVideoUrl: z.string().url().max(2048).optional(),
    gifStillUrl: z.string().url().max(2048).optional(),
    // V2: optional free-form note for a task. Capped at 280 chars to match
    // `description`; the FE shows a live char counter and rejects longer input.
    notes: shortText(280).optional(),
    // v2.1 task metadata — all optional. Server assigns `habitId` when missing
    // on add; passes through when provided.
    habitId: z.string().min(1).max(64).optional(),
    tag: tagEnum.optional(),
    durationMin: inputDurationMin,
    timeOfDay: timeOfDayEnum.optional(),
    dueTime: z.string().refine(
      (s) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s),
      { message: 'dueTime must be HH:MM (24-hour)' }
    ).optional(),
    // v2.1: clients never send completedAt; the server maintains it. We
    // accept it on addTasks only when completed:true (seeded add), but the
    // service always overrides it. Keep it absent from the input schema
    // to enforce the contract; remove this if you decide to allow seeding.
  })
  .strict();

const taskUpdateSchema = z
  .object({
    uuid: uuid,
    description: shortText(280).optional(),
    optional: z.boolean().optional(),
    completed: z.boolean().optional(),
    legendary: z.boolean().optional(),
    // FIX-01: `null` is allowed and means "clear the field" server-side.
    // Empty string remains invalid; `undefined` keeps the existing value.
    icon: z.string().min(1).max(32).nullable().optional(),
    gifUrl: z.string().url().max(2048).nullable().optional(),
    gifVideoUrl: z.string().url().max(2048).nullable().optional(),
    gifStillUrl: z.string().url().max(2048).nullable().optional(),
    // V2: notes accept `null` to clear, `undefined` to leave alone.
    notes: shortText(280).nullable().optional(),
    order: z.number().int().nonnegative().optional(),
    // v2.1 task metadata. `tag`, `durationMin`, `timeOfDay`, `dueTime`
    // accept `null` to clear (FIX-01 parity with notes/gifUrl). `habitId`
    // accepts a string only — clearing a habit id is not allowed (D3).
    habitId: z.string().min(1).max(64).optional(),
    tag: tagEnum.nullable().optional(),
    durationMin: updateDurationMin,
    timeOfDay: timeOfDayEnum.nullable().optional(),
    dueTime: z.string().refine(
      (s) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s),
      { message: 'dueTime must be HH:MM (24-hour)' }
    ).nullable().optional(),
  })
  .strict();

// --- POST /  (create empty cycle) -------------------------------------------

const createCycleSchema = z
  .object({
    name: z.string().min(1).max(80).optional(),
    // v2.1: optional Monday 'YYYY-MM-DD'. When present, day dates become
    // derivable and the API surfaces `startDate` on every subsequent read.
    startDate: mondayIso.optional(),
  })
  .strict();

// --- GET /  query params -----------------------------------------------------

const listQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).optional().default(50),
    offset: z.coerce.number().int().min(0).optional().default(0),
  })
  .passthrough();

// --- PATCH /:id discriminated union -----------------------------------------
//
// Each branch lists its keys explicitly via .strict() so a typo from the FE
// store won't silently no-op (UB-19). `deleteTasks` accepts exactly one of
// {taskUuids} or {recurrenceId} — the discriminated union narrows on `type`,
// and a per-branch refine enforces the XOR.

const addTasksSchema = z
  .object({
    type: z.literal('addTasks'),
    additions: z
      .array(
        z
          .object({
            weekUuid: uuid,
            dayUuid: uuid,
            task: taskInputSchema,
          })
          .strict()
      )
      .min(1),
  })
  .strict();

const updateTasksSchema = z
  .object({
    type: z.literal('updateTasks'),
    updates: z.array(taskUpdateSchema).min(1),
  })
  .strict();

const deleteTasksBaseSchema = z
  .object({
    type: z.literal('deleteTasks'),
    taskUuids: z.array(uuid).min(1).optional(),
    recurrenceId: z.string().min(1).max(128).optional(),
  })
  .strict();

const deleteTasksSchema = deleteTasksBaseSchema.refine(
  (b) => Boolean(b.taskUuids) !== Boolean(b.recurrenceId),
  {
    message:
      'deleteTasks requires exactly one of: taskUuids (non-empty array) or recurrenceId (string)',
    path: ['deleteTasks'],
  }
);

const moveTasksSchema = z
  .object({
    type: z.literal('moveTasks'),
    taskUuid: uuid,
    targetDayUuid: uuid,
    targetIndex: z.number().int().nonnegative().optional(),
  })
  .strict();

/**
 * v2.1: `updateCycle` PATCH branch — edits a cycle's metadata (name +
 * startDate) without touching its weeks. At least one key is required;
 * `startDate: null` clears the start date (back to undated). Returns
 * the same `{cycle, pointsEarned, isLegendary, currentTier}` shape as
 * the other PATCH branches.
 */
const updateCycleBaseSchema = z
  .object({
    type: z.literal('updateCycle'),
    name: z.string().min(1).max(80).optional(),
    startDate: mondayIso.nullable().optional(),
  })
  .strict();

const updateCycleSchema = updateCycleBaseSchema.refine(
  (b) => b.name !== undefined || b.startDate !== undefined,
  {
    message: 'updateCycle requires at least one of: name, startDate',
    path: ['updateCycle'],
  }
);

const patchSchema = z.discriminatedUnion('type', [
  addTasksSchema,
  updateTasksSchema,
  deleteTasksSchema,
  moveTasksSchema,
  updateCycleSchema,
]);

// --- Profile PATCH (v2.1) ---------------------------------------------------
//
// `PATCH /api/cycles/profile` — edits the player display name.
// `null` clears the field. At least one key is required (only one for now).
const patchProfileBaseSchema = z
  .object({
    displayName: z.string().min(1).max(24).nullable().optional(),
  })
  .strict();

const patchProfileSchema = patchProfileBaseSchema.refine(
  (b) => b.displayName !== undefined,
  {
    message: 'profile PATCH requires displayName',
    path: ['displayName'],
  }
);

// --- Error formatting --------------------------------------------------------

/**
 * Convert a zod ZodError into the contract's `details` array: `[{path, message}]`.
 * zod v4 exposes `error.issues`; each issue has `path` (array) and `message`.
 */
function zodDetails(err) {
  const issues = (err && err.issues) || [];
  return issues.map((i) => ({
    path: Array.isArray(i.path) ? i.path.join('.') : String(i.path || ''),
    message: i.message,
  }));
}

module.exports = {
  createCycleSchema,
  listQuerySchema,
  patchSchema,
  patchProfileSchema,
  zodDetails,
  // exposed for tests
  _internal: {
    addTasksSchema,
    updateTasksSchema,
    deleteTasksBaseSchema,
    deleteTasksSchema,
    moveTasksSchema,
    updateCycleSchema,
    patchProfileBaseSchema,
    taskInputSchema,
    taskUpdateSchema,
  },
};
