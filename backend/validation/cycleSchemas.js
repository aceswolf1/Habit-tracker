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
  })
  .strict();

const taskUpdateSchema = z
  .object({
    uuid: uuid,
    description: shortText(280).optional(),
    optional: z.boolean().optional(),
    completed: z.boolean().optional(),
    legendary: z.boolean().optional(),
    icon: z.string().min(1).max(32).optional(),
    gifUrl: z.string().url().max(2048).optional(),
    order: z.number().int().nonnegative().optional(),
  })
  .strict();

// --- POST /  (create empty cycle) -------------------------------------------

const createCycleSchema = z
  .object({
    name: z.string().min(1).max(80).optional(),
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

const patchSchema = z.discriminatedUnion('type', [
  addTasksSchema,
  updateTasksSchema,
  deleteTasksSchema,
  moveTasksSchema,
]);

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
  zodDetails,
  // exposed for tests
  _internal: {
    addTasksSchema,
    updateTasksSchema,
    deleteTasksBaseSchema,
    deleteTasksSchema,
    moveTasksSchema,
    taskInputSchema,
    taskUpdateSchema,
  },
};