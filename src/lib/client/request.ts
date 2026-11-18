// These never throw, so every helper built on them says what happened the same
// way, with a message the page can show as is.

/** What went wrong, for the player, and the form field it's about when there is one. */
interface ApiFailure<Field extends string = string> {
  ok: false;
  error: string;
  field?: Field;
}

export type ApiResult<T = object, Field extends string = string> =
  ({ ok: true } & T) | ApiFailure<Field>;

const OFFLINE = "Couldn't reach MyBacklog. Check your connection and try again.";

export function json(method: 'POST' | 'PUT', body: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

/**
 * Offline and the app's own rate limit (which says only "Too many requests") get
 * words of their own; anything else is the server's message, or `failed`.
 */
export async function apiRequest<T = object, Field extends string = string>(
  url: string,
  init: RequestInit,
  messages: Messages,
): Promise<ApiResult<T, Field>> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    return { ok: false, error: OFFLINE };
  }
  const data = await res.json().catch(() => null);
  if (res.ok) return { ok: true, ...(data as T) };
  return failure(res.status, data, messages);
}

/** A failure is worded as `apiRequest` words one. */
export async function apiDownload(
  url: string,
  messages: Messages,
): Promise<ApiResult<{ blob: Blob; fileName: string | null }>> {
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    return { ok: false, error: OFFLINE };
  }
  if (!res.ok) return failure(res.status, await res.json().catch(() => null), messages);
  try {
    const fileName = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '');
    return { ok: true, blob: await res.blob(), fileName: fileName?.[1] ?? null };
  } catch {
    // The connection dropped partway through the file.
    return { ok: false, error: OFFLINE };
  }
}

interface Messages {
  /** When the server gave no message of its own. */
  failed: string;
  /** When the app's rate limit stops it: how long to wait. */
  tooMany: string;
}

function failure<Field extends string>(
  status: number,
  data: { error?: string; field?: Field } | null,
  messages: Messages,
): ApiFailure<Field> {
  // Supabase's own limits come with a message that says more; keep those.
  if (status === 429 && (!data?.error || data.error === 'Too many requests')) {
    return { ok: false, error: messages.tooMany };
  }
  return { ok: false, error: data?.error ?? messages.failed, field: data?.field };
}
