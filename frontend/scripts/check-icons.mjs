#!/usr/bin/env node
/*
 * V2 Combat Deck icon smoke check.
 *
 * Asserts that `frontend/components/ui/PpIcon.vue` exports a non-empty
 * path for every name in the contract §2 IconName list. Exits 0 when
 * every name resolves to a non-empty `d` string; exits 1 with a count
 * of missing icons otherwise.
 *
 * Usage:
 *   node frontend/scripts/check-icons.mjs
 *
 * Reads the source as text and pulls the `PATHS` block out of the
 * <script setup> section, so it does NOT require a built / running
 * app. Run after every icon rename or addition.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ICON_PATH = resolve(__dirname, "../components/ui/PpIcon.vue");

const ICON_NAMES = [
  "grid_view", "insights", "settings", "add", "add_box", "content_copy",
  "check", "close", "edit", "edit_note", "delete", "filter_list",
  "sync_alt", "alt_route", "terminal", "radar", "center_focus_strong",
  "grid_4x4", "auto_videocam", "videocam_off", "workspace_premium",
  "military_tech", "shield", "security", "event_repeat", "menu",
  "chevron_left", "chevron_right", "star", "drag_indicator",
  "calendar_month", "more_horiz", "refresh", "flag", "swap_horiz",
  "notes",
];

function extractPaths(src) {
  // Grep the PATHS = { ... } block (best-effort, the source is hand-
  // maintained so the format is stable). Walk char-by-char from the
  // opening `{` to the matching `}` at column 0.
  const key = "const PATHS";
  const start = src.indexOf(key);
  if (start < 0) throw new Error("PATHS object not found in PpIcon.vue");
  const braceStart = src.indexOf("{", start);
  if (braceStart < 0) throw new Error("PATHS = { not found");
  // Find the closing `}` at column 0 (newline + "};" or "}").
  let depth = 0;
  let end = -1;
  for (let i = braceStart; i < src.length; i++) {
    const c = src[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }
  if (end < 0) throw new Error("PATHS closing brace not found");
  const body = src.slice(braceStart + 1, end);

  // Collect every `name: "d-string"` pair. Keys may be unquoted
  // identifiers (TS object literal shorthand) or quoted strings; both
  // are valid forms of `Record<IconName, string>`.
  const out = {};
  const re = /(?:"([a-z_]+)"|([a-z_][a-z0-9_]*))\s*:\s*"((?:\\.|[^"\\])*)"/g;
  let m;
  while ((m = re.exec(body)) !== null) {
    const key = m[1] ?? m[2];
    out[key] = m[3];
  }
  return out;
}

const src = readFileSync(ICON_PATH, "utf8");
const paths = extractPaths(src);

let missing = 0;
let empty = 0;
for (const name of ICON_NAMES) {
  if (!(name in paths)) {
    console.error(`✗ ${name}: not present in PATHS`);
    missing++;
    continue;
  }
  if (!paths[name] || paths[name].trim().length === 0) {
    console.error(`✗ ${name}: present but empty path`);
    empty++;
  }
}

const extras = Object.keys(paths).filter((k) => !ICON_NAMES.includes(k));
if (extras.length) {
  console.warn(`! ${extras.length} extra path(s) not in IconName: ${extras.join(", ")}`);
}

if (missing === 0 && empty === 0) {
  console.log(
    `✓ ${ICON_NAMES.length}/${ICON_NAMES.length} icons have paths (extras: ${extras.length})`,
  );
  process.exit(0);
}

console.error(`FAIL: missing=${missing} empty=${empty} (of ${ICON_NAMES.length})`);
process.exit(1);
