import type { ErrorEvent } from '@sentry/nextjs';

// Sentry's `sendDefaultPii: false` already drops IP/cookies, but a Sentry event
// also carries `request.data`, `request.headers`, breadcrumbs, and extra tags.
// This scrubber strips known-sensitive headers and redacts request bodies that
// contain auth material or user input we'd rather not persist off-box.
const REDACTED = '[Filtered]';

const SENSITIVE_HEADER_NAMES = new Set(
  [
    'authorization',
    'cookie',
    'set-cookie',
    'x-api-key',
    'x-supabase-auth',
    'x-vercel-forwarded-for',
    'x-forwarded-for',
    'x-real-ip',
  ].map((h) => h.toLowerCase()),
);

// Keys in request bodies / extras that should never be persisted to Sentry.
const SENSITIVE_BODY_KEYS = new Set(
  ['password', 'token', 'secret', 'apiKey', 'api_key', 'authorization', 'email'].map((k) =>
    k.toLowerCase(),
  ),
);

function scrubHeaders(
  headers: Record<string, string | string[] | undefined> | undefined,
): Record<string, string | string[] | undefined> | undefined {
  if (!headers) return headers;
  const out: Record<string, string | string[] | undefined> = {};
  for (const [key, value] of Object.entries(headers)) {
    out[key] = SENSITIVE_HEADER_NAMES.has(key.toLowerCase()) ? REDACTED : value;
  }
  return out;
}

function scrubObject(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(scrubObject);
  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    out[key] = SENSITIVE_BODY_KEYS.has(key.toLowerCase()) ? REDACTED : scrubObject(v);
  }
  return out;
}

export function scrubEvent(event: ErrorEvent): ErrorEvent | null {
  if (event.request) {
    event.request = {
      ...event.request,
      headers: scrubHeaders(event.request.headers) as typeof event.request.headers,
      data: scrubObject(event.request.data),
      // The query string can carry tokens (e.g. OpenID state). Drop it wholesale
      // rather than try to parse it — the URL alone is enough signal.
      query_string: event.request.query_string ? REDACTED : event.request.query_string,
    };
  }

  if (event.extra) {
    event.extra = scrubObject(event.extra) as typeof event.extra;
  }

  return event;
}
