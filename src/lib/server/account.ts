import 'server-only';
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/env';
import { signedUpWithPassword } from '@/lib/account/sign-in';
import { loadHasPassword } from '@/lib/data/loaders';

/**
 * Whether the signed-in player's account has a password: one made by signing
 * in with Google or Discord has none, and can't be asked for it. The database
 * says (`account_has_password`); if it can't be asked, an account made with a
 * password counts as having one, so nothing a password guards is opened by a
 * failed lookup.
 */
export async function accountHasPassword(supabase: SupabaseClient, user: User): Promise<boolean> {
  return (await loadHasPassword(supabase)) ?? signedUpWithPassword(user);
}

/** What checking a password found: it's right, it's wrong, or it couldn't be checked. */
export type PasswordCheck = 'right' | 'wrong' | 'unavailable';

/**
 * Whether this is the account's password, checked by signing in with it on a
 * client of its own that keeps nothing: the player's own session (in their
 * cookies) is left as it is. The session the check makes is ended at once, so
 * it doesn't linger as another signed-in device.
 *
 * Only Supabase refusing the credentials is "wrong". Supabase being down, or
 * limiting sign-ins, is "unavailable": the player typed nothing wrong and
 * shouldn't be told they did.
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

/** What a route answers when the password given isn't right, or couldn't be checked. */
export function passwordCheckRefusal(
  check: Exclude<PasswordCheck, 'right'>,
  wrong: { error: string; field: AccountRefusal['field'] },
): AccountRefusal {
  return check === 'wrong'
    ? { status: 400, ...wrong }
    : { status: 503, error: "Couldn't check your password right now. Please try again." };
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
    // Supabase's own check of the current password ("Require current password
    // when updating"). It was checked just before, so this is a rare race.
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
