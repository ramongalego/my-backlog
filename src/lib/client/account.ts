// Client helpers for the profile's account settings: changing the password
// and the email, deleting the account, unlinking Steam (/api/account/…,
// /api/steam/disconnect), and emailing a password reset link. They never
// throw: each says what happened, with the server's message for the player and
// the form field it's about.

import { createClient } from '@/lib/supabase/client';
import { apiRequest, json, type ApiResult } from './request';

type AccountField = 'currentPassword' | 'password' | 'email';

/** A change to the account: done, or why not. */
export type AccountResult = ApiResult<object, AccountField>;

/** A change of email, once asked for: waiting for its link, or already made. */
export type EmailChangeResult = ApiResult<
  { pendingEmail: string | null; email: string | null },
  AccountField
>;

const FAILED = 'Something went wrong. Please try again.';
/** Guesses at the password share one limit: five tries in 15 minutes. */
const TOO_MANY_TRIES = 'Too many tries. Please wait 15 minutes and try again.';

/** Changes the password, checking the current one first. */
export function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<AccountResult> {
  return apiRequest('/api/account/password', json('POST', { currentPassword, newPassword }), {
    failed: FAILED,
    tooMany: TOO_MANY_TRIES,
  });
}

/** Asks for the email to be changed to this one, with the password to confirm it. */
export function changeEmail(email: string, password: string): Promise<EmailChangeResult> {
  return apiRequest('/api/account/email', json('POST', { email, password }), {
    failed: FAILED,
    tooMany: TOO_MANY_TRIES,
  });
}

/** Deletes the account and everything in it, checking the password first. */
export function deleteAccount(password: string): Promise<AccountResult> {
  return apiRequest('/api/account/delete', json('POST', { password }), {
    failed: FAILED,
    tooMany: TOO_MANY_TRIES,
  });
}

/** Unlinks Steam; its games come out of the library. */
export function disconnectSteam(): Promise<AccountResult> {
  return apiRequest('/api/steam/disconnect', json('POST', {}), {
    failed: "Couldn't disconnect Steam. Please try again.",
    tooMany: 'Too many changes in a row. Try again in a minute.',
  });
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
