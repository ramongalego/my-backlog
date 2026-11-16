// How an account signs in: with a password, with Google or Discord, or both.
// Supabase links a Google or Discord sign-in to the account that has the same
// email, so one account can have several ways in.

/** The other accounts a player can sign in with, in the order they're offered. */
export const SIGN_IN_PROVIDERS = [
  { id: 'google', name: 'Google' },
  { id: 'discord', name: 'Discord' },
] as const;

export type SignInProvider = (typeof SIGN_IN_PROVIDERS)[number]['id'];

/** The part of a Supabase user that says how it signs in. */
interface SignInUser {
  identities?: { provider: string }[] | null;
}

/** The Google and Discord accounts this one signs in with, in the order they're offered. */
export function linkedProviders(user: SignInUser | null | undefined): SignInProvider[] {
  const linked = new Set(user?.identities?.map((identity) => identity.provider));
  return SIGN_IN_PROVIDERS.filter((provider) => linked.has(provider.id)).map(
    (provider) => provider.id,
  );
}

/**
 * Whether the account was made with an email and a password. The stand-in for
 * "has a password" when the database can't be asked (`account_has_password`):
 * right for every account but one made with Google or Discord that set a
 * password later, which this still counts as having none.
 */
export function signedUpWithPassword(user: SignInUser | null | undefined): boolean {
  return !!user?.identities?.some((identity) => identity.provider === 'email');
}

/**
 * What an account with no password types to delete itself, where one with a
 * password types that. It only stops a slip, as it can't be a secret.
 */
export const DELETE_CONFIRM_WORD = 'delete';

/** What's said when it wasn't typed, under the field that asks for it. */
export const DELETE_CONFIRM_ERROR = `Enter the word "${DELETE_CONFIRM_WORD}"`;

/** Whether what was typed is that word, however it was capitalized. */
export function confirmsDelete(typed: string | null | undefined): boolean {
  return typed?.trim().toLowerCase() === DELETE_CONFIRM_WORD;
}

/** "Google", "Google or Discord": the accounts to sign in with, as a sentence names them. */
export function providerNames(providers: readonly SignInProvider[]): string {
  const names = SIGN_IN_PROVIDERS.filter((provider) => providers.includes(provider.id)).map(
    (provider) => provider.name,
  );
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`;
}
