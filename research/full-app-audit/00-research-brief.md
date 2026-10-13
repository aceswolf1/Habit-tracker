# Research Brief — full-app-audit (W1 arch)

## Scope
Graded architecture audit of live PixelPaladin (Nuxt 3 + Express/Mongoose/Mongo on NAS Docker) for:
1. Scalability (NAS/single-node context)
2. Maintainability
3. Decoupling (FE↔BE)
4. Legacy TypeORM/Postgres cleanup actions

## Live stack (authoritative)
- FE: `frontend/` (Nuxt 3.17, Pinia, Nitro)
- BE: `backend/server.js` + `backend/routes/*.js` + `backend/models/*.js` (mongoose 8)
- DB: `mongo:7` via `docker-compose.yml`
- Proxy: `frontend/server/middleware/backend-proxy.ts` → `BACKEND_URL`

## Legacy (cleanup only — do not grade as live)
- `backend/src/**`, `backend/ormconfig.ts`, `backend/ormconfig.js`, TypeORM entities
- Stale Nitro JSON API: `frontend/server/api/tasks.ts` → `data/monthData.json`
- Stale docs: `backend/README.md`, CLAUDE.md nested-frontend note

## Method
Code/compose static analysis with path:line evidence. No load test against NAS. No secrets from `.env`.

## Rubric
S > A > B > C > D (S best). NAS single-user/household scale, not hyperscale.
