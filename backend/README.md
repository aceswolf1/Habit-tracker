# PixelPaladin Backend

Express + Mongoose API. Mounted at `/api/cycles` inside `server.js`. Owns the
v2 envelope and zod-validated PATCH bodies.

## Layout

```
backend/
├── server.js                # Express app, Mongo connect, mount /api/cycles
├── models/                  # Cycle.js, UserProfile.js (Mongoose schemas)
├── routes/cycleRoutes.js    # All /api/cycles/* handlers
├── validation/cycleSchemas.js  # zod v4 schemas; strict (extra keys → 400)
├── utils/                   # respond.js (envelope), scoreCalculator, statistics
└── scripts/test-*.js        # node-harness tests (no test framework dep)
shared/                      # progress.js, scoring.js — single source of truth
```

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
node backend/scripts/test-envelope.js     # response envelope helpers
node backend/scripts/test-validation.js   # zod schemas (strict, defaults)
node backend/scripts/test-pagination.js   # GET / pagination + projection
node backend/scripts/test-move-tasks.js   # moveTasks relocation + progress
node backend/scripts/test-score-order.js   # lifetime scoring math
node backend/scripts/test-shared.js       # shared/ progress + scoring helpers
# shorthand:
for f in backend/scripts/test-*.js shared/test*.js; do node "$f"; done
```

The same loop runs in CI (`.github/workflows/publish.yml` `test` job) on every
release tag. Local runs need no Mongo.

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