// Supabase links a Google or Discord sign-in to the account with the same email,
// so one account can have several ways in.

/** In the order they're offered. */
export const SIGN_IN_PROVIDERS = [
  { id: 'google', name: 'Google' },
  { id: 'discord', name: 'Discord' },
] as const;

export type SignInProvider = (typeof SIGN_IN_PROVIDERS)[number]['id'];

interface SignInUser {
  identities?: { provider: string }[] | null;
}

/** In the order they're offered. */
export function linkedProviders(user: SignInUser | null | undefined): SignInProvider[] {
  const linked = new Set(user?.identities?.map((identity) => identity.provider));
  return SIGN_IN_PROVIDERS.filter((provider) => linked.has(provider.id)).map(
    (provider) => provider.id,
  );
}

/**
 * Stands in for "has a password" only when `account_has_password` can't be asked:
 * an account made with Google or Discord that set a password later counts as none.
 */
export function signedUpWithPassword(user: SignInUser | null | undefined): boolean {
  return !!user?.identities?.some((identity) => identity.provider === 'email');
}

/** Typed to delete an account with no password. It only stops a slip: it can't be a secret. */
export const DELETE_CONFIRM_WORD = 'delete';

/** What's said when it wasn't typed, under the field that asks for it. */
export const DELETE_CONFIRM_ERROR = `Enter the word "${DELETE_CONFIRM_WORD}"`;

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
