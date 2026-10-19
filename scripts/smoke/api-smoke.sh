#!/usr/bin/env bash
# A-OP-4 / B-QA-2 — smoke harness for the PixelPaladin stack.
#
# Builds + starts mongo + backend + frontend under a SEPARATE docker compose
# project (`pixelpaladin-smoke`) so it cannot touch the user's live stack or
# its `mongo-data` volume. Builds images tagged `local/pixelpaladin-*:smoke`,
# never `:latest`, so the live stack keeps running on `:latest` even while
# this script runs.
#
# What it does, in order:
#   1. Compose up (build) under -p pixelpaladin-smoke, with IMAGE_PREFIX=local
#       IMAGE_TAG=smoke APP_PORT=3099 and the smoke override (port 3099).
#   2. Poll http://localhost:3099/api/health until it returns 200.
#   3. Confirm the backend service reports `healthy` via `docker compose ps`.
#       (Backend's /readyz is internal-only; we can't curl it from the host
#       without publishing backend's port. Inspecting compose health is the
#       canonical way and matches how `docker compose ps` displays it.)
#   4. Run the v2 end-to-end flow through the frontend proxy:
#       GET /api/cycles/current  -> envelope {success,data:Cycle}
#       POST /api/cycles         -> envelope, HTTP 201
#       GET /api/cycles?limit=5  -> envelope, meta {total,limit,offset}
#       GET /api/cycles/:id      -> envelope, full Cycle
#       PATCH addTasks           -> envelope, pointsEarned=0
#       PATCH updateTasks(complete) -> pointsEarned>0
#       PATCH moveTasks          -> envelope, success
#       PATCH updateTasks(uncomplete) -> pointsEarned<0
#       FIX-01: PATCH updateTasks gifUrl=<URL>, then gifUrl=null
#                                    -> field is cleared (W3 contract add-on)
#       invalid PATCH (strict extra key) -> 400 VALIDATION_ERROR
#       POST /:id/finish         -> envelope, {cycle, statistics, alreadyFinished}
#       PATCH again on finished cycle -> 409 CYCLE_FINISHED
#       GET /api/tasks           -> 404 (proxy allowlist no longer relays)
#   5. Verify SSR shell: curl / returns HTML containing "PixelPaladin" and
#       NO `googleapis` references (UB-34: self-hosted @fontsource fonts only).
#   6. On exit (any cause): docker compose -p pixelpaladin-smoke down -v,
#      remove the two :smoke images, delete temp files.
#
# Requirements: bash 4+, jq, curl, docker, docker compose v2.

set -euo pipefail

# ---- Configuration (override via env if you must) ---------------------------
: "${PROJECT:=pixelpaladin-smoke}"        # MUST stay this — live stack safety
: "${COMPOSE_FILE:=docker-compose.yml}"
: "${OVERRIDE_FILE:=scripts/smoke/compose.smoke.yml}"
: "${FRONTEND_PORT:=3099}"
: "${BASE_URL:=http://localhost:${FRONTEND_PORT}}"
: "${HEALTH_URL:=${BASE_URL}/api/health}"
: "${SMOKE_IMAGE_PREFIX:=local}"
: "${SMOKE_IMAGE_TAG:=smoke}"
: "${HEALTH_TIMEOUT_SEC:=180}"            # mongo + npm install + nuxt build
: "${HEALTH_INTERVAL_SEC:=2}"

# Resolve repo root (this script lives in <repo>/scripts/smoke/).
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/../.." >/dev/null 2>&1 && pwd)"
cd "${REPO_ROOT}"

if [[ ! -f "${OVERRIDE_FILE}" ]]; then
  echo "FATAL: override ${OVERRIDE_FILE} not found from ${REPO_ROOT}" >&2
  exit 2
fi

# Temp .env scoped to this script so the smoke build cannot leak into the
# user's real .env. Deleted in the trap.
SMOKE_ENV="$(mktemp -t pixelpaladin-smoke.env.XXXXXX)"
cat > "${SMOKE_ENV}" <<EOF
IMAGE_PREFIX=${SMOKE_IMAGE_PREFIX}
IMAGE_TAG=${SMOKE_IMAGE_TAG}
APP_PORT=${FRONTEND_PORT}
KLIPY_API_KEY=
EOF

# Response body scratch file (one per invocation; reused across steps).
RESP_BODY="$(mktemp -t pixelpaladin-smoke-resp.XXXXXX.json)"

# Compose command — pass SMOKE_ENV as the env file so it overrides any
# inherited values from the user's .env. Always -p $PROJECT.
DC=(docker compose --env-file "${SMOKE_ENV}" -p "${PROJECT}" -f "${COMPOSE_FILE}" -f "${OVERRIDE_FILE}")

