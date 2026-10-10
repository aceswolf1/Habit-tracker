# CLAUDE.md

Guidance for Claude Code (claude.ai/code) when working on PixelPaladin.

## Project overview

**PixelPaladin** is a self-hosted gamified habit tracker with 8-bit pixel
graphics and RPG-lite progression (Bronze → Silver → Gold → Champion → Final
tiers, plus a legendary task multiplier). Nuxt 3 frontend, Express + Mongoose
backend, MongoDB for persistence. Single-user or small-family deployment on a
NAS (TrueNAS, Docker host, etc.).

## Layout

```
.
├── frontend/        # Nuxt 3 app (UI + Nitro server + proxy middleware)
├── backend/         # Express + Mongoose API
├── shared/          # progress.js, scoring.js — single source of truth
├── scripts/         # build-and-push.sh, smoke/api-smoke.sh
├── deploy/          # automation docs (GitHub Actions → GHCR → Watchtower)
├── docker-compose.yml          # build + run (local / build-on-NAS)
├── docker-compose.registry.yml # deploy-only (pulls prebuilt images)
├── DOCKER.md                   # self-host guide
└── CLAUDE.md                   # this file
```

## API (v2 — authoritative)

All endpoints live under `/api/cycles` and use the v2 envelope:

```json
{ "success": true,  "data": <payload>, "meta": { ... } }
{ "success": false, "error": { "code", "message", "details?" } }
```

Error codes: `VALIDATION_ERROR` (400), `NOT_FOUND` (404), `CYCLE_FINISHED`
(409), `INTERNAL` (500).

| Method + path           | Notes                                       |
|-------------------------|---------------------------------------------|
| `GET /api/cycles`       | Paginated summaries. `?limit=1..100` (default 50), `?offset≥0` (default 0). Sort `createdAt` desc. Excludes `weeks`. |
| `GET /api/cycles/current` | Auto-creates an empty cycle if none open. |
| `GET /api/cycles/:id`   | Full Cycle. 404 if missing. |
| `GET /api/cycles/profile` | `{ uuid, lifetimeScore }`. |
| `POST /api/cycles`      | Body `{ name?: string 1..80 }`. 201 + Cycle. Replaces old `POST /api/tasks`. |
| `PATCH /api/cycles/:id` | Discriminated `type` ∈ `{ addTasks, updateTasks, deleteTasks, moveTasks }`. Strict body (extra keys → 400). Returns `{ cycle, pointsEarned, isLegendary, currentTier }`. 409 if finished. |
| `POST /api/cycles/:id/finish` | Idempotent. Returns `{ cycle, statistics, alreadyFinished }`. |

Plus `/readyz` on the backend (200 once mongoose connected; not under `/api/`).
The full contract is at
`development/remediation-w2/orchestration-ctx/decisions/api-contract-v2.md`
— treat that document as the source of truth.

## Frontend ↔ backend wiring

- **One client module**: `frontend/services/cycleApi.ts` is the only file that
  calls `fetch('/api/cycles…')`. It unwraps the envelope and throws a typed
  `ApiError { status, code, message }` on `success:false`. Legacy un-enveloped
  bodies are tolerated for image-skew safety.
- **One proxy middleware**: `frontend/server/middleware/backend-proxy.ts`
  exports `PROXIED_API_PREFIXES = ["/api/cycles"]`. That constant is the
  single source of truth for what gets forwarded to Express vs owned by
  Nitro (`/api/klipy/*`, `/api/health`). Widening it is a security-relevant
  change.
- **One state owner**: `frontend/stores/monthStore.ts` (Pinia). It uses
  `cycleApi.ts` for transport and `utils/sharedProgress.ts` (re-export of
  `shared/progress.js`) for progress math so the FE and BE never diverge.

## Shared modules

`shared/progress.js` and `shared/scoring.js` are loaded by:
- backend (CJS `require`)
- frontend (`#shared` alias in `nuxt.config.ts`, re-exported via
  `frontend/utils/sharedProgress.ts` / `sharedScoring.ts`)

