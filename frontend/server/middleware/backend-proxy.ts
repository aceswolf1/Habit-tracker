import { defineEventHandler, proxyRequest } from "h3";

/**
 * Reverse proxy for the Express backend.
 *
 * The browser talks to the Nuxt server on the same origin (`/api/cycles/...`)
 * and this middleware forwards those requests to the backend service. This keeps
 * the backend host/IP out of client code and avoids CORS entirely — essential
 * when the app is served from a NAS and reached from other devices on the LAN.
 *
 * A middleware (rather than a catch-all route) is used so the bare `/api/cycles`
 * list endpoint is matched as well as nested paths like `/api/cycles/:uuid`.
 * Returning a value here ends the request; other paths fall through untouched
 * (e.g. the local `/api/tasks` Nitro endpoint and normal page rendering).
 *
 * Target resolves at runtime from `BACKEND_URL`, defaulting to localhost:4000
 * so `npm run dev` keeps working unchanged.
 */
export default defineEventHandler((event) => {
  const pathname = event.path.split("?")[0];
  if (pathname === "/api/cycles" || pathname.startsWith("/api/cycles/")) {
    const backendUrl = process.env.BACKEND_URL || "http://localhost:4000";
    return proxyRequest(event, `${backendUrl}${event.path}`);
  }
});
