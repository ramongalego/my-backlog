// Connecting Steam goes back to the page it started from (Profile, Stats), not
// Home. Safe to import anywhere.

/** The cookie that carries it through Steam's sign-in and back. */
export const STEAM_RETURN_COOKIE = 'steam_auth_from';

/**
 * "//host" and "/\host" parse as another site, so the value is resolved and
 * checked; anything else (another site, the API, nothing) is the root. A path
 * resolving to "//host" ("/.//host", "/x/..//host") is refused too: read again
 * as an address, it's another site.
 */
export function steamReturnPath(value: string | null | undefined, origin: string): string {
  if (!value || !value.startsWith('/')) return '/';
  let url: URL;
  try {
    url = new URL(value, origin);
  } catch {
    return '/';
  }
  if (url.origin !== origin || url.pathname.startsWith('//')) return '/';
  if (url.pathname.startsWith('/api/')) return '/';
  // Not a code or message from an earlier try, said again on the way back.
  url.searchParams.delete('error');
  url.searchParams.delete('notice');
  return `${url.pathname}${url.search}`;
}

export function withSteamOutcome(path: string, origin: string, error?: string): URL {
  let url = new URL(path, origin);
  // Whatever it was given, the answer is an address on this site.
  if (url.origin !== origin) url = new URL('/', origin);
  if (error) url.searchParams.set('error', error);
  return url;
}
