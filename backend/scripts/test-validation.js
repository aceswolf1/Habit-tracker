#!/usr/bin/env node
/**
 * UB-19 — zod validation schemas: valid + invalid bodies for each PATCH type
 * plus POST / + GET / query validation.
 * No extra npm deps.
 * Runnable with: node backend/scripts/test-validation.js
 */

'use strict';

const assert = require('assert');
const {
  createCycleSchema,
  listQuerySchema,
  patchSchema,
  zodDetails,
} = require('../validation/cycleSchemas');

let passed = 0;
function check(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`PASS: ${name}`);
  } catch (err) {
    console.error(`FAIL: ${name}`);
    console.error(err && err.message ? err.message : err);
    process.exit(1);
  }
}

const ok = (label, schema, body) => {
  const r = schema.safeParse(body);
  assert.ok(r.success, `${label}: expected success, got ${JSON.stringify(r.error && r.error.issues)}`);
};
const bad = (label, schema, body) => {
  const r = schema.safeParse(body);
  assert.ok(!r.success, `${label}: expected failure`);
  return r.error;
};

// ---- POST / ---------------------------------------------------------------

check('createCycleSchema accepts {}', () => {
  ok('empty', createCycleSchema, {});
});

check('createCycleSchema accepts { name: "X" }', () => {
  ok('name', createCycleSchema, { name: 'X' });
});

check('createCycleSchema rejects empty name', () => {
  const err = bad('empty name', createCycleSchema, { name: '' });
  const details = zodDetails(err);
  assert.ok(details.length >= 1);
  assert.ok(details[0].path === 'name');
});

check('createCycleSchema rejects name > 80', () => {
  bad('long name', createCycleSchema, { name: 'x'.repeat(81) });
});

check('createCycleSchema rejects unknown keys (strict)', () => {
  bad('extra', createCycleSchema, { name: 'X', evil: 1 });
});

// ---- GET / listQuery -------------------------------------------------------

check('listQuerySchema coerces string limit/offset', () => {
  const r = listQuerySchema.parse({ limit: '25', offset: '10' });
  assert.strictEqual(r.limit, 25);
  assert.strictEqual(r.offset, 10);
});

check('listQuerySchema defaults', () => {
  const r = listQuerySchema.parse({});
  assert.strictEqual(r.limit, 50);
  assert.strictEqual(r.offset, 0);
});

check('listQuerySchema rejects limit > 100', () => {
  bad('limit', listQuerySchema, { limit: '101' });
});

check('listQuerySchema rejects negative offset', () => {
  bad('offset', listQuerySchema, { offset: '-1' });
});

// ---- PATCH addTasks --------------------------------------------------------

check('patchSchema accepts addTasks with one addition', () => {
  ok(
    'addTasks',
    patchSchema,
    {
      type: 'addTasks',
      additions: [
        {
          weekUuid: 'w-1',
          dayUuid: 'd-1',
          task: { description: 'Walk dog', optional: false },
        },
      ],
    }
  );
});

check('patchSchema accepts addTasks with full task fields', () => {
  ok(
    'addTasks full',
    patchSchema,
    {
      type: 'addTasks',
      additions: [
        {
          weekUuid: 'w-1',
          dayUuid: 'd-1',
          task: {
            uuid: 't-1',
            description: 'Read',
            optional: true,
            completed: false,
            legendary: true,
            recurrenceId: 'r-1',
            order: 0,
            icon: '📚',
            gifUrl: 'https://example.com/x.gif',
          },
        },
      ],
    }
  );
});

check('patchSchema rejects addTasks without additions', () => {
  bad('empty additions', patchSchema, { type: 'addTasks', additions: [] });
});

check('patchSchema rejects addTasks with empty task description', () => {
  bad(
    'empty description',
    patchSchema,
    {
      type: 'addTasks',
      additions: [{ weekUuid: 'w-1', dayUuid: 'd-1', task: { description: '', optional: false } }],
    }
  );
});

// ---- PATCH updateTasks -----------------------------------------------------

check('patchSchema accepts updateTasks with completed flag', () => {
  ok(
    'updateTasks',
    patchSchema,
    {
      type: 'updateTasks',
      updates: [{ uuid: 't-1', completed: true }],
    }
  );
});

check('patchSchema accepts updateTasks with multiple field changes', () => {
  ok(
    'updateTasks multi',
    patchSchema,
    {
      type: 'updateTasks',
      updates: [{ uuid: 't-1', description: 'New', optional: true, legendary: false }],
    }
  );
});

check('patchSchema rejects updateTasks without uuid', () => {
  bad(
    'no uuid',
    patchSchema,
    {
      type: 'updateTasks',
      updates: [{ completed: true }],
    }
  );
});

