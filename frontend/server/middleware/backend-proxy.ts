import { defineEventHandler, proxyRequest } from "h3";

/**
 * Reverse proxy for the Express backend.
 *
 * The browser talks to the Nuxt server on the same origin
 * (`/api/cycles/...`, `/api/tasks/...`) and this middleware forwards those
 * requests to the backend service. This keeps the backend host/IP out of
 * client code and avoids CORS entirely — essential when the app is served
 * from a NAS and reached from other devices on the LAN.
 *
 * A middleware (rather than a catch-all route) is used so bare list endpoints
 * (`/api/cycles`, `/api/tasks`) are matched as well as nested paths like
 * `/api/cycles/:uuid`. Returning a value here ends the request; other paths
 * fall through untouched (normal page rendering, future local Nitro routes).
 *
 * `/api/tasks` is proxied to Express (Mongo-backed createMonth / finishMonth /
 * setCurrentMonth). The former Nitro JSON-file handler was removed (UB-01).
 *
 * Target resolves at runtime from `BACKEND_URL`, defaulting to localhost:4000
 * so `npm run dev` keeps working unchanged.
 */
const PROXIED_PREFIXES = ["/api/cycles", "/api/tasks"] as const;

function shouldProxy(pathname: string): boolean {
  return PROXIED_PREFIXES.some(
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
