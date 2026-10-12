# PixelPaladin Frontend

Nuxt 3 + Nitro app. Talks to the Express backend only via `/api/cycles` —
forwarded by `server/middleware/backend-proxy.ts` so the browser stays
same-origin (no CORS, no leaked backend IP).

## Layout

```
frontend/
├── app.vue                        # root page (month/week/day grid + gamification)
├── components/                    # Day.vue, Task.vue, TaskModal.vue, …
├── stores/                        # Pinia: monthStore.ts, settingsStore.ts
├── services/cycleApi.ts           # ONLY module that fetches /api/cycles*
├── types/index.ts                 # Cycle / Week / Day / Task / envelope types
├── utils/sharedProgress.ts        # thin re-export of shared/progress.js
├── utils/sharedScoring.ts         # thin re-export of shared/scoring.js
├── server/
│   ├── middleware/backend-proxy.ts   # /api/cycles → Express, others fall through
│   └── api/                           # /api/klipy/*, /api/health (Nitro-owned)
├── assets/, css/                  # pixel-art styling, Tailwind, SCSS animations
├── context/                       # Nuxt context modules
├── public/                        # static assets
└── nuxt.config.ts                 # #shared alias, font wiring, devtools gate
shared/                            # ../shared — single source of truth
```

## Run

```bash
npm install
npm run dev        # Nuxt dev server on http://localhost:3001
npm run build      # production build → .output/
npm run preview    # serve .output/ for a quick local smoke
```

The dev server expects the Express backend on `http://localhost:4000`
(`BACKEND_URL`). The bundled `docker-compose.yml` provides both; for plain
local dev, start the backend in another terminal (`cd ../backend && npm run dev`).

## API surface used by the frontend

Only `services/cycleApi.ts` calls `fetch('/api/cycles…')`. It unwraps the v2
envelope and throws a typed `ApiError { status, code, message }` on
`success: false`. During rollout it also accepts a legacy un-enveloped body
(tolerance for image skew).

The proxy middleware (`server/middleware/backend-proxy.ts`) exports a single
named constant `PROXIED_API_PREFIXES = ["/api/cycles"]`. Anything else under
`/api/*` is owned by Nitro (`server/api/klipy/**` and `server/api/health.get.ts`).
Widening the allowlist is a security-relevant change — keep it tight.

## Responsive layout

Phone `< 640px`, tablet `640–1023px`, desktop `≥ 1024px`. Phones show one day at a time with a day picker; tablets show a scroll-snap strip of days; desktop keeps the 7-column grid. Tap targets are ≥ 40px below desktop, the task dialog is a full-screen sheet on phones and has a **Move to…** picker on every device. Colors come from `assets/css/tokens.css` (`--pp-*`), animations honor `prefers-reduced-motion`, and unknown URLs render `error.vue` with status 404. See `CLAUDE.md` → "Responsive layout, theme tokens, motion (W4b)" for the full table.

## Fonts

Self-hosted via `@fontsource/press-start-2p` and `@fontsource/orbitron`
(UB-34). **No Google Fonts CDN** — verified by
`scripts/smoke/api-smoke.sh` (it greps the SSR HTML for `googleapis` and fails
the run if any reference is found). The CSS imports are wired in
`nuxt.config.ts` under `css: [...]`.

## Build

`npm run build` produces a Nitro `node-server` preset in `.output/`. The
`Dockerfile` in this folder copies `.output/` into the runtime stage, so the
final image is just Node 22 alpine + the built bundle (no Nuxt dev tooling).

## Tests

The frontend has no JS test framework. Pure helpers live in `shared/` and are
covered by `node shared/test-shared.js`. The Nuxt proxy allowlist is a typed
constant; the build itself (`npm run build`) is the closest thing to a FE
test — `npm run build` exits non-zero if the project doesn't compile.

## Debug / devtools

Both Vue devtools and `nuxt.debug` are **dev-only** (UB-35) — gated in
`nuxt.config.ts` on `process.env.NODE_ENV === 'development'`. They never
appear in the production bundle.

## Docker

`frontend/Dockerfile` is multi-stage (Node 22 alpine build → Node 22 alpine
runtime). The single published port (`APP_PORT`, default `3001`) is the only
host port — see [DOCKER.md](../DOCKER.md) for the self-host flow.