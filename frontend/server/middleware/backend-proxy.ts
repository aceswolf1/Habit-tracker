import { defineEventHandler, proxyRequest } from "h3";

/**
 * Reverse proxy for the Express backend.
 *
 * The browser talks to the Nuxt server on the same origin (`/api/cycles…`)
 * and this middleware forwards those requests to the backend service. This
 * keeps the backend host/IP out of client code and avoids CORS entirely —
 * essential when the app is served from a NAS and reached from other
 * devices on the LAN.
 *
 * A middleware (rather than a catch-all route) is used so the bare list
 * endpoint (`/api/cycles`) is matched as well as nested paths like
 * `/api/cycles/:uuid`. Returning a value here ends the request; other
 * paths fall through untouched (normal page rendering, future local Nitro
 * routes).
 *
 * Target resolves at runtime from `BACKEND_URL`, defaulting to localhost:4000
 * so `npm run dev` keeps working unchanged.
 */

/**
 * Allowlist of `/api/*` path prefixes that are forwarded to the Express
 * backend. Everything else under `/api/*` is owned by Nitro itself and
 * handled by `frontend/server/api/**`.
 *
 * Per W2b API contract v2: every cycle/task path now lives under
 * `/api/cycles`. The previous `/api/tasks` legacy endpoints (createMonth /
 * finishMonth / setCurrentMonth via taskRoutes.js) were removed in A-BE-1
 * and B-BE-3 on the backend, so the proxy allowlist shrunk to just the
 * cycles namespace.
 *
 * | Prefix         | Owner    | Why                                                  |
 * |----------------|----------|------------------------------------------------------|
 * | `/api/cycles`  | Express  | Cycle CRUD + persistence (Mongo). See                |
 * |                |          | `orchestration-ctx/decisions/api-contract-v2.md`.    |
 * | `/api/klipy/*` | Nitro    | GIF search + trending — server-side only, in Nitro   |
 * | `/api/health`  | Nitro    | Lightweight health endpoint for compose healthchecks |
 *
 * Anything outside these prefixes under `/api/*` falls through and Nitro
 * returns 404. To route a new path through Express, add the prefix here;
 * to make Nitro own a path, just add the route under `frontend/server/api/`
 * and it will be picked up automatically (this middleware never sees it
 * unless the prefix matches).
 *
 * Keep this list tight — every entry is a path the browser can ask Nitro
 * to relay to the backend, so widening it is a security-relevant change.
 */
export const PROXIED_API_PREFIXES = ["/api/cycles"] as const;

function shouldProxy(pathname: string): boolean {
  return PROXIED_API_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export default defineEventHandler((event) => {
  const pathname = event.path.split("?")[0];
  if (shouldProxy(pathname)) {
    const backendUrl = process.env.BACKEND_URL || "http://localhost:4000";
    return proxyRequest(event, `${backendUrl}${event.path}`);
  }
});