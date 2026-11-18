import type { ErrorEvent } from '@sentry/nextjs';

const FILTERED = '[Filtered]';

const SENSITIVE_HEADERS = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'x-supabase-auth',
  'x-vercel-forwarded-for',
  'x-forwarded-for',
  'x-real-ip',
]);

const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'secret',
  'apikey',
  'api_key',
  'authorization',
  'email',
  'note',
]);

function scrubHeaders<T extends Record<string, string> | undefined>(headers: T): T {
  if (!headers) return headers;
  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [
      key,
      SENSITIVE_HEADERS.has(key.toLowerCase()) ? FILTERED : value,
    ]),
  ) as T;
}

function scrubValue(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(scrubValue);
  return Object.fromEntries(
    Object.entries(value).map(([key, v]) => [
      key,
      SENSITIVE_KEYS.has(key.toLowerCase()) ? FILTERED : scrubValue(v),
    ]),
  );
}

/** A URL without its query string, which can carry a token (a sign-in code, OAuth state). */
function withoutQuery(url: string): string {
  const at = url.indexOf('?');
  return at === -1 ? url : url.slice(0, at);
}

/**
 * Takes out what Sentry's `sendDefaultPii: false` still lets through: auth and
 * IP headers, request bodies, query strings, the browser's language and time
 * zone, and sensitive fields anywhere in what was logged with the error.
 */
export function scrubEvent(event: ErrorEvent): ErrorEvent {
  if (event.request) {
    event.request = {
      ...event.request,
      url: event.request.url && withoutQuery(event.request.url),
      headers: scrubHeaders(event.request.headers),
      cookies: undefined,
      data: event.request.data === undefined ? undefined : FILTERED,
      query_string: event.request.query_string ? FILTERED : event.request.query_string,
    };
  }
  if (event.contexts?.culture) {
    event.contexts = { ...event.contexts };
    delete event.contexts.culture;
  }
  if (event.extra) event.extra = scrubValue(event.extra) as typeof event.extra;
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((crumb) =>
      typeof crumb.data?.url === 'string'
        ? { ...crumb, data: { ...crumb.data, url: withoutQuery(crumb.data.url) } }
        : crumb,
    );
  }
  return event;
}
