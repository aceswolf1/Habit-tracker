#!/usr/bin/env bash
# scripts/preview/start.sh — W4 preview harness
#
# Brings up an ISOLATED preview stack the frontend workers can hot-reload
# against while they make UI changes. Idempotent: re-running against an
# already-running stack just re-checks health and re-seeds if needed.
#
# Topology (per w4-contract.md §Preview harness):
#   - Mongo via `docker compose -p pixelpaladin-preview` (own volume, host
#     port 27118) using scripts/preview/compose.preview.yml.
#   - Backend on host port 4100 (NOT 4000 — that's the live stack).
#   - Nuxt dev on host port 3200 (NOT 3001 — that's the live stack).
#   - Nuxt proxy pointed at the local backend at http://localhost:4100.
#
# What it does:
#   1. Compose-up the preview mongo container, wait for healthy.
#   2. Start `node backend/server.js` with PORT=4100 + MONGODB_URI pointed at
#      preview mongo (lockbox `pixelpaladin-preview`). Logs to
#      /tmp/pixelpaladin-preview/backend.log.
#   3. Wait for backend /readyz (mongoose connected) to return 200.
#   4. Start `npx nuxt dev` in frontend/ on port 3200 with BACKEND_URL set so
#      the Nitro proxy at /api/cycles forwards to our local backend (not to
#      `http://backend:4000` which is unreachable from the host).
#   5. Wait for Nuxt dev to serve HTTP 200 on /.
#   6. Seed one demo month with ~3-5 tasks per day for week 1, a few
#      completed, one legendary, one optional, one with an emoji icon. Idempotent:
#      if a "Demo Month" is already current, leave it alone.
#
# Safety: refuses to run if any of the protected ports (3001/3099/4000/27017)
# is in use by SOMETHING ELSE — but the live stack itself owns 3001+4000, so
# the script targets 4100/3200/27118 only. Never touches the live or smoke
# compose projects.
#
# Usage: bash scripts/preview/start.sh [--rebuild] [--no-seed]
#   --rebuild    docker compose build --no-cache (rare; mongo rarely needs it)
#   --no-seed    skip the demo-month seed (useful if you only want hot-reload)

set -euo pipefail

# ---- Configuration ----------------------------------------------------------
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/../.." >/dev/null 2>&1 && pwd)"

PROJECT="pixelpaladin-preview"
COMPOSE_FILE="${SCRIPT_DIR}/compose.preview.yml"

BACKEND_PORT="${BACKEND_PORT:-4100}"
FRONTEND_PORT="${FRONTEND_PORT:-3200}"
MONGO_HOST_PORT="27118"
MONGO_LOCKBOX="pixelpaladin-preview"
MONGODB_URI="mongodb://localhost:${MONGO_HOST_PORT}/${MONGO_LOCKBOX}"
BASE_URL="http://localhost:${FRONTEND_PORT}"
HEALTH_URL="${BASE_URL}/api/health"
BACKEND_READYZ="http://localhost:${BACKEND_PORT}/readyz"

LOG_DIR="/tmp/pixelpaladin-preview"
BACKEND_LOG="${LOG_DIR}/backend.log"
FRONTEND_LOG="${LOG_DIR}/frontend.log"
MONGO_LOG="${LOG_DIR}/mongo.log"
BACKEND_PID_FILE="${LOG_DIR}/backend.pid"
FRONTEND_PID_FILE="${LOG_DIR}/frontend.pid"

DO_REBUILD=0
DO_SEED=1
for arg in "$@"; do
  case "$arg" in
    --rebuild) DO_REBUILD=1 ;;
    --no-seed) DO_SEED=0 ;;
    -h|--help)
      sed -n '2,30p' "$0"; exit 0 ;;
    *) echo "FATAL: unknown arg $arg" >&2; exit 2 ;;
  esac
done

mkdir -p "${LOG_DIR}"

# ---- Helpers ----------------------------------------------------------------
log() { echo "==> preview: $*"; }

# pid_alive <pid-file> — echoes PID if running, "" otherwise.
pid_alive() {
  local pf="$1" pid
  [[ -f "$pf" ]] || { echo ""; return; }
  pid="$(cat "$pf" 2>/dev/null || true)"
  if [[ -n "${pid}" ]] && kill -0 "${pid}" 2>/dev/null; then
    echo "${pid}"
  else
    rm -f "$pf"
    echo ""
  fi
}

# wait_http <url> <timeout-sec> <label>
wait_http() {
  local url="$1" timeout="$2" label="$3" i=0
  while (( i < timeout )); do
    if curl --silent --show-error --fail --output /dev/null "${url}"; then
      log "${label} = OK (${url})"
      return 0
    fi
    sleep 1
    i=$(( i + 1 ))
  done
  echo "FATAL: ${label} never came up at ${url} within ${timeout}s" >&2
  return 1
}

DC=(docker compose -p "${PROJECT}" -f "${COMPOSE_FILE}")

