# PixelPaladin Backend

Express + Mongoose API. Mounted at `/api/cycles` inside `server.js`. Owns the
v2 envelope and zod-validated PATCH bodies.

## Layering (W3)

The backend is split into five layers with one-way dependencies:
`routes → controllers → services → repositories → models`.

```
backend/
├── server.js                      # Express app, Mongo connect, mount /api/cycles
├── config.js                      # PROFILE_UUID constant
├── models/                        # Cycle.js, UserProfile.js (Mongoose schemas)
├── repositories/                  # The ONLY layer that touches mongoose
│   ├── cycleRepository.js         #   findByUuid / findCurrentUnfinished /
│   │                              #   listSummaries / create / save
│   ├── userProfileRepository.js   #   getOrCreate / applyLifetimeDelta (floor 0)
│   └── index.js                   #   default instances wired to real models
├── services/                      # Business rules; no req/res; no mongoose
│   ├── errors.js                  #   DomainError(NOT_FOUND|CYCLE_FINISHED|…)
│   ├── scoreService.js            #   pure: tierFor, scoreCompletionFlips
│   ├── taskMutationService.js     #   patchCycle + pure applyAdditions/Updates/Deletes/Move
│   ├── cycleLifecycleService.js   #   getOrCreateCurrent / list / finish / getProfile
│   └── index.js                   #   default wired instances
├── controllers/cycleController.js # Parse zod → call service → respond.js envelope;
│                                  # DomainError → 404/409/400 mapping
├── routes/cycleRoutes.js          # Wiring only (router.<verb>(path, c.fn)); < 40 lines
├── validation/cycleSchemas.js     # zod v4 schemas; strict (extra keys → 400)
├── utils/                         # respond.js (envelope), statistics
└── scripts/                       # node-harness tests + fakes/
    ├── fakes/                     #   in-memory repos matching the contract
    └── test-*.js                  #   unit + service tests (no mongoose)
shared/                            # progress.js, scoring.js — single source of truth
```

### Where business rules live

| Concern                                         | File                                       |
|-------------------------------------------------|--------------------------------------------|
| Tier thresholds / point tables / legendary ×3   | `shared/scoring.js`                        |
| Week + month progress + optional bonus + cap    | `shared/progress.js`                       |
| Scoring orchestration (UB-06 order, UB-10 floor, CYCLE_FINISHED guard) | `services/taskMutationService.js` |
| Pure mutation helpers (`applyMove`, `applyUpdates`, …) | `services/taskMutationService.js` |
| Statistics on finish                            | `utils/statisticsCalculator.calculateAllStatistics` invoked from `services/cycleLifecycleService.finish` |
| Profile uuid (single constant)                  | `config.js` → `PROFILE_UUID`               |

### Testing services with fakes

`backend/scripts/fakes/` provides in-memory repos that match the repository
contract exactly:

- `fakes/cycleRepo.js` → `createFakeCycleRepository()` — plain objects,
  async-returning, `listSummaries` strips `weeks`, `save` returns the object.
- `fakes/profileRepo.js` → `createFakeUserProfileRepository({ defaultUuid })` —
  `applyLifetimeDelta` floors at 0 and stamps `updatedAt`.
- `fakes/fixtures.js` — `emptyCycle`, `addTask`, `cycleWithRequiredTasks`,
  `dayUuid`, `weekUuid`, `resetAll`.

```js
const { createFakeCycleRepository } = require('./fakes/cycleRepo');
const { createFakeUserProfileRepository } = require('./fakes/profileRepo');
const fixtures = require('./fakes/fixtures');
const { createTaskMutationService } = require('../services/taskMutationService');
const scoreService = require('../services/scoreService');

const cycleRepo = createFakeCycleRepository();
const profileRepo = createFakeUserProfileRepository();
const svc = createTaskMutationService({ cycleRepo, profileRepo, scoreService });

const cycle = fixtures.cycleWithRequiredTasks(4);
const saved = await cycleRepo.create(cycle);
const out = await svc.patchCycle(saved.uuid, {
  type: 'updateTasks',
  updates: [{ uuid: saved.weeks[0].days[0].tasks[0].uuid, completed: true }],
});
// out.pointsEarned === 15  (1/4 → 25% Silver required)
// out.currentTier === 'Silver'
// profileRepo._raw('default-user').lifetimeScore === 15
```

The pure helpers (`applyMove`, `applyUpdates`, …) are also exported from
`taskMutationService.js` so tests can drive them directly without going
through `patchCycle`.

### Layer-boundary invariants

These are enforced by `backend/scripts/test-*.js`:

- `routes/cycleRoutes.js` is < 40 lines, never imports models or `respond.js`.
- `controllers/` never imports models or shared/; uses `respond.js` for the
  envelope and maps `DomainError` to HTTP status codes.
- `server.js` never imports models directly; the only allowed path is
  `require('./repositories')` for `syncIndexes` boot housekeeping.

## Run

```bash
npm install
npm run dev          # nodemon server.js on PORT (default 4000)
npm start            # node server.js (production)
```

