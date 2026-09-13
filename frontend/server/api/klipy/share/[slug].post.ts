import { createError, defineEventHandler, getRouterParam } from "h3";

/**
 * Same-origin proxy for Klipy GIF share tracking.
 * Keeps KLIPY_API_KEY server-side only.
 */
export default defineEventHandler(async (event) => {
  const apiKey = process.env.KLIPY_API_KEY;
  if (!apiKey) {
    throw createError({
      statusCode: 500,
      statusMessage: "KLIPY_API_KEY is not configured",
    });
  }

  const slug = getRouterParam(event, "slug");
  if (!slug) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing GIF slug",
    });
  }

  const baseUrl = process.env.KLIPY_BASE_URL || "https://api.klipy.com";
  const url = `${baseUrl}/api/v1/${apiKey}/gifs/share/${encodeURIComponent(slug)}`;

  try {
    const response = await fetch(url, { method: "POST" });
    if (!response.ok) {
      throw createError({
        statusCode: response.status,
        statusMessage: `Klipy API error: ${response.statusText}`,
      });
    }
    // Share tracking may return empty body
    const text = await response.text();
    return text ? JSON.parse(text) : { result: true };
  } catch (error: any) {
    if (error?.statusCode) throw error;
    throw createError({
      statusCode: 502,
      statusMessage: "Failed to reach Klipy share endpoint",
    });
  }
});
