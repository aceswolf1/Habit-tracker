#!/usr/bin/env bash
# scripts/preview/seed-demo-month.sh — idempotent demo month seed for preview.
#
# Creates exactly one "Demo Month" cycle with a populated week 1:
#     - 3-5 tasks per day for week 1 (Mon-Sun)
#     - a few completed (enough to show progress without finishing)
#     - one legendary task (1.5× point multiplier)
#     - one optional task (counts toward the +2% monthly bonus once 100%)
#     - one task with an emoji icon
# Other weeks stay bare so the FE can demonstrate the empty-day affordance.
#
# Idempotent: if a "Demo Month" cycle already exists in the backend store,
# this script exits 0 and DOES NOT create a duplicate.
#
# Usage: bash scripts/preview/seed-demo-month.sh [base-url]
#   base-url default: http://localhost:3200

set -euo pipefail

BASE_URL="${1:-http://localhost:3200}"
CYCLE_NAME="Demo Month"

# 8-bit pixel-flavored task descriptions with a mix of completed / legendary /
# optional / emoji-icon. Rows = Mon..Sun. Within each row:
#   [description, optional, completed, legendary, emoji-icon | null]
TASKS_JSON='[
  [["Drink 8 glasses of water",         false, false, false, null],
   ["Morning stretching routine",       false, false, false, null],
   ["Take a 30-min walk",               false, false, false, "🚶"],
   ["Read 20 pages",                    false, false, false, null]],

  [["Drink 8 glasses of water",         false, false, false, null],
   ["Morning stretching routine",       false, true,  false, null],
   ["Take a 30-min walk",               false, true,  false, "🚶"],
   ["Meditate 10 minutes",              false, false, false, null],
   ["Read 30 pages",                    false, false, false, null]],

  [["Drink 8 glasses of water",         false, true,  false, null],
   ["Morning stretching routine",       false, true,  false, null],
   ["Take a 30-min walk",               false, true,  false, "🚶"],
   ["Write in journal",                 false, false, false, null]],

  [["Drink 8 glasses of water",         false, false, false, null],
   ["Morning stretching routine",       false, true,  false, null],
   ["Defeat the Week'\''s Mini-boss",   false, false, true,  null],
   ["Optional: try a new recipe",       true,  false, false, null],
   ["Read 30 pages",                    false, false, false, null]],

  [["Drink 8 glasses of water",         false, false, false, null],
   ["Morning stretching routine",       false, false, false, null],
   ["Take a 30-min walk",               false, false, false, "🚶"]],

  [["Weekend free play",                false, false, false, null],
   ["Optional: deep clean the kitchen", true,  false, false, null]],

  [["Plan the week ahead",              false, false, false, null],
   ["Drink 8 glasses of water",         false, false, false, null]]
]'

# ---- Helpers -----------------------------------------------------------------
log() { echo "==> seed: $*"; }

# Idempotency check: list cycles and see if CYCLE_NAME is present.
LIST="$(curl --silent --show-error --fail "${BASE_URL}/api/cycles?limit=100")"
if echo "${LIST}" | jq -e --arg n "${CYCLE_NAME}" '.data | map(.name == $n) | any' >/dev/null; then
  log "${CYCLE_NAME} already exists — skipping seed"
  exit 0
fi

# ---- Create the cycle ------------------------------------------------------
log "creating ${CYCLE_NAME} via POST /api/cycles"
CREATE_BODY="$(jq -n --arg n "${CYCLE_NAME}" '{name:$n}')"
CREATE_RES="$(curl --silent --show-error --fail \
  -H 'content-type: application/json' \
  -X POST "${BASE_URL}/api/cycles" \
  --data "${CREATE_BODY}")"
CYCLE_UUID="$(echo "${CREATE_RES}" | jq -r '.data.uuid')"
WEEK1_UUID="$(echo "${CREATE_RES}" | jq -r '.data.weeks[0].uuid')"
log "cycle=${CYCLE_UUID}  week1=${WEEK1_UUID}"

# ---- Build PATCH addTasks body via inline node ---------------------------
# Using node here (not jq) because the structure requires iterating the
# TASKS_JSON rows (per day) and emitting one taskEntry per row into the
# additions[] array.
ADD_BODY="$(BASE_URL="${BASE_URL}" CREATE_RES="${CREATE_RES}" TASKS_JSON="${TASKS_JSON}" node -e '
const baseUrl = process.env.BASE_URL;
const cycle   = JSON.parse(process.env.CREATE_RES).data;
const tasks   = JSON.parse(process.env.TASKS_JSON);
const week1   = cycle.weeks[0];
const additions = [];
for (let i = 0; i < 7; i++) {
  const day = week1.days[i];
  const dayTasks = tasks[i] || [];
  for (let j = 0; j < dayTasks.length; j++) {
    const [desc, opt, comp, leg, icon] = dayTasks[j];
    const t = {
      description: desc,
      optional:    !!opt,
      completed:   !!comp,
      legendary:   !!leg,
    };
    if (icon) {
      t.icon = icon;
      t.uuid = `t-${i}-${j}`;
    }
    additions.push({ weekUuid: week1.uuid, dayUuid: day.uuid, task: t });
  }
}
console.log(JSON.stringify({ type: "addTasks", additions }));
')"

log "PATCH addTasks (${#ADD_BODY} bytes)"
PATCH1_HTTP="$(curl --silent --show-error --output /tmp/seed-add.json --write-out '%{http_code}' \
  -H 'content-type: application/json' \
  -X PATCH "${BASE_URL}/api/cycles/${CYCLE_UUID}" \
  --data "${ADD_BODY}")"
if [[ "${PATCH1_HTTP}" != "200" ]]; then
  echo "FATAL: addTasks HTTP ${PATCH1_HTTP}"; cat /tmp/seed-add.json; exit 4
fi
log "addTasks pointsEarned=$(jq -r .data.pointsEarned /tmp/seed-add.json)"

# ---- Mark a couple more tasks completed via updateTasks --------------------
# These updates simulate a user clicking later — exercises a second PATCH
# shape so the preview-stack timeline shows the full surface.
log "PATCH updateTasks (a couple of completions)"
UPD_BODY='{"type":"updateTasks","updates":[{"uuid":"t-2-3","completed":true},{"uuid":"t-3-1","completed":true}]}'
PATCH2_HTTP="$(curl --silent --show-error --output /tmp/seed-upd.json --write-out '%{http_code}' \
  -H 'content-type: application/json' \
  -X PATCH "${BASE_URL}/api/cycles/${CYCLE_UUID}" \
  --data "${UPD_BODY}")"
if [[ "${PATCH2_HTTP}" != "200" ]]; then
  echo "FATAL: updateTasks HTTP ${PATCH2_HTTP}"; cat /tmp/seed-upd.json; exit 5
fi
log "updateTasks pointsEarned=$(jq -r .data.pointsEarned /tmp/seed-upd.json)  currentTier=$(jq -r .data.currentTier /tmp/seed-upd.json)"

log "${CYCLE_NAME} seeded"
echo "    cycle uuid: ${CYCLE_UUID}"