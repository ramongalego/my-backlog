import type { SupabaseClient } from '@supabase/supabase-js';
import { isProtectedPath } from '@/lib/routes';

// A session that's gone on Supabase's side while this browser still holds its
// cookies: the account was deleted, or signed out, from another device (or by
// changing the password on one, which signs the others out).
//
// The proxy lets a page through on the cookie alone: it checks the cookie's
// signature rather than asking Supabase on every navigation, and a cookie
// stays good for up to an hour after its session is gone. So the browser can
// be on a signed-in page, with the header saying it's signed out and nothing
// loading, and the landing page sending it straight back. When the browser
// asks Supabase who it is and the answer is "nobody", it clears the cookies
// and leaves for the landing page.

interface AuthFailure {
  name?: string;
  status?: number;
}

/** When this browser last left a dead session, so it does it once, not in a loop. */
const LEFT_AT = 'left_dead_session_at';
const LEAVE_ONCE_MS = 10_000;

/**
 * Whether Supabase answered that there's no such session. Not when it
 * couldn't be asked (offline, down, limited): nothing is known then, and
 * nobody should be signed out for a dropped connection.
 */
export function sessionIsGone(error: AuthFailure): boolean {
  if (error.name === 'AuthRetryableFetchError') return false;
  if (!error.status || error.status >= 500 || error.status === 429) return false;
  return true;
}

/**
 * Clears what's left of a session Supabase no longer has, and leaves a
 * signed-in page for the landing page. Does nothing for a failure that says
 * nothing about the session, or on a page that doesn't need one.
 */
export async function leaveDeadSession(
  supabase: Pick<SupabaseClient, 'auth'>,
  error: AuthFailure,
  page: { pathname: string; leave: () => void } = {
    pathname: window.location.pathname,
    // A full page load, not the router: the cookies just changed, and the
    // proxy has to see that to serve the landing page.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    leave: () => window.location.assign('/'),
  },
): Promise<void> {
  if (!sessionIsGone(error)) return;
  // A session that's missing has been cleared already (by Supabase's client,
  // when the server said so). An account that's gone hasn't: its cookies are
  // still here, and would have the proxy send the browser straight back.
  if (error.name !== 'AuthSessionMissingError') {
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
  }
  if (!isProtectedPath(page.pathname)) return;
  try {
    // Once: if the cookies somehow survived, leaving again would loop.
    const last = Number(sessionStorage.getItem(LEFT_AT));
    if (Date.now() - last < LEAVE_ONCE_MS) return;
    sessionStorage.setItem(LEFT_AT, String(Date.now()));
  } catch {
    // No session storage (private mode): leave anyway.
  }
  page.leave();
}