cleanup() {
  local rc=$?
  echo
  echo "==> smoke cleanup (rc=${rc})"
  "${DC[@]}" down -v --remove-orphans 2>&1 || true
  docker image rm -f \
    "${SMOKE_IMAGE_PREFIX}/pixelpaladin-backend:${SMOKE_IMAGE_TAG}" \
    "${SMOKE_IMAGE_PREFIX}/pixelpaladin-frontend:${SMOKE_IMAGE_TAG}" \
    2>&1 || true
  rm -f "${SMOKE_ENV}" "${RESP_BODY}"
  exit "${rc}"
}
trap cleanup EXIT INT TERM

# ---- HTTP helpers -----------------------------------------------------------
HTTP_CODE=""
# req <METHOD> <PATH> [<JSON_BODY>] — populates HTTP_CODE, writes body to RESP_BODY
req() {
  local method="$1" path="$2" body="${3:-}"
  if [[ -n "$body" ]]; then
    HTTP_CODE="$(curl --silent --show-error \
      --output "${RESP_BODY}" \
      --write-out '%{http_code}' \
      -H 'content-type: application/json' \
      -X "${method}" "${BASE_URL}${path}" \
      --data "${body}")"
  else
    HTTP_CODE="$(curl --silent --show-error \
      --output "${RESP_BODY}" \
      --write-out '%{http_code}' \
      -X "${method}" "${BASE_URL}${path}")"
  fi
  echo "    HTTP ${HTTP_CODE}"
}

# Assert envelope: success:true, data present, error absent
assert_envelope_ok() {
  local label="${1:-ok}"
  if ! jq -e '.success == true and (.data // null) != null and (.error // null) == null' "${RESP_BODY}" >/dev/null; then
    echo "FATAL: envelope NOT OK at ${label}"
    echo "----- response body -----"
    cat "${RESP_BODY}"; echo
    exit 10
  fi
  echo "    envelope OK (${label})"
}

# Assert envelope error: success:false, error.code == $1
assert_envelope_err() {
  local expected_code="$1" label="${2:-err}"
  if ! jq -e --arg c "${expected_code}" \
      '.success == false and (.data // null) == null and .error.code == $c' \
      "${RESP_BODY}" >/dev/null; then
    echo "FATAL: envelope error mismatch at ${label} (expected code=${expected_code})"
    echo "----- response body -----"
    cat "${RESP_BODY}"; echo
    exit 11
  fi
  echo "    envelope error code=${expected_code} OK (${label})"
}

# ---- Compose up -------------------------------------------------------------
echo "==> smoke: project=${PROJECT}  build=${SMOKE_IMAGE_PREFIX}/pixelpaladin-*:smoke  port=${FRONTEND_PORT}"

echo "==> smoke: compose up --build (this may take a few minutes on first run)"
if [[ "${SMOKE_NOCACHE:-0}" == "1" ]]; then
  echo "==> smoke: SMOKE_NOCACHE=1 — building without cache"
  "${DC[@]}" build --no-cache
fi
"${DC[@]}" up -d --build

# ---- Wait for healthchecks --------------------------------------------------
echo "==> smoke: waiting for frontend ${HEALTH_URL} (timeout ${HEALTH_TIMEOUT_SEC}s)"
deadline=$(( $(date +%s) + HEALTH_TIMEOUT_SEC ))
while :; do
  if curl --silent --show-error --fail --output /dev/null "${HEALTH_URL}"; then
    echo "==> smoke: frontend /api/health = 200"
    break
  fi
  if (( $(date +%s) >= deadline )); then
    echo "FATAL: frontend never became healthy at ${HEALTH_URL}" >&2
    echo "--- last 40 lines of frontend logs ---" >&2
    "${DC[@]}" logs --tail=40 frontend >&2 || true
    exit 3
  fi
  sleep "${HEALTH_INTERVAL_SEC}"
done

echo "==> smoke: waiting for backend healthcheck via docker compose ps"
deadline=$(( $(date +%s) + HEALTH_TIMEOUT_SEC ))
while :; do
  backend_state="$("${DC[@]}" ps --format json 2>/dev/null \
    | awk -F'"' '/"Service":"backend"/{f=1} f && /"Health"/{print; exit}')"
  if [[ "${backend_state}" == *'"Health":"healthy"'* ]]; then
    echo "==> smoke: backend = healthy"
    break
  fi
  if (( $(date +%s) >= deadline )); then
    echo "FATAL: backend never became healthy" >&2
    "${DC[@]}" ps >&2 || true
    "${DC[@]}" logs --tail=40 backend >&2 || true
    exit 4
  fi
  sleep "${HEALTH_INTERVAL_SEC}"
done

# ---- v2 end-to-end flow -----------------------------------------------------
echo
echo "==> smoke: === v2 flow ==="

echo "==> smoke: [1] GET /api/cycles/current  (auto-create if none open)"
req GET /api/cycles/current
assert_envelope_ok "current"
CURRENT_UUID="$(jq -r '.data.uuid' "${RESP_BODY}")"
echo "    current cycle uuid: ${CURRENT_UUID}"

