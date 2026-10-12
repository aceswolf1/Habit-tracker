#!/usr/bin/env bash
# scripts/preview/stop.sh — shut down the preview stack cleanly.
#
# Stops (in reverse order):
#   1. Nuxt dev (the only thing using pid_file tracking; we kill its pid then
#      any children that escaped `nohup`).
#   2. Backend node process (port 4100 by default). SIGTERM triggers the
#      UB-59 graceful-shutdown path; falls back to SIGKILL after 10 s.
#   3. Docker compose down -v the preview mongo container + named volume.
#
# Logs in /tmp/pixelpaladin-preview/ are NOT deleted (they belong to the
# user for debugging); run `rm -rf /tmp/pixelpaladin-preview` manually.
#
# Usage: bash scripts/preview/stop.sh

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
PROJECT="pixelpaladin-preview"
COMPOSE_FILE="${SCRIPT_DIR}/compose.preview.yml"

LOG_DIR="/tmp/pixelpaladin-preview"
FRONTEND_PID_FILE="${LOG_DIR}/frontend.pid"
BACKEND_PID_FILE="${LOG_DIR}/backend.pid"

DC=(docker compose -p "${PROJECT}" -f "${COMPOSE_FILE}")

log() { echo "==> preview stop: $*"; }

# ---- 1. Nuxt ----------------------------------------------------------------
pid="$(cat "${FRONTEND_PID_FILE}" 2>/dev/null || true)"
if [[ -n "${pid}" ]] && kill -0 "${pid}" 2>/dev/null; then
  log "stopping nuxt dev (pid=${pid}) + children"
  # Kill the process group (nohup leaves children in same group on macOS).
  pkill -TERM -P "${pid}" 2>/dev/null || true
  kill -TERM "${pid}" 2>/dev/null || true
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    kill -0 "${pid}" 2>/dev/null || break
    sleep 1
  done
  if kill -0 "${pid}" 2>/dev/null; then
    log "nuxt still alive after 10s — SIGKILL"
    pkill -KILL -P "${pid}" 2>/dev/null || true
    kill -KILL "${pid}" 2>/dev/null || true
  fi
fi
# Any stray nuxt processes listening on 3200 too.
pkill -TERM -f "nuxt dev --port 3200" 2>/dev/null || true
rm -f "${FRONTEND_PID_FILE}"

# ---- 2. Backend ------------------------------------------------------------
pid="$(cat "${BACKEND_PID_FILE}" 2>/dev/null || true)"
if [[ -n "${pid}" ]] && kill -0 "${pid}" 2>/dev/null; then
  log "stopping backend (pid=${pid}) with SIGTERM (UB-59 graceful)"
  kill -TERM "${pid}" 2>/dev/null || true
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    kill -0 "${pid}" 2>/dev/null || break
    sleep 1
  done
  if kill -0 "${pid}" 2>/dev/null; then
    log "backend still alive after 10s — SIGKILL"
    kill -KILL "${pid}" 2>/dev/null || true
  fi
fi
rm -f "${BACKEND_PID_FILE}"

# ---- 3. Mongo --------------------------------------------------------------
log "compose down -v (project=${PROJECT})"
"${DC[@]}" down -v --remove-orphans 2>&1 || true

log "done"