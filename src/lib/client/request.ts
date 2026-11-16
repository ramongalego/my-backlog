// How the Profile page's settings call the app's API from the browser: one
// request that never throws, so every helper built on it says what happened in
// the same way, with a message the page can show as is.

/** What went wrong, for the player, and the form field it's about when there is one. */
interface ApiFailure<Field extends string = string> {
  ok: false;
  error: string;
  field?: Field;
}

/** The server's answer, or why there isn't one. */
export type ApiResult<T = object, Field extends string = string> =
  ({ ok: true } & T) | ApiFailure<Field>;

const OFFLINE = "Couldn't reach MyBacklog. Check your connection and try again.";

/** A JSON body for `apiRequest`. */
export function json(method: 'POST' | 'PUT', body: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

/**
 * Calls the app's API. A request that can't be sent (offline) and one stopped
 * by the app's own rate limit, which says only "Too many requests", get
 * words of their own; anything else is the server's message, or `failed`.
 */
export async function apiRequest<T = object, Field extends string = string>(
  url: string,
  init: RequestInit,
  messages: {
    /** When the server gave no message of its own. */
    failed: string;
    /** When the app's rate limit stops it: how long to wait. */
    tooMany: string;
  },
): Promise<ApiResult<T, Field>> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    return { ok: false, error: OFFLINE };
  }
  const data = await res.json().catch(() => null);
  if (res.ok) return { ok: true, ...(data as T) };
  // Supabase's own limits come with a message that says more; keep those.
  if (res.status === 429 && (!data?.error || data.error === 'Too many requests')) {
    return { ok: false, error: messages.tooMany };
  }
  return { ok: false, error: data?.error ?? messages.failed, field: data?.field };
}
