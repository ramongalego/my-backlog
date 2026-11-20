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

/**
 * What a field's name holds when its value is not for an error report, read
 * without case or punctuation: `access_token`, `newEmail`, `notes`, `steam_id`
 * and `user_id` as much as the plain words.
 */
const SENSITIVE_KEY_PARTS = [
  'password',
  'token',
  'secret',
  'apikey',
  'authorization',
  'cookie',
  'email',
  'note',
  'steamid',
  'userid',
];

const isSensitiveKey = (key: string) => {
  const plain = key.toLowerCase().replace(/[^a-z0-9]/g, '');
  return SENSITIVE_KEY_PARTS.some((part) => plain.includes(part));
};

/** An email address anywhere in a text (an auth error quotes the one it refused). */
const EMAIL = /[\w.+-]+@[\w-]+(\.[\w-]+)+/g;
const withoutEmails = (text: string) => text.replace(EMAIL, FILTERED);

/** Whose page it was: a profile's username, a share page's unguessable id. */
const WHOSE_PAGE: [RegExp, string][] = [
  [/\/u\/[^/]+/, '/u/[username]'],
  [/\/(share|api\/og)\/completion\/[^/]+/, '/$1/completion/[id]'],
];

/**
 * A URL as an error report may hold it: without its query string or fragment,
 * which can carry a token (a sign-in code, OAuth state), and without whose
 * page it was.
 */
function safeUrl(url: string): string {
  const cut = url.search(/[?#]/);
  const path = cut === -1 ? url : url.slice(0, cut);
  return WHOSE_PAGE.reduce((made, [whose, masked]) => made.replace(whose, masked), path);
}

function scrubHeaders<T extends Record<string, string> | undefined>(headers: T): T {
  if (!headers) return headers;
  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => {
      const name = key.toLowerCase();
      if (SENSITIVE_HEADERS.has(name)) return [key, FILTERED];
      // The page the request came from is a URL like any other.
      return [key, name === 'referer' ? safeUrl(value) : value];
    }),
  ) as T;
}

function scrubValue(value: unknown): unknown {
  if (typeof value === 'string') return withoutEmails(value);
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(scrubValue);
  // A database error's `details` quotes the row it failed on ("Failing row
  // contains (…)", "Key (user_id, app_id)=(…)"): its code and message say
  // what went wrong without it.
  const databaseError = 'code' in value && 'message' in value;
  return Object.fromEntries(
    Object.entries(value).map(([key, v]) => [
      key,
      isSensitiveKey(key) || (databaseError && key === 'details' && typeof v === 'string')
        ? FILTERED
        : scrubValue(v),
    ]),
  );
}

/** A breadcrumb's addresses: a request's `url`, a navigation's `from` and `to`. */
function scrubCrumbData(data: Record<string, unknown>): Record<string, unknown> {
  const made = { ...data };
  for (const key of ['url', 'from', 'to']) {
    const address = made[key];
    if (typeof address === 'string') made[key] = safeUrl(address);
  }
  return made;
}

/**
 * Takes out what Sentry's `sendDefaultPii: false` still lets through: auth and
 * IP headers, request bodies, query strings, whose page it was (a username, a
 * share page's id), the browser's language and time zone, email addresses in
 * the error's own words, and sensitive fields anywhere in what was logged
 * with it.
 */
export function scrubEvent(event: ErrorEvent): ErrorEvent {
  if (event.request) {
    event.request = {
      ...event.request,
      url: event.request.url && safeUrl(event.request.url),
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
  if (typeof event.message === 'string') event.message = withoutEmails(event.message);
  if (typeof event.transaction === 'string') event.transaction = safeUrl(event.transaction);
  if (event.exception?.values) {
    event.exception = {
      ...event.exception,
      values: event.exception.values.map((one) =>
        typeof one.value === 'string' ? { ...one, value: withoutEmails(one.value) } : one,
      ),
    };
  }
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((crumb) =>
      crumb.data ? { ...crumb, data: scrubCrumbData(crumb.data) } : crumb,
    );
  }
  return event;
}
