import 'server-only';
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/env';
import { signedUpWithPassword } from '@/lib/account/sign-in';
import { loadHasPassword } from '@/lib/data/loaders';

/**
 * An account made with Google or Discord has none. If the database can't be
 * asked, one made with a password counts as having one, so a failed lookup
 * opens nothing a password guards.
 */
export async function accountHasPassword(supabase: SupabaseClient, user: User): Promise<boolean> {
  return (await loadHasPassword(supabase)) ?? signedUpWithPassword(user);
}

export type PasswordCheck = 'right' | 'wrong' | 'unavailable';

/**
 * Signs in on a client that keeps nothing, so the player's own session is left
 * alone, and ends that session at once so it doesn't linger as another device.
 * Supabase down or limiting sign-ins is "unavailable": the player typed
 * nothing wrong.
 */
export async function checkPassword(email: string, password: string): Promise<PasswordCheck> {
  const check = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await check.auth.signInWithPassword({ email, password });
  if (error) {
    if (error.code === 'invalid_credentials' || error.status === 400) return 'wrong';
    console.error('Checking the password failed:', error);
    return 'unavailable';
  }
  if (!data.session) return 'wrong';
  await check.auth.signOut({ scope: 'local' }).catch(() => {});
  return 'right';
}

export function passwordCheckRefusal(
  check: Exclude<PasswordCheck, 'right'>,
  wrong: { error: string; field: AccountRefusal['field'] },
): AccountRefusal {
  return check === 'wrong'
    ? { status: 400, ...wrong }
    : { status: 503, error: "Couldn't check your password right now. Please try again." };
}

export interface AccountRefusal {
  status: number;
  error: string;
  field?: 'currentPassword' | 'password' | 'email';
}

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
    // Supabase's "Require current password when updating". It was checked just
    // before, so this is a rare race.
    case 'current_password_invalid':
    case 'current_password_required':
      return {
        status: 400,
        error: "That isn't your current password",
        field: 'currentPassword',
      };
    case 'reauthentication_needed':
      return {
        status: 400,
        error: 'For your security, sign out and sign back in, then try again.',
      };
    default:
      return { status: 500, error: "Couldn't change your password. Please try again." };
  }
}

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
