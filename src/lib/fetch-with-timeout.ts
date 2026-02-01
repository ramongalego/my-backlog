export class FetchTimeoutError extends Error {
  constructor(url: string, timeoutMs: number) {
    super(`Request to ${url} timed out after ${timeoutMs}ms`);
    this.name = "FetchTimeoutError";
  }
}

export async function fetchWithTimeout(
  url: string | URL,
  options: RequestInit = {},
  timeoutMs: number
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
    if (error instanceof Error && error.name === "AbortError") {
      throw new FetchTimeoutError(url.toString(), timeoutMs);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

// Timeout constants for different APIs
export const TIMEOUTS = {
  STEAM_API: 10000,       // 10 seconds
  STEAM_STORE: 15000,     // 15 seconds
  HLTB: 10000,            // 10 seconds
} as const;
