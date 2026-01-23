/**
 * Klipy GIF API Service
 * Documentation: https://docs.klipy.com/gifs-api
 */

const KLIPY_API_KEY = 'yROS4WFGLe6QDzOgOlkzbq0bK9JHM3WMGC0CpFSd0QsYNPPlAgskJ5jAriIrSKJ8';
const BASE_URL = 'https://api.klipy.com';

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
  if (typeof window !== 'undefined') {
    let customerId = localStorage.getItem('klipy_customer_id');
    if (!customerId) {
      customerId = `pixelpaladin_${Math.random().toString(36).slice(2, 11)}_${Date.now()}`;
      localStorage.setItem('klipy_customer_id', customerId);
    }
    return customerId;
  }
  // Fallback for SSR
  return `pixelpaladin_${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Search for GIFs by query
 */
export async function searchGifs(
  query: string,
  page: number = 1,
  perPage: number = 24
): Promise<KlipySearchResponse> {
  const customerId = getCustomerId();
  const url = `${BASE_URL}/api/v1/${KLIPY_API_KEY}/gifs/search?q=${encodeURIComponent(
    query
  )}&customer_id=${encodeURIComponent(customerId)}&page=${page}&per_page=${perPage}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Klipy API error: ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Get trending GIFs
 */
export async function getTrendingGifs(
  page: number = 1,
  perPage: number = 24
): Promise<KlipySearchResponse> {
  const customerId = getCustomerId();
  const url = `${BASE_URL}/api/v1/${KLIPY_API_KEY}/gifs/trending?customer_id=${encodeURIComponent(
    customerId
  )}&page=${page}&per_page=${perPage}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Klipy API error: ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Get the best GIF URL for display (prefers small size for task cards)
 */
export function getGifUrl(gif: KlipyGif, size: 'xs' | 'sm' | 'md' | 'hd' = 'sm'): string {
  const format = gif.file[size];
  if (!format) {
    // Fallback to other sizes
    const fallbackFormat = gif.file.sm || gif.file.xs || gif.file.md || gif.file.hd;
    return fallbackFormat?.gif?.url || fallbackFormat?.webp?.url || '';
  }
  return format.gif?.url || format.webp?.url || '';
}

/**
 * Track GIF share (optional, for analytics)
 */
export async function trackGifShare(slug: string): Promise<void> {
  try {
    const url = `${BASE_URL}/api/v1/${KLIPY_API_KEY}/gifs/share/${slug}`;
    await fetch(url, { method: 'POST' });
  } catch (error) {
    console.warn('Failed to track GIF share:', error);
  }
}