Requires a reachable MongoDB (`MONGODB_URI`, default
`mongodb://localhost:27017/pixelpaladin`). The bundled `mongo` container in
`docker-compose.yml` provides it for self-hosted deploys; locally you can
`brew services start mongodb-community` or use Atlas via `.env`.

## Env vars

| Var           | Default                              | Notes                                            |
|---------------|--------------------------------------|--------------------------------------------------|
| `PORT`        | `4000`                               | HTTP listen port                                 |
| `MONGODB_URI` | `mongodb://localhost:27017/pixelpaladin` | Atlas URI or bundled mongo                 |
| `DEBUG`       | unset                                | `1` / `true` enables `console.info` on boot + index sync |
| `CORS_ORIGIN` | unset                                | Comma-separated origins. **Unset = no CORS** (same-origin only) |

> `CORS_ORIGIN` is intentionally off by default — in the bundled Docker stack
> the Nuxt proxy makes the backend same-origin to the browser. Only set it if
> you bypass the proxy (e.g. a separate SPA host).

## API

Every endpoint is mounted under `/api/cycles` and uses the v2 envelope:

```json
{ "success": true,  "data": <payload>, "meta": { ... } }   // success (200/201)
{ "success": false, "error": { "code", "message", "details?" } }   // 4xx/5xx
```

Error codes: `VALIDATION_ERROR` (400), `NOT_FOUND` (404),
`CYCLE_FINISHED` (409), `INTERNAL` (500, message redacted).

| Method + path                    | Notes                                              |
|----------------------------------|---------------------------------------------------|
| `GET /`                          | Paginated summaries. `?limit=1..100` (default 50), `?offset≥0` (default 0). `meta: { total, limit, offset }`. Sorted `createdAt` desc. Excludes `weeks`. |
| `GET /current`                   | Auto-creates an empty cycle if none open. Returns full Cycle. |
| `GET /:id`                       | Full Cycle. 404 if missing. |
| `GET /profile`                   | `{ uuid, lifetimeScore }`. |
| `POST /`                         | `{ name?: string 1..80 }`. 201 + new Cycle. **Replaces** the old `POST /api/tasks` createMonth. |
| `PATCH /:id`                     | Discriminated union on `type` ∈ `{ addTasks, updateTasks, deleteTasks, moveTasks }`. Returns `{ cycle, pointsEarned, isLegendary, currentTier }`. 409 if finished. Strict body (extra keys → 400). |
| `POST /:id/finish`               | Idempotent. Returns `{ cycle, statistics, alreadyFinished }`. |

Plus `/readyz` for the compose healthcheck (returns 200 once mongoose is
connected; not under `/api/`).

The authoritative contract lives at
`development/remediation-w2/orchestration-ctx/decisions/api-contract-v2.md`
(treat that file, not this README, as the source of truth).

## Tests

Each script is a standalone `node` runner. No test framework dep.

```bash
node backend/scripts/test-envelope.js          # response envelope helpers + layer checks
node backend/scripts/test-validation.js        # zod schemas (strict, defaults)
node backend/scripts/test-pagination.js        # pagination + projection + layer checks
node backend/scripts/test-move-tasks.js        # applyMove relocation + progress + layer checks
node backend/scripts/test-score-order.js       # UB-06 tier crossing + UB-10 lifetime + layer checks
node backend/scripts/test-services-score.js    # scoreService (pure)
node backend/scripts/test-services-mutation.js # taskMutationService via fakes (incl. FIX-01)
node backend/scripts/test-services-lifecycle.js# cycleLifecycleService via fakes
node shared/test-shared.js                     # shared/ progress + scoring helpers
# shorthand (matches CI):
for f in backend/scripts/test-*.js shared/test*.js; do node "$f"; done
```

The same loop runs in CI (`.github/workflows/publish.yml` `test` job) on every
release tag. A follow-up `smoke` job (`needs: test`) then runs
`bash scripts/smoke/api-smoke.sh` — it builds mongo + backend + frontend
under the dedicated `pixelpaladin-smoke` project on port 3099, exercises the
v2 envelope end-to-end (including the FIX-01 gifUrl clear), and tears
everything down on exit. `build-and-push` is `needs: [test, smoke]`.

Local runs need no Mongo.

## Docker

`backend/Dockerfile` is a Node 22 alpine multi-stage build. The compose files
at the repo root (`docker-compose.yml`, `docker-compose.registry.yml`) mount it
on the internal Docker network only — the host never sees port 4000; the Nuxt
proxy on `APP_PORT` is the single published port. See [DOCKER.md](../DOCKER.md).

## Notes

- No auth. Single-user / family deployment.
- `console.log` calls are gated behind `DEBUG` (UB-39); `console.error` stays
  for real failures (Mongo connect, 500s via `utils/respond.js#internal`).
- Indexes are synced on boot (`Cycle.syncIndexes`, `UserProfile.syncIndexes`)
  so uuid uniqueness / sort indexes are always present.