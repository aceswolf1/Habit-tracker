#!/usr/bin/env bash
# scripts/preview/screenshot.sh — full-page PNGs at 375/768/1024/1440.
#
# Uses headless Google Chrome via the DevTools Protocol over a temporary
# websocket. The user-profile is --headless=new so this never touches
# existing Chrome windows. Widths match the w4-contract.md breakpoints:
#   phone  375
#   tablet 768  (≥ 640 and < 1024 → tablet view in the FE)
#   desktop 1024 (>= 1024 → current layout)
#   wide   1440 (extra-wide desktop sanity)
#
# Output filenames per contract: <width>.png inside the requested out-dir.
# Optional second arg overrides the URL (default http://localhost:3200).
#
# Usage: bash scripts/preview/screenshot.sh <out-dir> [url]

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"

OUT_DIR="${1:-}"
URL="${2:-http://localhost:3200}"
WIDTHS=(375 768 1024 1440)

if [[ -z "${OUT_DIR}" ]]; then
  echo "usage: $0 <out-dir> [url]" >&2
  exit 2
fi
mkdir -p "${OUT_DIR}"

CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
if [[ ! -x "${CHROME}" ]]; then
  echo "FATAL: cannot find headless Chrome at ${CHROME}" >&2
  exit 3
fi

# Pick an ephemeral debugging port.
DEBUG_PORT="$(( 9222 + (RANDOM % 200) ))"
USER_DATA="$(mktemp -d -t pixelpaladin-screenshot.XXXXXX)"
trap 'rm -rf "${USER_DATA}"' EXIT INT TERM

log() { echo "==> screenshot: $*"; }

log "chrome headless --remote-debugging-port=${DEBUG_PORT} --user-data-dir=${USER_DATA}"
"${CHROME}" \
  --headless=new \
  --disable-gpu \
  --no-sandbox \
  --hide-scrollbars \
  --remote-debugging-port="${DEBUG_PORT}" \
  --user-data-dir="${USER_DATA}" \
  about:blank \
  >/tmp/pixelpaladin-screenshot-chrome.log 2>&1 &
CHROME_PID=$!

# Wait for the CDP /json/version endpoint to come up.
ready=0
for _ in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
  if curl --silent --fail "http://127.0.0.1:${DEBUG_PORT}/json/version" >/dev/null; then
    ready=1; break
  fi
  sleep 0.5
done
if (( ready != 1 )); then
  echo "FATAL: chrome did not expose CDP on port ${DEBUG_PORT}" >&2
  kill "${CHROME_PID}" 2>/dev/null || true
  exit 4
fi

cleanup_chrome() {
  kill "${CHROME_PID}" 2>/dev/null || true
  # Children sometimes survive — reap.
  pkill -P "${CHROME_PID}" 2>/dev/null || true
}
trap 'cleanup_chrome; rm -rf "${USER_DATA}"' EXIT INT TERM

# One ws-target per width via a fresh tab. We grab the websocket URL from
# /json/new?about:blank, then send Page.captureScreenshot with captureBeyondViewport
# so the full document is captured (not just the viewport).
for W in "${WIDTHS[@]}"; do
  log "capture width=${W}"
  # Chrome's CDP /json/new endpoint requires PUT (GET only lists existing).
  TARGET_JSON="$(curl --silent --fail --request PUT \
    "http://127.0.0.1:${DEBUG_PORT}/json/new?about:blank")"
  WS_URL="$(echo "${TARGET_JSON}" | jq -r '.webSocketDebuggerUrl')"
  if [[ -z "${WS_URL}" || "${WS_URL}" == "null" ]]; then
    echo "FATAL: could not create CDP target for width=${W}" >&2
    echo "CDP response: ${TARGET_JSON}" >&2
    exit 5
  fi

  OUT_PNG="${OUT_DIR}/${W}.png"

  node "${SCRIPT_DIR}/cdp-screenshot.mjs" "${WS_URL}" "${URL}" "${W}" "${OUT_PNG}" || {
    echo "FATAL: screenshot for width=${W} failed" >&2
    cleanup_chrome
    exit 6
  }
done

cleanup_chrome
trap - EXIT INT TERM
rm -rf "${USER_DATA}"
log "done -> ${OUT_DIR}/<width>.png"