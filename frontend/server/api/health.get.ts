/**
 * UB-16: lightweight Nitro health route for compose healthchecks.
 * Does not probe backend — backend readiness is gated via depends_on: service_healthy.
 */
export default defineEventHandler(() => {
  return { status: "ok" };
});
