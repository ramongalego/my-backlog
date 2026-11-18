export class FetchTimeoutError extends Error {
  constructor(url: string, timeoutMs: number) {
    // Query strings are dropped: Steam API URLs carry the API key there, and
    // this message ends up in logs.
    super(`Request to ${url.split('?')[0]} timed out after ${timeoutMs}ms`);
    this.name = 'FetchTimeoutError';
  }
}

export async function fetchWithTimeout(
  url: string | URL,
  options: RequestInit = {},
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new FetchTimeoutError(url.toString(), timeoutMs);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

// In milliseconds.
export const TIMEOUTS = {
  STEAM_API: 10000,
  STEAM_STORE: 15000,
  HLTB: 10000,
} as const;