echo "==> smoke: [2] POST /api/cycles (with v2.1 startDate Monday)  -> 201"
# v2.1: include a Monday startDate so the smoke proves the new field travels
# through POST + GET. 2026-10-12 is a Monday in both 2025 and 2026; we pick a
# clearly-future date so it's never in the past during smoke runs.
SMOKE_START_DATE="2026-10-12"
req POST /api/cycles "$(jq -n --arg sd "${SMOKE_START_DATE}" '{name:"Smoke Test Cycle", startDate:$sd}')"
if [[ "${HTTP_CODE}" != "201" ]]; then
  echo "FATAL: POST /api/cycles expected 201, got ${HTTP_CODE}" >&2
  cat "${RESP_BODY}" >&2; echo >&2
  exit 12
fi
assert_envelope_ok "create"
# Verify startDate round-trips on the created cycle.
START_DATE_RAW="$(jq -r '.data.startDate' "${RESP_BODY}")"
if [[ "${START_DATE_RAW}" != "${SMOKE_START_DATE}" ]]; then
  echo "FATAL: created cycle.startDate expected ${SMOKE_START_DATE}, got ${START_DATE_RAW}" >&2
  cat "${RESP_BODY}" >&2
  exit 33
fi
echo "    cycle carries startDate=${START_DATE_RAW} OK"
assert_envelope_ok "create"
NEW_UUID="$(jq -r '.data.uuid' "${RESP_BODY}")"
WEEK_UUID="$(jq -r '.data.weeks[0].uuid' "${RESP_BODY}")"
DAY1_UUID="$(jq -r '.data.weeks[0].days[0].uuid' "${RESP_BODY}")"
DAY2_UUID="$(jq -r '.data.weeks[0].days[1].uuid' "${RESP_BODY}")"
echo "    new cycle uuid: ${NEW_UUID}  week: ${WEEK_UUID}"
echo "    day1: ${DAY1_UUID}  day2: ${DAY2_UUID}"

echo "==> smoke: [3] GET /api/cycles?limit=5  (summaries + meta)"
req GET '/api/cycles?limit=5'
assert_envelope_ok "list"
if ! jq -e '.meta.total != null and .meta.limit == 5 and .meta.offset == 0' "${RESP_BODY}" >/dev/null; then
  echo "FATAL: list response missing/wrong meta"; cat "${RESP_BODY}"; exit 13
fi
# Summaries must NOT carry `weeks` (projection excludes them)
if jq -e '.data[0].weeks' "${RESP_BODY}" >/dev/null 2>&1; then
  echo "FATAL: list response leaks weeks (should be summary projection)"; cat "${RESP_BODY}"; exit 13
fi
echo "    list meta OK; summaries omit weeks"

echo "==> smoke: [4] GET /api/cycles/${NEW_UUID}  (detail)"
req GET "/api/cycles/${NEW_UUID}"
assert_envelope_ok "detail"
if ! jq -e '.data.weeks | (length == 4 and (.[0].days | length == 7))' "${RESP_BODY}" >/dev/null; then
  echo "FATAL: detail cycle not 4×7"; cat "${RESP_BODY}"; exit 14
fi
echo "    detail shape OK (4 weeks × 7 days)"

echo "==> smoke: [5] PATCH addTasks  (pointsEarned should be 0)"
req PATCH "/api/cycles/${NEW_UUID}" "$(jq -n \
  --arg w "$WEEK_UUID" --arg d "$DAY1_UUID" \
  '{type:"addTasks", additions:[{weekUuid:$w, dayUuid:$d, task:{description:"smoke task", optional:false, completed:false, uuid:"t-smoke-1"}}]}')"
assert_envelope_ok "addTasks"
PE="$(jq -r '.data.pointsEarned' "${RESP_BODY}")"
if [[ "${PE}" != "0" ]]; then
  echo "FATAL: addTasks pointsEarned expected 0, got ${PE}"; cat "${RESP_BODY}"; exit 15
fi
echo "    pointsEarned=0 OK"

echo "==> smoke: [6] PATCH updateTasks complete -> pointsEarned > 0"
req PATCH "/api/cycles/${NEW_UUID}" '{"type":"updateTasks","updates":[{"uuid":"t-smoke-1","completed":true}]}'
assert_envelope_ok "complete"
PE="$(jq -r '.data.pointsEarned' "${RESP_BODY}")"
if ! jq -e '.data.pointsEarned > 0' "${RESP_BODY}" >/dev/null; then
  echo "FATAL: complete pointsEarned should be > 0, got ${PE}"; cat "${RESP_BODY}"; exit 16
fi
echo "    pointsEarned=${PE} (>0) OK; currentTier=$(jq -r '.data.currentTier' "${RESP_BODY}")"

echo "==> smoke: [7] PATCH moveTasks  (day1 -> day2)"
req PATCH "/api/cycles/${NEW_UUID}" "$(jq -n --arg d "$DAY2_UUID" \
  '{type:"moveTasks", taskUuid:"t-smoke-1", targetDayUuid:$d, targetIndex:0}')"
assert_envelope_ok "moveTasks"

