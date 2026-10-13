/*
 * V2 Combat Deck icon name registry (contract §2).
 *
 * Exported from a separate `.ts` file (not from inside `<script setup>`,
 * which does not allow ES module exports) so it can be imported by
 * PpIcon.vue, by the check-icons.mjs smoke test, and by any other
 * consumer that wants type safety over the icon name union.
 */

export type IconName =
  | "grid_view"
  | "insights"
  | "settings"
  | "add"
  | "add_box"
  | "content_copy"
  | "check"
  | "close"
  | "edit"
  | "edit_note"
  | "delete"
  | "filter_list"
  | "sync_alt"
  | "alt_route"
  | "terminal"
  | "radar"
  | "center_focus_strong"
  | "grid_4x4"
  | "auto_videocam"
  | "videocam_off"
  | "workspace_premium"
  | "military_tech"
  | "shield"
  | "security"
  | "event_repeat"
  | "menu"
  | "chevron_left"
  | "chevron_right"
  | "star"
  | "drag_indicator"
  | "calendar_month"
  | "more_horiz"
  | "refresh"
  | "flag"
  | "swap_horiz"
  | "notes";

export const ICON_NAMES: IconName[] = [
  "grid_view",
  "insights",
  "settings",
  "add",
  "add_box",
  "content_copy",
  "check",
  "close",
  "edit",
  "edit_note",
  "delete",
  "filter_list",
  "sync_alt",
  "alt_route",
  "terminal",
  "radar",
  "center_focus_strong",
  "grid_4x4",
  "auto_videocam",
  "videocam_off",
  "workspace_premium",
  "military_tech",
  "shield",
  "security",
  "event_repeat",
  "menu",
  "chevron_left",
  "chevron_right",
  "star",
  "drag_indicator",
  "calendar_month",
  "more_horiz",
  "refresh",
  "flag",
  "swap_horiz",
  "notes",
];
