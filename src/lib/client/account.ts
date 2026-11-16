// Client helpers for the profile's account settings: changing the password
// and the email (/api/account/…), and emailing a password reset link. They
// never throw: each says what happened, with the server's message for the
// player and the form field it's about.

import { createClient } from '@/lib/supabase/client';

type AccountField = 'currentPassword' | 'password' | 'email';

export type AccountResult = { ok: true } | { ok: false; error: string; field?: AccountField };

/** A change of email, once asked for: waiting for its link, or already made. */
export type EmailChangeResult =
  | { ok: true; pendingEmail: string | null; email: string | null }
  | { ok: false; error: string; field?: AccountField };

const OFFLINE = "Couldn't reach MyBacklog. Check your connection and try again.";

async function post<T>(
  url: string,
  body: unknown,
  /** What to say when the app's own limit stops it. */
  tooMany: string,
): Promise<({ ok: true } & T) | { ok: false; error: string; field?: AccountField }> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, error: OFFLINE };
  }
  const data = await res.json().catch(() => null);
  if (res.ok) return { ok: true, ...(data as T) };
  // The app's rate limit says only "Too many requests"; Supabase's own say more.
  if (res.status === 429 && (!data?.error || data.error === 'Too many requests')) {
    return { ok: false, error: tooMany };
  }
  return {
    ok: false,
    error: data?.error ?? 'Something went wrong. Please try again.',
    field: data?.field,
  };
}

/** Changes the password, checking the current one first. */
export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<AccountResult> {
  const result = await post<object>(
    '/api/account/password',
    { currentPassword, newPassword },
    'Too many tries. Please wait 15 minutes and try again.',
  );
  return result.ok ? { ok: true } : result;
}

/** Asks for the email to be changed to this one. */
export async function changeEmail(email: string): Promise<EmailChangeResult> {
  return post<{ pendingEmail: string | null; email: string | null }>(
    '/api/account/email',
    { email },
    'Too many changes in a row. Please try again in an hour.',
  );
}

/** Deletes the account and everything in it, checking the password first. */
export async function deleteAccount(password: string): Promise<AccountResult> {
  const result = await post<object>(
    '/api/account/delete',
    { password },
    'Too many tries. Please wait 15 minutes and try again.',
  );
  return result.ok ? { ok: true } : result;
}

/** Unlinks Steam; its games come out of the library. */
export async function disconnectSteam(): Promise<AccountResult> {
  const result = await post<object>(
    '/api/steam/disconnect',
    {},
    'Too many changes in a row. Try again in a minute.',
  );
  return result.ok ? { ok: true } : result;
}

/** Emails a link to set a new password, as Forgot password does when signed out. */
export async function sendPasswordReset(email: string): Promise<boolean> {
  try {
    const { error } = await createClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset-password`,
    });
    return !error;
  } catch {
    return false;
  }
}
