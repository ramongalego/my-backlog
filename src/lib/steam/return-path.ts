// Where connecting Steam goes back to: the page it was started from, so the
// player lands where they were (Profile, Stats) with how it went, instead of
// on Home. Safe to import anywhere: just URL checks.

/** The cookie that carries it through Steam's sign-in and back. */
export const STEAM_RETURN_COOKIE = 'steam_auth_from';

/**
 * A path on this site to go back to, from what the browser sent: only ever
 * one of this site's own pages. "//host" and "/\host" both parse as another
 * site, so it's resolved as a URL and checked, and anything else (another
 * site, the API, nothing at all) is the site's root.
 *
 * A path that resolves to one starting "//" is refused too: "/.//host" and
 * "/x/..//host" are on this site as written, but come out as "//host", which
 * is another site the next time it's read as an address.
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

/** That path with how it went, for the page to say (`?error=`). */
export function withSteamOutcome(path: string, origin: string, error?: string): URL {
  let url = new URL(path, origin);
  // Whatever it was given, the answer is an address on this site.
  if (url.origin !== origin) url = new URL('/', origin);
  if (error) url.searchParams.set('error', error);
  return url;
}