echo "==> smoke: [8] PATCH updateTasks uncomplete -> pointsEarned < 0"
req PATCH "/api/cycles/${NEW_UUID}" '{"type":"updateTasks","updates":[{"uuid":"t-smoke-1","completed":false}]}'
assert_envelope_ok "uncomplete"
if ! jq -e '.data.pointsEarned < 0' "${RESP_BODY}" >/dev/null; then
  echo "FATAL: uncomplete pointsEarned should be < 0"; cat "${RESP_BODY}"; exit 17
fi
echo "    pointsEarned=$(jq -r '.data.pointsEarned' "${RESP_BODY}") (<0) OK"

# ---- FIX-01 — clearing gifUrl via PATCH (W3 contract add-on) --------------
echo
echo "==> smoke: [9] FIX-01 PATCH updateTasks(gifUrl=<URL>) then gifUrl=null clears the field"
req PATCH "/api/cycles/${NEW_UUID}" '{"type":"updateTasks","updates":[{"uuid":"t-smoke-1","gifUrl":"https://example.com/smoke.gif"}]}'
assert_envelope_ok "fix01-set"
# Now clear with null
req PATCH "/api/cycles/${NEW_UUID}" '{"type":"updateTasks","updates":[{"uuid":"t-smoke-1","gifUrl":null}]}'
assert_envelope_ok "fix01-clear"
# Read the cycle back and confirm the field is cleared. The contract says
# the field can be null OR absent; either is acceptable proof of clear.
req GET "/api/cycles/${NEW_UUID}"
assert_envelope_ok "fix01-get"
# Use a jq helper that captures both `gifUrl == null` and `has("gifUrl")|not`.
# We accept either as proof the field is cleared (no leftover URL).
GIFURL_RAW="$(jq -r '
  def find:
    [.data.weeks[].days[].tasks[] | select(.uuid=="t-smoke-1")][0].gifUrl
    // "<<missing>>";
  find
' "${RESP_BODY}")"
echo "    gifUrl after clear: ${GIFURL_RAW}"
if [[ "${GIFURL_RAW}" != "null" && "${GIFURL_RAW}" != "<<missing>>" ]]; then
  echo "FATAL: FIX-01 — gifUrl was not cleared (got '${GIFURL_RAW}')"
  cat "${RESP_BODY}"; exit 24
fi
echo "    FIX-01 clear OK (gifUrl cleared via null)"

echo "==> smoke: [10] invalid PATCH (strict extra key) -> 400 VALIDATION_ERROR"
req PATCH "/api/cycles/${NEW_UUID}" "$(jq -n \
  --arg w "$WEEK_UUID" --arg d "$DAY1_UUID" \
  '{type:"addTasks", additions:[{weekUuid:$w, dayUuid:$d, task:{description:"x", optional:false}}], evilExtraKey:true}')"
if [[ "${HTTP_CODE}" != "400" ]]; then
  echo "FATAL: invalid PATCH expected 400, got ${HTTP_CODE}"; cat "${RESP_BODY}"; exit 25
fi
assert_envelope_err VALIDATION_ERROR "invalid-patch"

# ---- v2.1 — completedAt set on a flip + cleared on reverse ----------------
echo
echo "==> smoke: [10a] v2.1 — PATCH updateTasks(complete) sets completedAt"
req PATCH "/api/cycles/${NEW_UUID}" '{"type":"updateTasks","updates":[{"uuid":"t-smoke-1","completed":true}]}'
assert_envelope_ok "completedAt-set"
req GET "/api/cycles/${NEW_UUID}"
assert_envelope_ok "completedAt-get"
COMPLETED_AT="$(jq -r '
  def find:
    [.data.weeks[].days[].tasks[] | select(.uuid=="t-smoke-1")][0].completedAt
    // "<<missing>>";
  find
' "${RESP_BODY}")"
echo "    completedAt after check: ${COMPLETED_AT}"
if [[ -z "${COMPLETED_AT}" || "${COMPLETED_AT}" == "<<missing>>" || "${COMPLETED_AT}" == "null" ]]; then
  echo "FATAL: completedAt must be set on completion, got '${COMPLETED_AT}'"; cat "${RESP_BODY}"; exit 31
fi
echo "    completedAt set OK"

echo "==> smoke: [10b] v2.1 — PATCH updateTasks(uncomplete) clears completedAt"
req PATCH "/api/cycles/${NEW_UUID}" '{"type":"updateTasks","updates":[{"uuid":"t-smoke-1","completed":false}]}'
assert_envelope_ok "completedAt-clear"
req GET "/api/cycles/${NEW_UUID}"
assert_envelope_ok "completedAt-get-after-clear"
COMPLETED_AT="$(jq -r '
  def find:
    [.data.weeks[].days[].tasks[] | select(.uuid=="t-smoke-1")][0].completedAt
    // "<<missing>>";
  find
