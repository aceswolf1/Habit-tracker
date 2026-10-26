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
(409), `ALREADY_CLAIMED` (409, v2.3 chest claim), `INTERNAL` (500).

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

## Backend layering (W3)

The backend is split into five layers with one-way dependencies:
`routes → controllers → services → repositories → models`.

| Layer              | Files                                                   | Responsibility                                                                                                         |
|--------------------|---------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------|
| `routes/`          | `cycleRoutes.js`                                        | Wiring only. Each line is `router.<verb>(path, controller.fn)`. < 40 lines; no loops, no model imports.                 |
| `controllers/`     | `cycleController.js`                                    | HTTP boundary. Parse via zod → call service → wrap with `respond.js` envelope. Maps `DomainError` → 404/409/400.        |
| `services/`        | `scoreService.js`, `taskMutationService.js`, `cycleLifecycleService.js`, `errors.js` | Business rules. No `req`/`res`, no mongoose. Repositories injected. Pure helpers (`applyMove`, `scoreCompletionFlips`) exported for direct testing. |
| `repositories/`    | `cycleRepository.js`, `userProfileRepository.js`, `index.js` | The only code that touches mongoose models. Narrow async interface (`findByUuid`, `save`, `listSummaries`, `applyLifetimeDelta`, …). |
| `models/`          | `Cycle.js`, `UserProfile.js`                            | Schemas + indexes. Unchanged.                                                                                            |

`backend/services/errors.js` defines `DomainError { code, message, details }`
with helpers `notFound(msg)` and `cycleFinished(msg)`. Controllers map these
to HTTP status codes; any other thrown error becomes 500 `INTERNAL`.

Where the rules live:
- **Tier thresholds / point tables** — `shared/scoring.js` (single source).
- **Progress math (week + optional bonus + cap)** — `shared/progress.js`.
- **Scoring orchestration** (apply flips → recalc → score → lifetime delta
  → save; UB-06 order; UB-10 floor; CYCLE_FINISHED guard) —
  `taskMutationService.patchCycle`.
- **Statistics on finish** — `utils/statisticsCalculator.calculateAllStatistics`,
  invoked from `cycleLifecycleService.finish`.
- **Profile uuid** — the single constant `PROFILE_UUID` lives in
  `backend/config.js` and is read from `process.env.USER_PROFILE_UUID`,
  defaulting to `'default-user'` for back-compat. Services import it;
  repositories accept it as a parameter (so tests can substitute). See
  "W4 ops (W4a) → `USER_PROFILE_UUID`" below for the compose + `.env`
  passthrough used by multi-tenant NAS deployments.

Testing services with fakes: `backend/scripts/fakes/` ships an in-memory
`createFakeCycleRepository()` and `createFakeUserProfileRepository()` that
match the repository contract exactly (plain objects, async-returning,
`listSummaries` strips `weeks`, `applyLifetimeDelta` floors at 0). The
service tests (`test-services-score.js`, `-mutation.js`, `-lifecycle.js`)
wire the fakes into the service factories and assert behavior end-to-end
without mongoose. See `backend/README.md` for the full test recipe.

Layer-boundary invariants are enforced by `backend/scripts/test-*.js`
(static greps + service-level integration via fakes):
- `routes/cycleRoutes.js` is < 40 lines and never imports models or
  `respond.js`.
- `controllers/` never imports models or shared/.
- `server.js` never imports models directly; the only allowed path is
  `require('./repositories')` for `syncIndexes` boot housekeeping.

## W4 ops (W4a)

Added by `w4-backend` during the W4 remediation wave. None of this is on the
critical path of `npm run dev` or the Docker build — it is preview tooling and
backend hardening only.

### Backend: `USER_PROFILE_UUID` (UB-58)

`backend/config.js` reads the profile uuid from `process.env.USER_PROFILE_UUID`
and falls back to the historical `'default-user'` constant. Pass it through in
both compose files so a multi-tenant NAS (multiple backends on one Mongo) can
run isolated profiles per family member:

```yaml
# docker-compose.yml  AND  docker-compose.registry.yml
backend:
  environment:
    USER_PROFILE_UUID: ${USER_PROFILE_UUID:-default-user}
```

`.env.example` ships a name-only entry:

```
# --- User profile UUID (UB-58) ---
# USER_PROFILE_UUID=default-user
```

Quick check (run from `backend/`):

