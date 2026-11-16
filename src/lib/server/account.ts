import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/env';

/**
 * Whether this is the account's password, checked by signing in with it on a
 * client of its own that keeps nothing: the player's own session (in their
 * cookies) is left as it is. The session the check makes is ended at once, so
 * it doesn't linger as another signed-in device.
 */
export async function isCurrentPassword(email: string, password: string): Promise<boolean> {
  const check = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await check.auth.signInWithPassword({ email, password });
  if (error || !data.session) return false;
  await check.auth.signOut({ scope: 'local' }).catch(() => {});
  return true;
}

/** A Supabase Auth refusal, by its code, as the player reads it and the field it's about. */
export interface AccountRefusal {
  status: number;
  error: string;
  field?: 'currentPassword' | 'password' | 'email';
}

/** Why Supabase wouldn't take a new password. */
export function passwordRefusal(code: string | undefined, message: string): AccountRefusal {
  switch (code) {
    case 'same_password':
      return {
        status: 400,
        error: "That's your current password. Pick a new one",
        field: 'password',
      };
    case 'weak_password':
      return { status: 400, error: message, field: 'password' };
    case 'reauthentication_needed':
      return {
        status: 400,
        error: 'For your security, sign out and sign back in, then try again.',
      };
    default:
      return { status: 500, error: "Couldn't change your password. Please try again." };
  }
}

/** Why Supabase wouldn't take a new email. */
export function emailRefusal(code: string | undefined): AccountRefusal {
  switch (code) {
    case 'email_exists':
      return { status: 400, error: 'That email already has an account', field: 'email' };
    case 'email_address_invalid':
      return { status: 400, error: 'Please enter a valid email address', field: 'email' };
    case 'over_email_send_rate_limit':
      return {
        status: 429,
        error: "We can't send another email right now. Please try again in an hour.",
      };
    default:
      return { status: 500, error: "Couldn't change your email. Please try again." };
  }
}
