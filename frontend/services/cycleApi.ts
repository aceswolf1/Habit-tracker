/**
 * `cycleApi` is the ONLY module in the frontend that issues `fetch()` calls
 * to `/api/cycles*`. Every other module (stores, components) goes through
 * this facade so:
 *
 *   1. The envelope `{ success, data, meta? }` is unwrapped in one place.
 *   2. The error shape `{ success: false, error: { code, message, details } }`
 *      is normalized into a typed `ApiError`.
 *   3. Legacy un-enveloped response shapes are tolerated during the BE
 *      rollout window (per contract §5: "also accepts a legacy un-enveloped
 *      body — tolerance for image skew").
 *
 * Contract: `development/remediation-w2/orchestration-ctx/decisions/api-contract-v2.md`
 * + `development/v2-features/orchestration-ctx/decisions/contract-v2.1.md`.
 *
 * IMPORTANT: do NOT add direct `fetch("/api/cycles…")` calls elsewhere.
 */

import type {
  Cycle,
  CycleSummary,
  PaginationMeta,
  PatchBody,
  PatchResult,
  FinishResult,
  Profile,
  ProfilePatch,
  Insights,
} from "../types/index";
import { todayIso } from "../utils/sharedDates";

// ---------- Errors ----------

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
  /** True when a backend-rejected write left state stale and we need to refetch. */
  get isPersistFailure(): boolean {
    return this.status >= 400 && this.code !== "VALIDATION_ERROR";
  }
}

// ---------- Low-level envelope handling ----------

/**
 * Throw an `ApiError` for a known `{success:false, error:{…}}` envelope that
 * did not parse as OK. Also handles the rare case of a non-2xx with a junk
 * body.
 */
function throwIfFailed(res: Response, body: any): void {
  if (body && typeof body === "object" && body.success === false) {
    throw new ApiError(
      res.status,
      body.error?.code || "INTERNAL",
      body.error?.message || "Request failed",
      body.error?.details,
    );
  }
  if (!res.ok) {
    throw new ApiError(
      res.status,
      "INTERNAL",
      `Request failed (HTTP ${res.status})`,
    );
  }
}

/**
 * Pull the "payload" out of an OK response:
 *   - new envelope `{success:true, data:<payload>}`   → returns `<payload>`
 *   - legacy envelope `{success:true, cycle, ...}`    → returns body itself
 *   - truly un-enveloped body                         → returns body as-is
 */
function extractPayload(body: any): any {
  if (
    body &&
    typeof body === "object" &&
    body.success === true &&
    "data" in body
  ) {
    return body.data;
  }
  return body;
}

// ---------- Public surface ----------

export interface ListCyclesResult {
  summaries: CycleSummary[];
  meta?: PaginationMeta;
}

export async function listCycles(
  params: { limit?: number; offset?: number } = {}
): Promise<ListCyclesResult> {
  const qs = new URLSearchParams();
  if (params.limit !== undefined) qs.set("limit", String(params.limit));
  if (params.offset !== undefined) qs.set("offset", String(params.offset));
  const url = qs.toString()
    ? `/api/cycles?${qs.toString()}`
    : "/api/cycles";

  const res = await fetch(url);
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    /* empty */
  }
  throwIfFailed(res, body);

  // Truly legacy: backend returned an array directly.
  if (Array.isArray(body)) {
    return { summaries: body as CycleSummary[] };
  }
  // New envelope: `body.data = summaries[]` and top-level `meta`.
  if (
    body &&
    typeof body === "object" &&
    body.success === true &&
    "data" in body &&
    Array.isArray(body.data)
  ) {
    return { summaries: body.data as CycleSummary[], meta: body.meta };
  }
  // Legacy shape `{success:true, …cycles as properties}` — defensive only.
  if (body && typeof body === "object" && Array.isArray(body.cycles)) {
    return { summaries: body.cycles as CycleSummary[] };
  }
  return { summaries: [] };
}

export async function getCurrent(): Promise<Cycle> {
  const res = await fetch("/api/cycles/current");
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    /* empty */
  }
  throwIfFailed(res, body);
  const payload = extractPayload(body);
  // Legacy: `{success:true, cycle}` or bare cycle object.
  return (payload && payload.cycle ? payload.cycle : payload) as Cycle;
}

export async function getCycle(uuid: string): Promise<Cycle> {
  const res = await fetch(`/api/cycles/${encodeURIComponent(uuid)}`);
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    /* empty */
  }
  throwIfFailed(res, body);
  const payload = extractPayload(body);
  // Legacy: backend might have returned `{success:true, cycle}` for some
  // versions of this route.
  return (payload && payload.cycle ? payload.cycle : payload) as Cycle;
}

export async function getProfile(): Promise<Profile> {
  const res = await fetch("/api/cycles/profile");
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    /* empty */
  }
  throwIfFailed(res, body);
  const payload = extractPayload(body);
  const profile: Profile = {
    uuid: payload?.uuid || "",
    lifetimeScore: Number(payload?.lifetimeScore) || 0,
  };
  // v2.1: include `displayName` when present. The backend may omit it on
  // very old payloads; missing → undefined (consumer turns it into null).
  if (payload && Object.prototype.hasOwnProperty.call(payload, "displayName")) {
    profile.displayName = payload.displayName ?? null;
  }
  return profile;
}

