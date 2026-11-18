import type { SupabaseClient } from '@supabase/supabase-js';
import { isProtectedPath } from '@/lib/routes';

// A session deleted or signed out on another device while this browser keeps its
// cookies. The proxy only checks the cookie's signature, which stays good up to
// an hour, so a signed-in page loads nothing and the landing page sends it back.

interface AuthFailure {
  name?: string;
  status?: number;
}

/** When this browser last left a dead session, so it does it once, not in a loop. */
const LEFT_AT = 'left_dead_session_at';
const LEAVE_ONCE_MS = 10_000;

/**
 * False when Supabase couldn't be asked (offline, down, limited): nobody is
 * signed out for a dropped connection.
 */
export function sessionIsGone(error: AuthFailure): boolean {
  if (error.name === 'AuthRetryableFetchError') return false;
  if (!error.status || error.status >= 500 || error.status === 429) return false;
  return true;
}

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
  // Supabase's client already cleared a missing session. A deleted account's
  // cookies are still here, and would have the proxy send the browser back.
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
