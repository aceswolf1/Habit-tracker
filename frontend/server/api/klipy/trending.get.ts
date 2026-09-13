import { createError, defineEventHandler, getQuery } from "h3";

/**
 * Same-origin proxy for Klipy trending GIFs.
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

  const query = getQuery(event);
  const page = typeof query.page === "string" ? query.page : "1";
  const perPage = typeof query.per_page === "string" ? query.per_page : "24";
  const customerId =
    typeof query.customer_id === "string"
      ? query.customer_id
      : `pixelpaladin_${Date.now()}`;

  const baseUrl = process.env.KLIPY_BASE_URL || "https://api.klipy.com";
  const url =
    `${baseUrl}/api/v1/${apiKey}/gifs/trending` +
    `?customer_id=${encodeURIComponent(customerId)}` +
    `&page=${encodeURIComponent(page)}` +
    `&per_page=${encodeURIComponent(perPage)}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw createError({
      statusCode: response.status,
      statusMessage: `Klipy API error: ${response.statusText}`,
    });
  }

  return await response.json();
});