check('patchSchema rejects updateTasks with unknown keys (strict)', () => {
  bad(
    'extra key',
    patchSchema,
    {
      type: 'updateTasks',
      updates: [{ uuid: 't-1', color: 'red' }],
    }
  );
});

// ---- PATCH deleteTasks -----------------------------------------------------

check('patchSchema accepts deleteTasks with taskUuids', () => {
  ok('deleteTasks taskUuids', patchSchema, {
    type: 'deleteTasks',
    taskUuids: ['t-1', 't-2'],
  });
});

check('patchSchema accepts deleteTasks with recurrenceId', () => {
  ok('deleteTasks recurrenceId', patchSchema, {
    type: 'deleteTasks',
    recurrenceId: 'r-1',
  });
});

check('patchSchema rejects deleteTasks with neither taskUuids nor recurrenceId', () => {
  const err = bad('deleteTasks neither', patchSchema, { type: 'deleteTasks' });
  const details = zodDetails(err);
  assert.ok(
    details.some((d) => /exactly one/.test(d.message)),
    'expected XOR error message'
  );
});

check('patchSchema rejects deleteTasks with both', () => {
  bad('deleteTasks both', patchSchema, {
    type: 'deleteTasks',
    taskUuids: ['t-1'],
    recurrenceId: 'r-1',
  });
});

check('patchSchema rejects deleteTasks with empty taskUuids', () => {
  bad('deleteTasks empty taskUuids', patchSchema, {
    type: 'deleteTasks',
    taskUuids: [],
  });
});

// ---- PATCH moveTasks -------------------------------------------------------

check('patchSchema accepts moveTasks with required fields', () => {
  ok(
    'moveTasks',
    patchSchema,
    { type: 'moveTasks', taskUuid: 't-1', targetDayUuid: 'd-2' }
  );
});

check('patchSchema accepts moveTasks with optional targetIndex', () => {
  ok(
    'moveTasks index',
    patchSchema,
    { type: 'moveTasks', taskUuid: 't-1', targetDayUuid: 'd-2', targetIndex: 3 }
  );
});

check('patchSchema rejects moveTasks without taskUuid', () => {
  bad('moveTasks no uuid', patchSchema, {
    type: 'moveTasks',
    targetDayUuid: 'd-2',
  });
});

check('patchSchema rejects moveTasks without targetDayUuid', () => {
  bad('moveTasks no target', patchSchema, {
    type: 'moveTasks',
    taskUuid: 't-1',
  });
});

check('patchSchema rejects moveTasks with negative targetIndex', () => {
  bad('moveTasks negative index', patchSchema, {
    type: 'moveTasks',
    taskUuid: 't-1',
    targetDayUuid: 'd-2',
    targetIndex: -1,
  });
});

// ---- Discriminator ---------------------------------------------------------

check('patchSchema rejects unknown type', () => {
  const err = bad('unknown type', patchSchema, { type: 'flyToTheMoon' });
  assert.ok(
    err.issues.some((i) => /discriminator/i.test(i.message)),
    'expected discriminator error'
  );
});

check('patchSchema rejects missing type', () => {
  bad('missing type', patchSchema, {});
});

check('zodDetails flattens paths with "."', () => {
  const err = patchSchema.safeParse({
    type: 'addTasks',
    additions: [{ weekUuid: 'w-1', dayUuid: 'd-1', task: { description: '', optional: false } }],
  }).error;
  const details = zodDetails(err);
  assert.ok(
    details.some((d) => d.path === 'additions.0.task.description'),
    `expected flattened path, got ${JSON.stringify(details)}`
  );
});

// ---- W5: GIF renditions ----------------------------------------------------

check('W5: addTasks accepts gifVideoUrl + gifStillUrl', () => {
  ok('add renditions', patchSchema, {
    type: 'addTasks',
    additions: [{ weekUuid: 'w-1', dayUuid: 'd-1', task: {
      description: 'GIF task', optional: false,
      gifUrl: 'https://example.com/x.gif',
      gifVideoUrl: 'https://example.com/x.mp4',
      gifStillUrl: 'https://example.com/x.jpg',
    } }],
  });
});

check('W5: updateTasks accepts null renditions (clear) and rejects ""', () => {
  ok('null clears', patchSchema, { type: 'updateTasks', updates: [{ uuid: 't-1', gifVideoUrl: null, gifStillUrl: null }] });
  bad('empty string', patchSchema, { type: 'updateTasks', updates: [{ uuid: 't-1', gifVideoUrl: '' }] });
  bad('not a url', patchSchema, { type: 'updateTasks', updates: [{ uuid: 't-1', gifStillUrl: 'nope' }] });
});

console.log(`\n${passed} checks passed`);
process.exit(0);