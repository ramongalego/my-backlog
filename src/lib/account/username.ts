// The name in a profile's address. The database holds the same rule
// (profiles_username_format in supabase/schema.sql) and decides what's taken
// or reserved (claim_username); this is the rule worded for the player.

const USERNAME_MIN = 3;
const USERNAME_MAX = 20;

/** Beside the field, before anything is typed. */
export const USERNAME_HINT = `${USERNAME_MIN} to ${USERNAME_MAX} characters: letters, numbers, - and _`;

/** As it's saved: capitals are the same username, so they're lowered rather than refused. */
export function cleanUsername(typed: string): string {
  return typed.trim().toLowerCase();
}

/** What's wrong with a cleaned username, or null when it could be one. */
export function usernameProblem(username: string): string | null {
  if (!username) return 'Enter a username';
  if (!/^[a-z0-9_-]*$/.test(username)) return 'Use only letters, numbers, - and _';
  if (username.length < USERNAME_MIN) return `Use at least ${USERNAME_MIN} characters`;
  if (username.length > USERNAME_MAX) return `Keep it to ${USERNAME_MAX} characters`;
  if (!/[a-z0-9]/.test(username)) return 'Add at least one letter or number';
  return null;
}