# ---- 1. Mongo ----------------------------------------------------------------
log "compose project=${PROJECT}  host port=${MONGO_HOST_PORT}  lockbox=${MONGO_LOCKBOX}"
if (( DO_REBUILD == 1 )); then
  log "(--rebuild) docker compose build --no-cache mongo"
  "${DC[@]}" build --no-cache mongo
fi
"${DC[@]}" up -d mongo
log "waiting for mongo healthcheck..."
"${DC[@]}" ps mongo >/dev/null  # render
deadline=$(( $(date +%s) + 60 ))
while :; do
  if "${DC[@]}" ps --format json mongo 2>/dev/null \
      | grep -q '"Health":"healthy"'; then
    log "mongo = healthy"
    break
  fi
  if (( $(date +%s) >= deadline )); then
    echo "FATAL: mongo never became healthy" >&2
    "${DC[@]}" logs --tail=40 mongo >&2 || true
    exit 3
  fi
  sleep 1
done

# ---- 2. Backend --------------------------------------------------------------
if [[ -n "$(pid_alive "${BACKEND_PID_FILE}")" ]]; then
  log "backend already running (pid=$(cat "${BACKEND_PID_FILE}")) — leaving it"
else
  log "starting backend on :${BACKEND_PORT} -> ${MONGODB_URI}"
  : > "${BACKEND_LOG}"
  (
    cd "${REPO_ROOT}"
    PORT="${BACKEND_PORT}" \
    MONGODB_URI="${MONGODB_URI}" \
    DEBUG=1 \
      nohup node backend/server.js >>"${BACKEND_LOG}" 2>&1 &
    echo $! > "${BACKEND_PID_FILE}"
  )
  log "backend pid=$(cat "${BACKEND_PID_FILE}"), log=${BACKEND_LOG}"
fi

log "waiting for backend ${BACKEND_READYZ} ..."
wait_http "${BACKEND_READYZ}" 30 "backend /readyz"

# ---- 3. Nuxt dev -------------------------------------------------------------
if [[ -n "$(pid_alive "${FRONTEND_PID_FILE}")" ]]; then
  log "frontend already running (pid=$(cat "${FRONTEND_PID_FILE}")) — leaving it"
else
  log "starting nuxt dev on :${FRONTEND_PORT} with BACKEND_URL=http://localhost:${BACKEND_PORT}"
  # W4 (A-T5): the preview runs with NUXT_BUILD_DIR=.nuxt-preview, but
  # frontend/tsconfig.json extends ./.nuxt/tsconfig.json. Without that
  # base config in place, esbuild can't parse any .ts file in the
  # project (TSConfckParseError). Run `nuxi prepare` against the DEFAULT
  # build dir first so .nuxt/tsconfig.json exists; then nuxt dev writes
  # its real artifacts into .nuxt-preview/.
  log "running nuxi prepare (default build dir) to seed .nuxt/tsconfig.json"
  (
    cd "${REPO_ROOT}/frontend"
    npx nuxi prepare >>"${FRONTEND_LOG}" 2>&1
  )
  : > "${FRONTEND_LOG}"
  (
    cd "${REPO_ROOT}/frontend"
    NITRO_HOST=127.0.0.1 \
    NITRO_PORT="${FRONTEND_PORT}" \
    BACKEND_URL="http://localhost:${BACKEND_PORT}" \
    KLIPY_API_KEY="" \
    KLIPY_BASE_URL="https://api.klipy.com" \
    NUXT_BUILD_DIR=".nuxt-preview" \
    NODE_OPTIONS="--import ${SCRIPT_DIR}/nuxt-internal-loader.mjs" \
      nohup npx nuxt dev --port "${FRONTEND_PORT}" --host 127.0.0.1 \
        >>"${FRONTEND_LOG}" 2>&1 &
    echo $! > "${FRONTEND_PID_FILE}"
  )
  log "frontend pid=$(cat "${FRONTEND_PID_FILE}"), log=${FRONTEND_LOG}"
fi

log "waiting for frontend ${HEALTH_URL} ..."
wait_http "${HEALTH_URL}" 90 "frontend /api/health"

# ---- 4. Seed demo month ------------------------------------------------------
if (( DO_SEED == 1 )); then
  log "seeding demo month (idempotent)..."
  bash "${SCRIPT_DIR}/seed-demo-month.sh" "${BASE_URL}" || {
    echo "FATAL: seed failed" >&2
    exit 4
  }
fi

cat <<EOF

==> preview: READY
    frontend:    ${BASE_URL}
    backend:     http://localhost:${BACKEND_PORT}
    mongo:       mongodb://localhost:${MONGO_HOST_PORT}/${MONGO_LOCKBOX}  (-p ${PROJECT})
    logs:        ${LOG_DIR}/*.log
    screenshot:  bash scripts/preview/screenshot.sh <out-dir>

EOF