' "${RESP_BODY}")"
echo "    completedAt after un-check: ${COMPLETED_AT}"
if [[ "${COMPLETED_AT}" != "null" && "${COMPLETED_AT}" != "<<missing>>" ]]; then
  echo "FATAL: completedAt was not cleared (got '${COMPLETED_AT}')"; cat "${RESP_BODY}"; exit 32
fi
echo "    completedAt clear OK (cleared via reverse flip)"

# ---- v2.1 — profile displayName PATCH + GET round-trip -------------------
echo
echo "==> smoke: [10c] v2.1 — PATCH /api/cycles/profile sets displayName; GET reflects it"
req PATCH "/api/cycles/profile" '{"displayName":"SmokeTester"}'
assert_envelope_ok "displayName-patch"
DN_RAW="$(jq -r '.data.displayName' "${RESP_BODY}")"
if [[ "${DN_RAW}" != "SmokeTester" ]]; then
  echo "FATAL: displayName patch expected 'SmokeTester', got '${DN_RAW}'"; cat "${RESP_BODY}"; exit 34
fi
# GET /profile round-trips it.
req GET "/api/cycles/profile"
assert_envelope_ok "displayName-get"
DN_GET="$(jq -r '.data.displayName' "${RESP_BODY}")"
if [[ "${DN_GET}" != "SmokeTester" ]]; then
  echo "FATAL: GET /profile displayName expected 'SmokeTester', got '${DN_GET}'"; cat "${RESP_BODY}"; exit 35
fi
echo "    displayName round-trip OK (set + get both 'SmokeTester')"
# Clear with null so subsequent runs aren't polluted by the previous displayName.
req PATCH "/api/cycles/profile" '{"displayName":null}'
assert_envelope_ok "displayName-clear"
DN_CLEAR="$(jq -r '.data.displayName' "${RESP_BODY}")"
if [[ "${DN_CLEAR}" != "null" ]]; then
  echo "FATAL: displayName clear expected null, got '${DN_CLEAR}'"; cat "${RESP_BODY}"; exit 36
fi
echo "    displayName clear OK (back to null)"

# ---- V2 A8: Task `notes` set + clear (mirrors FIX-01 gifUrl clear step) ---
echo
echo "==> smoke: [10b] V2 notes — set + clear via PATCH (V2 A8)"
req PATCH "/api/cycles/${NEW_UUID}" '{"type":"updateTasks","updates":[{"uuid":"t-smoke-1","notes":"morning routine memo"}]}'
assert_envelope_ok "notes-set"
req GET "/api/cycles/${NEW_UUID}"
assert_envelope_ok "notes-get"
NOTES_RAW="$(jq -r '
  def find:
    [.data.weeks[].days[].tasks[] | select(.uuid=="t-smoke-1")][0].notes
    // "<<missing>>";
  find
' "${RESP_BODY}")"
echo "    notes after set: ${NOTES_RAW}"
if [[ "${NOTES_RAW}" != "morning routine memo" ]]; then
  echo "FATAL: notes set failed (got '${NOTES_RAW}')"; cat "${RESP_BODY}"; exit 29
fi
echo "    notes set OK"
# Now clear with null
req PATCH "/api/cycles/${NEW_UUID}" '{"type":"updateTasks","updates":[{"uuid":"t-smoke-1","notes":null}]}'
assert_envelope_ok "notes-clear"
req GET "/api/cycles/${NEW_UUID}"
assert_envelope_ok "notes-get-after-clear"
NOTES_RAW="$(jq -r '
  def find:
    [.data.weeks[].days[].tasks[] | select(.uuid=="t-smoke-1")][0].notes
    // "<<missing>>";
  find
' "${RESP_BODY}")"
echo "    notes after clear: ${NOTES_RAW}"
if [[ "${NOTES_RAW}" != "null" && "${NOTES_RAW}" != "<<missing>>" ]]; then
  echo "FATAL: notes was not cleared (got '${NOTES_RAW}')"; cat "${RESP_BODY}"; exit 30
fi
echo "    notes clear OK (notes cleared via null)"

