/**
 * Klipy GIF API client (same-origin Nitro proxy).
 * Documentation: https://docs.klipy.com/gifs-api
 *
 * The API key lives only on the server (`KLIPY_API_KEY`).
 * Browser code must call `/api/klipy/...` — never embed secrets here.
 */

export interface KlipyGif {
  id: string;
  slug: string;
  title: string;
  file: {
    hd?: KlipyGifFormat;
    md?: KlipyGifFormat;
    sm?: KlipyGifFormat;
    xs?: KlipyGifFormat;
  };
}

export interface KlipyGifFormat {
  gif?: KlipyGifFile;
  webp?: KlipyGifFile;
  jpg?: KlipyGifFile;
  mp4?: KlipyGifFile;
  webm?: KlipyGifFile;
}

export interface KlipyGifFile {
  url: string;
  width: number;
  height: number;
  size: number;
}

export interface KlipySearchResponse {
  result: boolean;
  data: {
    data: KlipyGif[];
    current_page: number;
    per_page: number;
    has_next: boolean;
  };
}

/**
 * Generate a unique customer ID for Klipy API
 * This is required by Klipy API for tracking purposes
 */
function getCustomerId(): string {
  // Try to get from localStorage, or generate a new one
  if (typeof window !== "undefined") {
    let customerId = localStorage.getItem("klipy_customer_id");
    if (!customerId) {
      customerId = `pixelpaladin_${Math.random().toString(36).slice(2, 11)}_${Date.now()}`;
      localStorage.setItem("klipy_customer_id", customerId);
    }
    return customerId;
  }
  // Fallback for SSR
  return `pixelpaladin_${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Search for GIFs by query via same-origin Nitro proxy
 */
export async function searchGifs(
  query: string,
  page: number = 1,
  perPage: number = 24
): Promise<KlipySearchResponse> {
  const customerId = getCustomerId();
  const params = new URLSearchParams({
    q: query,
    customer_id: customerId,
    page: String(page),
    per_page: String(perPage),
  });
  const response = await fetch(`/api/klipy/search?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Klipy API error: ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Get trending GIFs via same-origin Nitro proxy
 */
export async function getTrendingGifs(
  page: number = 1,
  perPage: number = 24
): Promise<KlipySearchResponse> {
  const customerId = getCustomerId();
  const params = new URLSearchParams({
    customer_id: customerId,
    page: String(page),
    per_page: String(perPage),
  });
  const response = await fetch(`/api/klipy/trending?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Klipy API error: ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Get the best GIF URL for display (prefers small size for task cards)
 */
export function getGifUrl(gif: KlipyGif, size: "xs" | "sm" | "md" | "hd" = "sm"): string {
  const format = gif.file[size];
  if (!format) {
    // Fallback to other sizes
    const fallbackFormat = gif.file.sm || gif.file.xs || gif.file.md || gif.file.hd;
    return fallbackFormat?.gif?.url || fallbackFormat?.webp?.url || "";
  }
  return format.gif?.url || format.webp?.url || "";
}

/**
 * Track GIF share (optional, for analytics) via same-origin Nitro proxy
 */
export async function trackGifShare(slug: string): Promise<void> {
  try {
    await fetch(`/api/klipy/share/${encodeURIComponent(slug)}`, {
      method: "POST",
    });
  } catch (error) {
    console.warn("Failed to track GIF share:", error);
  }
}
