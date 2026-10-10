import { defineEventHandler, getRequestURL, setResponseStatus } from "h3";

/**
 * Nitro catch-all for any `/api/*` request that no other route or middleware
 * claimed. Returns the v2 error envelope (see
 * `orchestration-ctx/decisions/api-contract-v2.md` §1) with `code: "NOT_FOUND"`.
 *
 * Route precedence — this file MUST NOT shadow:
 *   - `/api/health`, `/api/klipy/*` → these live as explicit files under
 *     `frontend/server/api/**` and Nitro's router resolves the more specific
 *     path first.
 *   - `/api/cycles/*` and `/api/cycles` → `server/middleware/backend-proxy.ts`
 *     runs ahead of route resolution; when it answers the request, the
 *     handler chain short-circuits and this catch-all is never reached.
 *
 * Supports every HTTP method (GET, POST, PATCH, DELETE, …) so callers like
 * `POST /api/tasks` or `PATCH /api/does-not-exist` get the same answer.
 */
export default defineEventHandler((event) => {
  const url = getRequestURL(event);
  const pathname = url.pathname;
  setResponseStatus(event, 404);
  return {
    success: false,
    error: {
      code: "NOT_FOUND",
      message: `Unknown API route: ${pathname}`,
    },
  };
});