# ---- v2.2 — strike combos (E1+E2): same habit on two consecutive days → combo 2 ----
echo
echo "==> smoke: [10c] v2.2 — same habit on two consecutive days → combo 2 + bonus > 0"
# Two tasks with the same `habitId` placed in the same cycle on
# different days. Complete the first on day 1, then the second on day 2
# → the lookup chains → combo 2 with a bonus.
req PATCH "/api/cycles/${NEW_UUID}" "$(jq -n --arg w "$WEEK_UUID" --arg d2 "$DAY2_UUID" '
  {type:"addTasks", additions:[{
    weekUuid:$w, dayUuid:$d2,
    task:{uuid:"t-smoke-2", description:"smoke strike pair", optional:false, completed:false, habitId:"h-smoke-strike"}
  }]
}')"
assert_envelope_ok "strike-add-second"
# Pin the habitId on t-smoke-1 too — the original step seeded the task
# without one, so it has an auto-assigned `h-<base36>` id. Overwrite it so
# the strike lookup chains across them.
req PATCH "/api/cycles/${NEW_UUID}" '{"type":"updateTasks","updates":[{"uuid":"t-smoke-1","habitId":"h-smoke-strike"}]}'
assert_envelope_ok "strike-habit-pin"
# First completion (Monday 2026-10-13). t-smoke-1 is on DAY1_UUID (day 0
# of week 0 = Monday).
req PATCH "/api/cycles/${NEW_UUID}" '{"type":"updateTasks","updates":[{"uuid":"t-smoke-1","completed":true}],"clientDate":"2026-10-13"}'
assert_envelope_ok "strike-first"
# Second completion the next day on t-smoke-2 (which is in DAY2_UUID =
# day 1 of week 0 = Tuesday 2026-10-14). The lookup for habitKey
# 'h-smoke-strike' beforeIso 2026-10-14 finds t-smoke-1 (completed on
# 2026-10-13 ≤ 2026-10-14). diff = 1 day, combo → 2.
req PATCH "/api/cycles/${NEW_UUID}" '{"type":"updateTasks","updates":[{"uuid":"t-smoke-2","completed":true}],"clientDate":"2026-10-14"}'
assert_envelope_ok "strike-second"
if ! jq -e '.data.combo != null and .data.combo.combo == 2 and .data.combo.name == "DOUBLE STRIKE" and .data.combo.bonus > 0' "${RESP_BODY}" >/dev/null; then
  echo "FATAL: v2.2 strike response should report combo=2, name=DOUBLE STRIKE, bonus>0"
  cat "${RESP_BODY}"; exit 37
fi
STRIKE_BONUS="$(jq -r '.data.combo.bonus' "${RESP_BODY}")"
STRIKE_COMBO="$(jq -r '.data.combo.combo' "${RESP_BODY}")"
echo "    combo=${STRIKE_COMBO} name=DOUBLE STRIKE bonus=${STRIKE_BONUS} OK"
# Read the cycle back; combo/comboBonus/completedOn are persisted on the
# second task (the one the response describes).
req GET "/api/cycles/${NEW_UUID}"
assert_envelope_ok "strike-get"
COMBO_STATE="$(jq -r '
  [.data.weeks[].days[].tasks[] | select(.uuid=="t-smoke-2")][0]
  | { combo: .combo, comboBonus: .comboBonus, completedOn: .completedOn }
' "${RESP_BODY}")"
echo "    persisted combo state on t-smoke-2: ${COMBO_STATE}"
if ! jq -e '.combo == 2 and .comboBonus > 0 and (.completedOn == "2026-10-14")' <<< "${COMBO_STATE}" >/dev/null; then
  echo "FATAL: persisted combo state should be combo=2, comboBonus>0, completedOn=2026-10-14"
  cat "${RESP_BODY}"; exit 38
fi
echo "    strike chain OK (combo 2 + bonus > 0 persisted on t-smoke-2)"
# Third consecutive day must chain from the LATEST completion (combo 3).
# Regression guard: the real repository once kept the first match, which
# scored day 3 as DOUBLE STRIKE again.
DAY3_UUID="$(jq -r '.data.weeks[0].days[2].uuid' "${RESP_BODY}")"
req PATCH "/api/cycles/${NEW_UUID}" "$(jq -n --arg w "$WEEK_UUID" --arg d3 "$DAY3_UUID" '
  {type:"addTasks", additions:[{
    weekUuid:$w, dayUuid:$d3,
    task:{uuid:"t-smoke-3", description:"smoke strike pair", optional:false, completed:false, habitId:"h-smoke-strike"}
  }]
}')"
assert_envelope_ok "strike-add-third"
req PATCH "/api/cycles/${NEW_UUID}" '{"type":"updateTasks","updates":[{"uuid":"t-smoke-3","completed":true}],"clientDate":"2026-10-15"}'
assert_envelope_ok "strike-third"
if ! jq -e '.data.combo.combo == 3 and .data.combo.name == "TRIPLE STRIKE"' "${RESP_BODY}" >/dev/null; then
  echo "FATAL: third consecutive day should be combo=3 TRIPLE STRIKE"
  cat "${RESP_BODY}"; exit 39
fi
echo "    combo=3 TRIPLE STRIKE OK"

# ---- v2.2 — GET /api/cycles/insights returns the contract payload shape ----
echo
echo "==> smoke: [10d] v2.2 — GET /api/cycles/insights returns the contract payload"
req GET "/api/cycles/insights"
assert_envelope_ok "insights"
if ! jq -e '
  .data.perfectDays != null and .data.perfectDays.current != null and .data.perfectDays.longest != null
  and .data.finishedMonths != null and .data.finishedMonths.total != null and .data.finishedMonths.streak != null
  and (.data.habits | type == "array")
  and (.data.months | type == "array")
  and (.data.weekdayRates | type == "array" and (length == 7))
  and (.data.combatLog | type == "array")
' "${RESP_BODY}" >/dev/null; then
  echo "FATAL: insights payload missing one of the contract keys"; cat "${RESP_BODY}"; exit 39