/**
 * v2.1: PATCH `/api/cycles/profile`. `null` clears the display name;
 * an empty string is rejected by the backend (1..24 chars). Returns the
 * updated profile so callers can keep `state.profile` in sync.
 */
export async function updateProfile(patch: ProfilePatch): Promise<Profile> {
  const res = await fetch("/api/cycles/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    /* empty */
  }
  throwIfFailed(res, body);
  const payload = extractPayload(body);
  return {
    uuid: payload?.uuid || "",
    lifetimeScore: Number(payload?.lifetimeScore) || 0,
    displayName: payload?.displayName ?? null,
  } as Profile;
}

/**
 * v2.1: create a cycle, optionally with a Monday `startDate`. Both args
 * are forwarded straight into the POST body. The backend rejects a non-
 * Monday `startDate` with 400 `VALIDATION_ERROR`.
 */
export async function createCycle(
  name?: string,
  startDate?: string,
): Promise<Cycle> {
  const body: Record<string, unknown> = {};
  if (name !== undefined && name !== null && name !== "") body.name = name;
  if (startDate !== undefined && startDate !== null && startDate !== "") {
    body.startDate = startDate;
  }
  const res = await fetch("/api/cycles", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let raw: any = null;
  try {
    raw = await res.json();
  } catch {
    /* empty */
  }
  throwIfFailed(res, raw);
  const payload = extractPayload(raw);
  // Legacy: `{success:true, cycle}` or `{success:true, month}`.
  return (
    (payload && (payload.cycle || payload.month)) || payload
  ) as Cycle;
}

/**
 * PATCH a cycle. The body must be a discriminated union (see contract §4).
 * The response is normalized into a `PatchResult`, accepting either
 * `{cycle, pointsEarned, …}` (new) or `{month, pointsEarned, …}` (legacy).
 *
 * v2.2: when the body is `{type:"updateTasks", …}` and `clientDate` is
 * not already set, we stamp the browser-local date so the BE's
 * `completedOn` reflects the user's wall-clock. The server is the source
 * of truth — this is just for combo math.
 */
export async function patchCycle(
  uuid: string,
  body: PatchBody
): Promise<PatchResult> {
  let bodyToSend: PatchBody = body;
  if (body && body.type === "updateTasks" && !body.clientDate) {
    bodyToSend = { ...body, clientDate: todayIso() };
  }
  const res = await fetch(`/api/cycles/${encodeURIComponent(uuid)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(bodyToSend),
  });
  let raw: any = null;
  try {
    raw = await res.json();
  } catch {
    /* empty */
  }
  throwIfFailed(res, raw);
  const payload = extractPayload(raw);
  // Legacy uses `month` where the contract now uses `cycle`.
  const cycle = (payload && (payload.cycle || payload.month)) || null;
  if (!cycle) {
    // PATCH with no cycle in response is unexpected; surface as a soft error.
    throw new ApiError(
      res.status,
      "INTERNAL",
      "PATCH response missing cycle payload",
    );
  }
  const result: PatchResult = {
    cycle: cycle as Cycle,
    pointsEarned: Number(payload?.pointsEarned) || 0,
    isLegendary: Boolean(payload?.isLegendary),
    currentTier: payload?.currentTier ?? "",
  };
  // v2.2: optional `combo` field (last completion in the request).
  if (payload && payload.combo && typeof payload.combo === "object") {
    const c = payload.combo;
    result.combo = {
      taskUuid: String(c.taskUuid || ""),
      combo: Number(c.combo) || 1,
      name: typeof c.name === "string" ? c.name : null,
      bonus: Number(c.bonus) || 0,
    };
  }
  return result;
}

export async function finishCycle(uuid: string): Promise<FinishResult> {
  const res = await fetch(`/api/cycles/${encodeURIComponent(uuid)}/finish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    /* empty */
  }
  throwIfFailed(res, body);
  const payload = extractPayload(body);
  // New: `{cycle, statistics, alreadyFinished}`. Legacy: `{success:true, cycle, statistics}`.
  return {
    cycle: (payload?.cycle ?? null) as Cycle,
    statistics: (payload?.statistics ?? null) as FinishResult["statistics"],
    alreadyFinished: Boolean(payload?.alreadyFinished),
  };
}

/**
 * v2.2: read-only insights endpoint (`GET /api/cycles/insights`). See
 * `development/v2-features/orchestration-ctx/decisions/contract-v2.2.md`
 * §3 for the full payload shape.
 */
export async function getInsights(): Promise<Insights> {
  const res = await fetch("/api/cycles/insights");
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    /* empty */
  }
  throwIfFailed(res, body);
  const payload = extractPayload(body);
  return (payload || {}) as Insights;
}