`calculateProgress(cycle)` mutates the cycle in place; `calculateDayProgress(day)`
returns 0–100 (required only; empty → 0). Tier / point tables are in
`shared/scoring.js`.

## Tests + CI

Tests are standalone `node` runners — no framework dependency:

```bash
node backend/scripts/test-envelope.js
node backend/scripts/test-validation.js
node backend/scripts/test-pagination.js
node backend/scripts/test-move-tasks.js
node backend/scripts/test-score-order.js
node shared/test-shared.js
# shorthand (matches CI):
for f in backend/scripts/test-*.js shared/test*.js; do node "$f"; done
```

`.github/workflows/publish.yml` runs the same glob on every release tag in its
`test` job; `build-and-push` is `needs: test`. Adding any future
`backend/scripts/test-foo.js` or `shared/test-bar.js` is picked up automatically.

## Docker / NAS

Two compose files at the repo root:
- `docker-compose.yml` — builds from source (local dev or NAS with SSH).
- `docker-compose.registry.yml` — pulls prebuilt images (TrueNAS Apps UI,
  Portainer).

Both set `mem_limit` on mongo (512m), backend (256m), frontend (384m). Only
the frontend port is published (`APP_PORT`, default `3001`). The backend
and mongo live on the internal Docker network; the Nitro proxy at
`/api/cycles` is the only thing the browser talks to.

Smoke harness: `scripts/smoke/api-smoke.sh` builds `local/pixelpaladin-*:smoke`,
starts the stack on port 3099 under project name `pixelpaladin-smoke`,
exercises the v2 envelope end-to-end, and tears it down with `down -v` + image
cleanup on exit. Never touches the live stack.

Full self-host guide (build / push / Watchtower / TrueNAS gotchas) is in
[DOCKER.md](./DOCKER.md). Automation details (GitHub Actions → GHCR →
Watchtower) are in [deploy/AUTOMATION.md](./deploy/AUTOMATION.md).

## Working notes

- The Nuxt `#shared` alias (`nuxt.config.ts`) is the only place that knows
  where `shared/` lives. Because `shared/*.js` is CJS (`module.exports = {...}`)
  but every FE bundle is ESM, B-FE-5 applies the CJS→ESM transform in BOTH
  pipelines:
  - **Vite (client + dev)**: `vite.build.commonjsOptions` with
    `defaultIsModuleExports: 'always'`, `transformMixedEsModules: true`,
    and an `include` regex that matches both `/shared/` paths and the
    `#shared/...` alias form.
  - **Nitro (SSR)**: `nitro.rollupConfig.plugins` with the same
    `@rollup/plugin-commonjs` plugin, configured identically. The plugin
    is imported directly in `nuxt.config.ts` and declared as a devDep
    (`@rollup/plugin-commonjs ^28.0.9`) in `frontend/package.json` —
    don't remove it, even though it's technically transitive via Vite,
    because Nitro's rollup pipeline doesn't get Vite's plugin chain.

  `frontend/utils/sharedProgress.ts` uses a namespace import plus a
  `pick()` helper that falls back to `.default[key]` — this works whether
  the transform synthesises named exports, only the ESM `default`, or both,
  across client / dev / SSR builds.
- Backend `console.log` is gated behind `DEBUG` (UB-39); `console.error` stays
  for real failures.
- CORS is **off by default** (`CORS_ORIGIN` unset → no middleware). Only set
  it if you bypass the Nitro proxy.
- Fonts are self-hosted (`@fontsource/*`, UB-34); no Google Fonts CDN. The
  smoke script greps the SSR HTML for `googleapis` and fails if found.
- Debug + Vue devtools are **dev-only** (UB-35).
- Once a cycle is `finished: true`, every mutation PATCH returns 409
  `CYCLE_FINISHED`.