fi
echo "    insights payload shape OK"

echo "==> smoke: [11] POST /api/cycles/${NEW_UUID}/finish"
req POST "/api/cycles/${NEW_UUID}/finish"
assert_envelope_ok "finish"
if ! jq -e '.data.alreadyFinished == false and .data.cycle.finished == true' "${RESP_BODY}" >/dev/null; then
  echo "FATAL: finish envelope wrong"; cat "${RESP_BODY}"; exit 26
fi
echo "    finished=true, alreadyFinished=false OK"

echo "==> smoke: [12] PATCH on finished cycle -> 409 CYCLE_FINISHED"
req PATCH "/api/cycles/${NEW_UUID}" '{"type":"updateTasks","updates":[{"uuid":"t-smoke-1","completed":true}]}'
if [[ "${HTTP_CODE}" != "409" ]]; then
  echo "FATAL: PATCH-on-finished expected 409, got ${HTTP_CODE}"; cat "${RESP_BODY}"; exit 27
fi
assert_envelope_err CYCLE_FINISHED "finished-patch"

echo "==> smoke: [v23-1] GET /api/cycles/rewards  (synced payload)"
req GET /api/cycles/rewards
assert_envelope_ok "rewards-get"
if ! jq -e '
  .data.credits != null and .data.level != null and .data.title != null
  and .data.lifetimeScore != null
  and .data.nextReward != null and .data.nextReward.level != null and .data.nextReward.xpRemaining != null
  and (.data.chests | type == "array")
  and (.data.achievements | type == "array" and (length == 16))
' "${RESP_BODY}" >/dev/null; then
  echo "FATAL: rewards payload missing one of the contract keys"; cat "${RESP_BODY}"; exit 41
fi
echo "    rewards payload shape OK (credits, level, title, nextReward, chests[], achievements[16])"
REWARD_CREDITS_BEFORE="$(jq -r '.data.credits' "${RESP_BODY}")"
echo "    credits before claim: ${REWARD_CREDITS_BEFORE}"

# Find a chest we can claim. The contract backfills chests for every level
# 2..current; the smoke run generates enough XP for at least one chest.
# We try the first few chest ids (`ch-2` .. `ch-5`) and pick the first one
# the server returns. Falls back to "no chests claimable" — still PASS, but
# the claim steps below become no-ops and we don't fail the smoke.
CLAIMED_CHEST_ID=""
for cid in ch-2 ch-3 ch-4 ch-5 ch-6; do
  CANDIDATE="$(jq -r --arg c "$cid" '[.data.chests[] | select(.id == $c and .claimedAt == null)][0].id // ""' "${RESP_BODY}")"
  if [[ -n "${CANDIDATE}" ]]; then CLAIMED_CHEST_ID="${CANDIDATE}"; break; fi
done
echo "    chose chest id for claim: ${CLAIMED_CHEST_ID:-<none>}"

if [[ -n "${CLAIMED_CHEST_ID}" ]]; then
  echo "==> smoke: [v23-2] POST /api/cycles/rewards/chests/${CLAIMED_CHEST_ID}/claim  (200, credits > 0)"
  req POST "/api/cycles/rewards/chests/${CLAIMED_CHEST_ID}/claim"
  assert_envelope_ok "rewards-claim"
  CLAIMED_CREDITS="$(jq -r '.data.credits' "${RESP_BODY}")"
  CLAIMED_CHEST_RARITY="$(jq -r '.data.chest.rarity // ""' "${RESP_BODY}")"
  # `data.credits` here is the awarded amount (per §3 — not the post-claim balance).
  if ! jq -e '.data.credits > 0' "${RESP_BODY}" >/dev/null; then
    echo "FATAL: claim credits must be > 0, got ${CLAIMED_CREDITS}"
    cat "${RESP_BODY}"; exit 42
  fi
  if ! jq -e '.data.chest.rarity | type == "string" and (. == "common" or . == "rare" or . == "epic" or . == "legendary")' "${RESP_BODY}" >/dev/null; then
    echo "FATAL: claimed chest did not return a valid rarity (${CLAIMED_CHEST_RARITY})"
    cat "${RESP_BODY}"; exit 42
  fi
  echo "    claimed credits=${CLAIMED_CREDITS} (rarity=${CLAIMED_CHEST_RARITY}) OK"

  echo "==> smoke: [v23-3] POST same claim again -> 409 ALREADY_CLAIMED"
  req POST "/api/cycles/rewards/chests/${CLAIMED_CHEST_ID}/claim"
  if [[ "${HTTP_CODE}" != "409" ]]; then
    echo "FATAL: second claim expected 409, got ${HTTP_CODE}"; cat "${RESP_BODY}"; exit 43
  fi
  assert_envelope_err ALREADY_CLAIMED "rewards-already-claimed"
fi