```bash
node -e 'console.log(require("./config").PROFILE_UUID)'                 # default-user
USER_PROFILE_UUID=alice node -e 'console.log(require("./config").PROFILE_UUID)'  # alice
USER_PROFILE_UUID=''    node -e 'console.log(require("./config").PROFILE_UUID)'  # default-user
```

### Backend: JSON access logs + `X-Request-Id` (UB-59)

`server.js` adds a request-id + access-log middleware that:

- Reads `X-Request-Id` from the caller when it looks like an opaque token
  (8–128 chars, `[A-Za-z0-9_-]`); otherwise generates `crypto.randomUUID()`.
- Echoes the resolved id on `X-Request-Id` (the header comes back lower-cased
  via Node's http parser).
- Emits **one JSON line per response** on stdout:
  `{ts, level, reqId, method, path, status, ms}`.

The 500 handler (and `utils/respond.js#internal`) emit a JSON error line with
`reqId` from `res.req.reqId`. `console.error` is still called too, so the
old `backend/scripts/test-envelope.js` keeps passing.

The logger itself is `backend/utils/logger.js` — `info`, `debug` (gated by
`DEBUG=1`), `warn`, `error`. No new deps.

### Backend: graceful shutdown (UB-59)

`SIGTERM` and `SIGINT` trigger the same path: stop accepting new connections
(`server.close()`), then `mongoose.connection.close()`, then `process.exit(0)`.
Both close steps are raced against inner timers so a hung mongo or a slow
mongo close never blocks the exit:

- `server.close()` → 10 s hard timer (exit 1 if it hasn't fired)
- `mongoose.connection.close()` → 2 s inner timer (skip + exit 0)

Prove it (per the W4a acceptance criteria):

```bash
PORT=4101 MONGODB_URI="mongodb://localhost:9999/nope" node backend/server.js &
PID=$!
sleep 2
START=$(date +%s); kill -TERM $PID; wait $PID; echo "exit=$?  elapsed=$(($(date +%s)-START))s"
# expected: exit=0  elapsed=2s
```

### Preview harness (`scripts/preview/*`)

A self-contained, ISOLATED preview stack the FE workers hot-reload against
during W4a. Never disturbs the live or smoke stacks; uses dedicated ports
and a dedicated compose project.

| Path | Role |
|---|---|
| `scripts/preview/compose.preview.yml` | Mongo-only compose file: project `pixelpaladin-preview`, host port **27118**, volume `preview-mongo-data` |
| `scripts/preview/start.sh` | Idempotent bring-up. Runs `npx nuxi prepare` first, then brings up the container, starts backend on **4100**, `nuxt dev` on **3200** with `BACKEND_URL=http://localhost:4100`, seeds a demo month |
| `scripts/preview/stop.sh` | SIGTERM backend (UB-59 path) → SIGTERM nuxt → `compose down -v` |
| `scripts/preview/screenshot.sh <out-dir> [url]` | Headless Chrome via CDP; full-page PNGs at 375 / 768 / 1024 / 1440; optional URL arg (default `http://localhost:3200`) |
| `scripts/preview/seed-demo-month.sh` | Idempotent Demo Month: 3-5 tasks/day week 1, some completed, one legendary, one optional, one emoji icon |
| `scripts/preview/cdp-screenshot.mjs` | CDP helper: built-in WebSocket, no `ws` dep; clips captures to viewport width via `clip: {x:0, y:0, width:W, height:800}` so off-canvas drawer pixels don't bleed into PNGs |
| `scripts/preview/nuxt-internal-loader.mjs` | **PREVIEW-ONLY** Node 22 module-hook loader — see below |

Quick usage:

```bash
bash scripts/preview/start.sh            # bring up (idempotent)
bash scripts/preview/screenshot.sh dev/remediation-w4/screenshots/baseline   # capture at 4 widths
bash scripts/preview/stop.sh             # tear down + `compose down -v`
```

Safety: never touches ports **3001** / 3099 / 4000 / 27017; never joins the
live (`pixelpaladin`) or smoke (`pixelpaladin-smoke`) compose projects.

#### Why `nuxt-internal-loader.mjs` exists, and why it must never be needed by `npm run dev` or the Docker build

Nuxt 3.17.x's dev SSR bundle contains literal `import { baseURL } from
"#internal/nuxt/paths"` lines, but Nuxt never adds the matching `imports`
field to the project's `package.json` (only the `.output/` build does).
Without that mapping, every dev SSR request fails with `Package import
specifier "#internal/nuxt/paths" is not defined`.

The preview patches this with a tiny `register()`-based module hook that
rewrites `#internal/nuxt/paths` and `#internal/nitro` to absolute file URLs
in `frontend/node_modules/`. No new deps — uses only `node:module` and
`node:url`. It is loaded via:

```
NODE_OPTIONS="--import <repo>/scripts/preview/nuxt-internal-loader.mjs"
```

Only `scripts/preview/start.sh` sets that env var. **`npm run dev`** and
the Docker build never set it; they build into the default `.nuxt/` where
Vite's runtime hook resolves these specifiers directly.

If plain `cd frontend && BACKEND_URL=http://localhost:4100 npx nuxt dev --port 3108`
ever stops returning 200, the loader is leaking into mainstream usage —
file a bug and remove the loader.

#### `frontend/.nuxt` must not be deleted

The preview runs with `NUXT_BUILD_DIR=.nuxt-preview` so its SSR bundle lives
in `frontend/.nuxt-preview/`, but `frontend/tsconfig.json` extends
`./.nuxt/tsconfig.json` (a project-wide base config shared across builds).
`scripts/preview/start.sh` runs `npx nuxi prepare` against the DEFAULT
build dir before launching `nuxt dev` so that base tsconfig is always
present. **`frontend/.nuxt` is the project-wide base — never `rm -rf` it.**

### Typed application event bus (UB-54)

`frontend/composables/useAppEvents.ts` replaces the old
`window.dispatchEvent(new CustomEvent('appToast' | 'pointsEarned' | 'taskCompleted'))`
with a module-level handler map:

```ts
export type AppEvents = {
  toast:         { type: 'success' | 'error' | 'info' | 'warning'; title: string; message: string };
  pointsEarned:  { points: number; taskUuid?: string; tier?: string | null; isLegendary: boolean };
  taskCompleted: { taskUuid: string; taskType: 'optional' | 'required'; tier: string | null; isLegendary: boolean };
};
export function emitAppEvent<K extends keyof AppEvents>(name: K, payload: AppEvents[K]): void;
export function onAppEvent<K extends keyof AppEvents>(name: K, handler: (p: AppEvents[K]) => void): () => void;
```

Rules:

- Module-level — never touches `window`. SSR-safe (handlers only run on the
  client when dispatchers fire).
- Subscribe in `onMounted`, unsubscribe in `onBeforeUnmount`. The returned
  closure from `onAppEvent` is the unsubscribe fn.
- Dispatch sites: `frontend/stores/monthStore.ts` (all three) and
  `frontend/components/task/TaskModal.vue` (`toast`).
- Listener sites: `frontend/app.vue` (toast), `frontend/components/FloatingPoints.vue`.
- After W4a **no `new CustomEvent(...)` or `window.addEventListener('appToast' | … | 'taskCompleted')`
  remains in `frontend/`**. The old custom-event listeners were removed.

## V2 "Combat Deck" UI (v2.0)

Design source: `.claude/v2/DESIGN.md` (+ `code.html`, `screen.png`). Plan, contract and reports: `development/v2-redesign/` (contract: `orchestration-ctx/decisions/ui-contract-v2.md`).

### Design system
- **Tokens:** `frontend/assets/css/tokens.css` (`--pp-void`, `--pp-panel`, `--pp-card`, `--pp-card-active`, `--pp-line`, `--pp-text`, `--pp-muted`, `--pp-cyan`, `--pp-magenta`, `--pp-amber`, `--pp-green`, `--pp-done-bg`, `--pp-danger`, tier colors, plus `-rgb` triplets and static `--pp-glow-*` shadows), mapped to Tailwind `pp-*` colors. Radius is 0 everywhere (`rounded-full` only for dots/avatars).
- **Type:** `font-display` = Space Grotesk (headings, uppercase), `font-mono` = JetBrains Mono (body). Sizes `text-display` … `text-label-sm` from DESIGN.md. Self-hosted via `@fontsource/*` — never a font/icon/CSS CDN.
- **Primitives** (`frontend/components/ui/`, auto-imported as `<UiPp…>`): `PpIcon` (inline SVG; names/type in `ui/iconNames.ts` — `<script setup>` can't export), `PpButton` (`primary|critical|ghost|micro`), `PpPanel` (optional chamfer/glow), `PpBadge`, `PpSegmentedProgress`. `node frontend/scripts/check-icons.mjs` checks every icon has a path.

### Structure
| Path | Owns |
|---|---|
| `components/app/` | Shell: `AppShell` (sidebar + header + main), `AppSidebar` (Campaign/Stats, cycles list, New/Finish month, Settings; slide-in menu below lg), `AppHeader` (month title, tier + XP, inline tier icons, New Habit), `AppBackground` (static dot/scanline), `EditableMonthView`, `ModalsHost`, `StatsOrReadonly`, `StatsUnfinishedPanel`, `TierBadge` |
| `components/campaign/` | `CampaignView` (view bar: Spotlight / 7D Grid / Holo-Deck), `WeekTabs`, `DayStrip`, `DaySpotlight` + `TaskRow` + `TaskRowMenu` (phone ⋯ menu) + `TaskFilterBar`, `WeekGrid` + `TaskTile`, `CampaignCockpit` (boss, week XP bar, daily XP chart, upcoming days), `CloneDayPanel` |
| `components/task/` | `TaskMedia` (video/still/img/emoji, in-view playback), `TaskModalFields`, `TaskModalDayScope`, `TaskModalMoveTo`, `TaskModalVisualPicker` |
| `components/stats/`, `components/month/`, `components/boss/` | Statistics view, month summary, boss portrait parts |
| `composables/useCampaignStats.ts` | Pure helpers: `getTaskXp`, `getDayStats`, `getWeekDayXp`, `getReplicatedLabel` (`node frontend/scripts/check-campaign-stats.mjs`) |
| `composables/useMonthPageState.ts` | Page state factory + `providePageState`/`injectPageState`. **`app.vue` is the single owner** (it merges `useTaskModal()` openers in); children must `injectPageState()` — calling `useMonthPageState()` again creates a second, disconnected state (that bug made edit/add do nothing). |

Component files stay ≤ 400 lines.

### Layout by breakpoint (phone < 640, tablet 640–1023, desktop ≥ 1024)
| Area | Phone | Tablet | Desktop |
|---|---|---|---|
| Sidebar | slide-in menu (hamburger) | slide-in menu | fixed 256px |
| Campaign view | Day Spotlight only | Spotlight or 7D Grid (scroll-snap columns ≥ 220px) | Spotlight + cockpit (8/4) or 7D Grid (7 columns) |
| Task row | check · 64×36 thumb · 2-line title · ⋯ menu | 96×54 thumb, inline actions | ~66px rows; 7 rows fit at 1440×900 |
| Cockpit | under the list, boss as 16:9 banner | under the list | right column (hidden in Grid view) |
| Task dialog | full-screen sheet | centered | centered |

- **Default view** is Day Spotlight; the Grid choice is saved (`settingsStore.campaignView`, localStorage). **Holo-Deck** = `settingsStore.animateGifs`.
- **Clone day:** `monthStore.cloneDayTasks(sourceDayUuid, targetDayUuids)` copies a day's tasks (new uuids, not completed, no recurrence; skips identical tasks) in one `addTasks` PATCH. UI: Clone in the Spotlight header.
- **Task notes:** optional `notes` (≤ 280) on tasks; `updateTasks` accepts `null` to clear. Shown in the row and edited in the task dialog.
- **Days have no stored dates:** the strip shows `MON // W1`; TODAY is inferred by weekday.
- **Moving tasks on touch:** **Move to…** in the edit dialog; desktop also has drag-and-drop (reorder in Spotlight, between days in Grid).
- **404:** `app.vue` raises a fatal 404 for any path other than `/`; `error.vue` renders it.

### v2.1 additions (dates, task details, player)
Contract: `development/v2-features/orchestration-ctx/decisions/contract-v2.1.md`; roadmap (v2.1–v2.4): `development/v2-features/v2-features-roadmap.md`.
- **Shared helpers** (`shared/`, re-exported via `frontend/utils/shared*.ts`): `dates.js` (`isIsoDate`, `isMonday`, `mondayOf`, `dayDate`, `dayOfMonth`, `todayIso`, `findToday`), `habits.js` (`habitKey`, `normalizeDescription`, `newHabitId`), `levels.js` (`levelInfo` — level = floor(sqrt(xp/25))+1, titles RECRUIT…ARCHON), `bosses.js` (`bossForWeek`), `taskMeta.js` (`TAGS`, `TIMES_OF_DAY`, `isHHMM`). The dev plugin `pp-shared-cjs-dev` matches `shared/[a-z]+.js`.
- **Dates:** `Cycle.startDate` (`YYYY-MM-DD`, must be a Monday); day dates are derived, never stored. `POST /api/cycles {name?, startDate?}`; `PATCH {type:'updateCycle', name?, startDate?|null}`. Undated (old) months keep `MON // W1` and the weekday TODAY heuristic. UI: `components/app/NewMonthDialog.vue` (new month / set dates / clear dates).
- **Task fields:** server-maintained `completedAt` (set on check, cleared on un-check; never accepted from clients) and `habitId` (assigned on add; recurrence copies in one request share it; persisted on the next save for old tasks; habit key falls back to the normalized name). Optional `tag` (`common|rare|essential|defense`), `durationMin` (1–1440), `timeOfDay` (`morning|afternoon|evening|night`), `dueTime` (`HH:MM`; only editable on dated months) — `updateTasks` accepts `null` to clear. DUE IN / OVERDUE shows only on today's rows (`useCampaignStats.getDueTimeLine`).
- **Profile:** `GET /api/cycles/profile` → `{uuid, lifetimeScore, displayName?}`; `PATCH /api/cycles/profile {displayName|null}` (registered before `PATCH /:id`). Header shows `NAME · LVL n TITLE`; the store emits a `levelUp` app event on level crossings.
- **Settings persistence:** Pinia state comes from SSR, so `hydrateSettingsFromLocalStorage()` (called in `app.vue` on mount) reads `campaignView`, `animateGifs`, `useWeekVideos`, `soundFx` from localStorage.
- **Sound FX:** `composables/useSoundFx.ts` (WebAudio synth, no files, volume ≤ 0.2, lazy AudioContext on first gesture, default off).
- **Density rule:** 7 task rows must fit at 1440×900 — header, week tabs and strip changes must not add height on desktop.

### v2.2 additions (strike combos, insights, certificate, telemetry)
Contract: `development/v2-features/orchestration-ctx/decisions/contract-v2.2.md` (decisions E1–E7).
- **Strike combos** (`shared/combos.js`): completing the same habit (`habitKey`) again within 2 calendar days of its previous completion → combo +1 (same day = no increase; longer gap → 1). XP multiplier `1 + 0.25·(combo−1)`, cap ×2; legendary ×3 still applies. Names DOUBLE/TRIPLE/QUAD/PENTA STRIKE, then `×N STRIKE`. Forward-only: earlier completions are never rescored.
- **Task fields** (server-maintained on check, unset on un-check): `completedOn` (local date — the FE sends `clientDate` on every `updateTasks`), `combo`, `comboBonus`, `comboBase`. Un-check subtracts exactly `base + comboBonus`. PATCH responses carry `combo: {taskUuid, combo, name, bonus}`; the store emits the `strike` app event (FloatingPoints flash) and refreshes insights (1 s debounce).
- **Previous-completion lookup** is `cycleRepository.findRecentCompletionForHabit` (latest `completedOn` ≤ date, across all cycles). It has its own test against a stub model (`backend/scripts/test-repo-habit-lookup.js`) because the fake repo can't catch real-repo bugs; smoke asserts a 3-day TRIPLE STRIKE.
- **`GET /api/cycles/insights`** (read-only, computed from all cycles): `perfectDays` (all required done; no-task days skipped), `finishedMonths`, `habits` (top 20; completions count pre-v2.2 tasks too), `months`, `weekdayRates`, `combatLog` (last 7 days). Store: `insights` / `fetchInsights()`.
- **UI:** strike badge + `STRIKE READY ×N` on rows/tiles; cockpit split into `components/campaign/cockpit/*` with Combat log + perfect streak; `components/certificate/` (modal + canvas PNG, opens on the `monthFinished` event and from Stats → CERTIFICATE); Telemetry page (`components/telemetry/*`, sidebar section `telemetry`).

### v2.3 additions (chests, credits, achievements, Trophy Vault)
Contract: `development/v2-features/orchestration-ctx/decisions/contract-v2.3.md` (decisions F1–F5).
- **Credits** are a separate profile balance (never XP). **Chests:** one per level (levels 2…current, backfilled once; idempotent — a level drop keeps chests, re-crossing never duplicates). Rarity is rolled server-side on claim (`shared/rewards.js`: COMMON 10 / RARE 25 / EPIC 50 / LEGENDARY 100; odds by level).
- **Achievements:** 16 in `shared/achievements.js`, evaluated from history (insights stats + profile) and granting credits once (10/25/50).
- **Sync:** `rewardsService.syncRewards` (idempotent) runs after lifetime-changing PATCHes, after finish and on `GET /api/cycles/rewards`. PATCH/finish responses carry `rewards: {newChests, newAchievements}` when something new happened → `rewardsStore` emits `chestEarned` / `achievementUnlocked` (toasts in `composables/useAppToasts.ts`).
- **API:** `GET /api/cycles/rewards`; `POST /api/cycles/rewards/chests/:chestId/claim` (atomic conditional update; second claim → 409 `ALREADY_CLAIMED`, a new error code). Real-repository stub tests: `backend/scripts/test-repo-rewards.js`.
- **FE:** `stores/rewardsStore.ts` (kept out of `monthStore`, which is at its 400-line cap; `utils/rewardsBridge.ts` forwards PATCH rewards). Header chest button + unclaimed badge, credits, NEXT REWARD; `components/rewards/ChestModal.vue` (opened chests stay visible with their rarity until the modal closes); Trophy Vault section (`components/vault/*`). The `openCertificate {cycleUuid}` event opens any finished month's certificate without changing the active month; `openChests` opens the chest modal.

### Labels, day sort and reorder
- **Labels** (`shared/labels.js`, FE re-export `utils/sharedLabels.ts`): free-text task `labels` (≤ 5, each ≤ 24 chars), normalized server-side (trim, collapse spaces, UPPER-CASE, de-dupe) by the zod schema. Accepted on `addTasks`; `updateTasks` accepts `null` to clear. Separate from the fixed rarity `tag`. Colour = `labelColorIndex` → `.pp-label-hue-0…7` (`main.css`). Dialog field: `components/task/TaskLabelsField.vue` (autocomplete from `collectLabels(month)`); clone-day copies labels.
- **Sort / group** (`composables/useDayOrdering.ts`, `node frontend/scripts/check-day-ordering.mjs`): `settingsStore.daySort` (`manual|timeOfDay|dueTime|pending|label|name`) and `groupByLabel`, both in localStorage. Spotlight **View** button opens `DayViewBar` (filter + sort + group). Grouping = collapsible sections by first label, UNLABELED last. Display sorting never changes stored order.
- **Reorder** (only on "My order" with no filter): drag on desktop, ↑/↓ on tablet, Move up/down in the phone ⋯ menu. All call `moveTask(uuid, dayUuid, targetIndex)` → `moveTasks` PATCH; the day's `tasks` array order is "My order". `useMonthPageState.moveTask` accepts positional args or `{taskUuid, toDayUuid, targetIndex}` (Grid drag uses the object form).
- **Boss video:** `WeeklyBossPortrait` keys the `<video>` on its src — browsers don't reload a `<video>` when only `<source>` changes (the old "same boss every week" bug).

### Performance
Measured with `development/remediation-w5/measurements/bench.mjs` (V2 copy: `development/v2-redesign/tasks/W3-qa/bench-v2.mjs`). V2 vs v0.6.0: same 60 fps, far fewer running animations and media bytes; JS heap ~1 MB higher (accepted).
- **Task GIFs:** a picked GIF stores `gifUrl` (fallback), `gifVideoUrl` (MP4) and `gifStillUrl` (still). `TaskMedia` renders `<video preload="none" :poster>` and `useInViewPlayback` plays it only while ≥ 25% visible and the tab is visible, never under reduced motion. Older tasks fall back to a lazy `<img>`.
- No particle canvases, CRT effects or animated glows; glows are static shadows. Completion feedback is a ≤ 400 ms CSS pulse on the check button. `FloatingPoints` is the only animated overlay. All motion honors `prefers-reduced-motion`.
- Boss portraits are 600px WebP (`frontend/public/images/`; originals in `design/portraits/`, excluded from Docker builds); boss videos use in-view playback.
- The backend assigns a task `uuid` when `addTasks` omits one.

### Dev notes
- `vite.build.commonjsOptions` only applies to builds. `nuxt.config.ts` has a dev-only plugin (`pp-shared-cjs-dev`) that turns `shared/*.js` CJS into ESM for the browser in `nuxt dev`; without it the current month never loads in dev.
- Local dev uses Node 24 (`nvm`, default 24.22.1); images and CI are pinned to Node 22.23.4. `/usr/local/bin/node` is v18 on this machine and breaks the preview harness (`--import` in `NODE_OPTIONS`) — always use the nvm Node. npm 11 (local) and npm 10 (images) both read lockfile v3, but after changing dependencies confirm `npm ci` in the image (the smoke build does).
- Editing `nuxt.config.ts` restarts `nuxt dev`, which can crash the preview; rerun `scripts/preview/start.sh`. `start.sh` doesn't restart a running backend — kill it first after backend changes.
- `backend/server.js` listens on `HOST` (default `127.0.0.1`); `backend/Dockerfile` sets `HOST=0.0.0.0` so the frontend container can reach it (the port is never published).
- Test runners chain async checks and exit 1 on the first failure; `CHECK_CONTINUE=1` lists every failure instead.
- **Verify with data visible**, not just HTTP 200: a page can return 200 with no month loaded.

## Tests + CI

Tests are standalone `node` runners — no framework dependency:

```bash
node backend/scripts/test-envelope.js     # respond.js envelope helpers
node backend/scripts/test-validation.js   # zod schemas (strict, defaults)
node backend/scripts/test-pagination.js   # GET / pagination + projection + layer checks
node backend/scripts/test-move-tasks.js   # applyMove relocation + progress + layer checks
node backend/scripts/test-score-order.js  # UB-06 tier crossing + UB-10 lifetime + layer checks
node backend/scripts/test-services-score.js     # scoreService (pure)
node backend/scripts/test-services-mutation.js  # taskMutationService via fakes (incl. FIX-01)
node backend/scripts/test-services-lifecycle.js # cycleLifecycleService via fakes
node backend/scripts/test-logger.js       # JSON logger + request-id echo
node shared/test-shared.js                # shared/ progress + scoring helpers
# shorthand (matches CI):
for f in backend/scripts/test-*.js shared/test*.js; do node "$f"; done
```

`.github/workflows/publish.yml` runs the same glob on every release tag in its
`test` job. The `smoke` job (`needs: test`) then runs `bash scripts/smoke/
api-smoke.sh` — it builds mongo + backend + frontend under the dedicated
`pixelpaladin-smoke` project on port 3099, exercises the v2 envelope
end-to-end (including the FIX-01 gifUrl clear), and tears everything down on
exit. `build-and-push` is `needs: [test, smoke]`. Adding any future
`backend/scripts/test-foo.js` or `shared/test-bar.js` is picked up
automatically by the glob.

## Service-layer testing with fakes

`backend/scripts/fakes/` ships:

- `cycleRepo.js` — `createFakeCycleRepository()` matching the
  `cycleRepository` contract signatures (`findByUuid`, `findCurrentUnfinished`,
  `listSummaries`, `create`, `save`). Plain objects, async-returning,
  `listSummaries` strips `weeks`, `save` returns the object.
- `profileRepo.js` — `createFakeUserProfileRepository({ defaultUuid })`.
  `applyLifetimeDelta` floors at 0 and stamps `updatedAt`.
- `fixtures.js` — `emptyCycle` (delegates to `shared/progress.createEmptyMonth`),
  `addTask`, `cycleWithRequiredTasks`, `dayUuid`, `weekUuid`, `resetAll`.

Service tests wire fakes into the factory and assert end-to-end:

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
assert.strictEqual(out.pointsEarned, 15); // 1/4 → 25% Silver
```

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
- **Node version is pinned** (`node:22.23.4-alpine` in both Dockerfiles, `node-version: "22.23.4"` in `publish.yml`). On a Node security release, bump all three together, run `npm audit --omit=dev` in `frontend/` and `backend/`, and confirm `npm ci` still works from the lock files (the smoke build fails if a lock file is out of sync). Remaining frontend advisories need the Nuxt 4 major upgrade.
- Backend `console.log` is gated behind `DEBUG` (UB-39); `console.error` stays
  for real failures.
- CORS is **off by default** (`CORS_ORIGIN` unset → no middleware). Only set
  it if you bypass the Nitro proxy.
- Fonts are self-hosted (`@fontsource/*`, UB-34); no Google Fonts CDN. The
  smoke script greps the SSR HTML for `googleapis` and fails if found.
- Debug + Vue devtools are **dev-only** (UB-35).
- Once a cycle is `finished: true`, every mutation PATCH returns 409
  `CYCLE_FINISHED`.