# GET /rewards shape: chests include rarity + credits for claimed rows
# (this also re-syncs the profile, which is OK after a 409).
echo "==> smoke: [v23-4] GET /api/cycles/rewards — re-sync after claim shows claimed chest with rarity+credits"
req GET /api/cycles/rewards
assert_envelope_ok "rewards-resync"
if [[ -n "${CLAIMED_CHEST_ID}" ]]; then
  if ! jq -e --arg c "${CLAIMED_CHEST_ID}" '
    .data.chests
    | map(select(.id == $c))
    | (.[0].claimedAt != null and .[0].rarity != null and .[0].credits != null)
  ' "${RESP_BODY}" >/dev/null; then
    echo "FATAL: claimed chest ${CLAIMED_CHEST_ID} not visible with claimedAt+rarity+credits on resync"
    cat "${RESP_BODY}"; exit 44
  fi
  echo "    claimed chest ${CLAIMED_CHEST_ID} persists with rarity + credits OK"
fi

# Unknown chest → 404.
echo "==> smoke: [v23-5] POST /api/cycles/rewards/chests/ch-doesnotexist/claim -> 404 NOT_FOUND"
req POST "/api/cycles/rewards/chests/ch-doesnotexist/claim"
if [[ "${HTTP_CODE}" != "404" ]]; then
  echo "FATAL: unknown chest expected 404, got ${HTTP_CODE}"; cat "${RESP_BODY}"; exit 45
fi
assert_envelope_err NOT_FOUND "rewards-chest-404"

echo "==> smoke: [13] GET /api/tasks  (proxy allowlist removed it -> 404)"
req GET /api/tasks
if [[ "${HTTP_CODE}" != "404" ]]; then
  echo "FATAL: /api/tasks should be 404, got ${HTTP_CODE}"; cat "${RESP_BODY}"; exit 28
fi
echo "    /api/tasks = 404 (proxy no longer relays) OK"

# ---- SSR shell + self-hosted fonts -----------------------------------------
echo
echo "==> smoke: [14] SSR shell on /  (must mention PixelPaladin + no googleapis)"
INDEX_HTML="$(mktemp -t pixelpaladin-smoke-index.XXXXXX.html)"
ROOT_HTTP="$(curl --silent --show-error --output "${INDEX_HTML}" --write-out '%{http_code}' "${BASE_URL}/")"
echo "    GET /  -> HTTP ${ROOT_HTTP}"
if ! grep -q "PixelPaladin" "${INDEX_HTML}"; then
  echo "FATAL: SSR HTML missing app shell marker 'PixelPaladin'"
  echo "----- captured SSR body (first 800 bytes) -----"
  head -c 800 "${INDEX_HTML}"; echo
  echo "----- end body -----"
  echo "----- last 60 lines of frontend logs -----"
  "${DC[@]}" logs --tail=60 frontend 2>&1 | tail -60 || true
  echo "----- end logs -----"
  cp "${INDEX_HTML}" /tmp/pixelpaladin-smoke-ssr-failure.html
  exit 22
fi
if grep -qi "googleapis" "${INDEX_HTML}"; then
  echo "FATAL: SSR HTML references googleapis (UB-34: fonts must be self-hosted)"; grep -i googleapis "${INDEX_HTML}"; exit 23
fi
echo "    app shell OK; no Google Fonts CDN"
rm -f "${INDEX_HTML}"

# ---- 404 page (hard) + report-only observability --
echo
echo "==> smoke: [15] GET /does-not-exist as a browser -> 404 page (W4b error.vue)"
NOTFOUND_HTTP="$(curl --silent --show-error -H 'Accept: text/html' --output /tmp/pixelpaladin-smoke-404.html --write-out '%{http_code}' "${BASE_URL}/does-not-exist")"
echo "    GET /does-not-exist  -> HTTP ${NOTFOUND_HTTP}"
if [[ "${NOTFOUND_HTTP}" != "404" ]] || ! grep -q 'BACK TO QUESTS' /tmp/pixelpaladin-smoke-404.html; then
  echo "FATAL: expected HTTP 404 with the pixel 404 page (BACK TO QUESTS)"
  rm -f /tmp/pixelpaladin-smoke-404.html
  exit 15
fi
echo "    404 page OK"
rm -f /tmp/pixelpaladin-smoke-404.html

echo
echo "==> smoke: [16] REPORT-ONLY scan frontend logs for 5xx during the run"
echo
FRONTEND_LOGS="$("${DC[@]}" logs --no-color frontend 2>&1 || true)"
FIVE_XX_COUNT="$(printf '%s\n' "${FRONTEND_LOGS}" | grep -cE ' 5[0-9]{2} ' || true)"
echo "    5xx occurrences in frontend logs: ${FIVE_XX_COUNT}"
if (( FIVE_XX_COUNT > 0 )); then
  echo "    --- matching lines ---"
  printf '%s\n' "${FRONTEND_LOGS}" | grep -E ' 5[0-9]{2} ' | head -10
  echo "    --- end ---"
fi

echo
echo "==> smoke: PASS (v2 flow)"
# trap will run cleanup now.