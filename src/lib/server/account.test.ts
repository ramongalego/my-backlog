/**
 * @jest-environment node
 */
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { accountHasPassword, checkPassword, passwordCheckRefusal } from '@/lib/server/account';

const signIn = jest.fn();
const signOut = jest.fn(async () => ({ error: null }));
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({ auth: { signInWithPassword: signIn, signOut } })),
}));

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

it("checks a password on a client that keeps nothing, leaving the player's session alone", async () => {
  signIn.mockResolvedValue({ data: { session: { access_token: 't' } }, error: null });
  expect(await checkPassword('player@example.com', 'Right-pass1')).toBe('right');

  expect(signIn).toHaveBeenCalledWith({ email: 'player@example.com', password: 'Right-pass1' });
  const [, , options] = jest.mocked(createClient).mock.calls[0] as unknown as [
    string,
    string,
    { auth: { persistSession: boolean } },
  ];
  expect(options.auth.persistSession).toBe(false);
  // The session the check made doesn't stay behind as another device.
  expect(signOut).toHaveBeenCalledWith({ scope: 'local' });
});

it('is wrong when Supabase refuses the credentials, with nothing to sign out', async () => {
  signIn.mockResolvedValue({
    data: { session: null },
    error: { code: 'invalid_credentials', status: 400, message: 'Invalid login credentials' },
  });
  expect(await checkPassword('player@example.com', 'wrong')).toBe('wrong');
  expect(signOut).not.toHaveBeenCalled();
});

it('is unavailable, not wrong, when Supabase is down or limiting sign-ins: they typed nothing wrong', async () => {
  signIn.mockResolvedValue({
    data: { session: null },
    error: { code: 'over_request_rate_limit', status: 429, message: 'Too many requests' },
  });
  expect(await checkPassword('player@example.com', 'Right-pass1')).toBe('unavailable');

  signIn.mockResolvedValue({ data: { session: null }, error: { status: 503, message: 'down' } });
  expect(await checkPassword('player@example.com', 'Right-pass1')).toBe('unavailable');
});

describe('passwordCheckRefusal', () => {
  const wrong = { error: "That isn't your password", field: 'password' as const };

  it('says the password is wrong, on its field', () => {
    expect(passwordCheckRefusal('wrong', wrong)).toEqual({ status: 400, ...wrong });
  });

  it("says it couldn't be checked, without blaming a field", () => {
    expect(passwordCheckRefusal('unavailable', wrong)).toEqual({
      status: 503,
      error: "Couldn't check your password right now. Please try again.",
    });
  });
});

describe('accountHasPassword', () => {
  const asked = (answer: { data: unknown; error: unknown }) =>
    ({ rpc: jest.fn(async () => answer) }) as unknown as SupabaseClient;
  const madeWith = (...providers: string[]) =>
    ({ identities: providers.map((provider) => ({ provider })) }) as unknown as User;

  it("is the database's answer, whatever the account was made with", async () => {
    // Made with Google, then set a password by the reset link.
    expect(await accountHasPassword(asked({ data: true, error: null }), madeWith('google'))).toBe(
      true,
    );
    expect(await accountHasPassword(asked({ data: false, error: null }), madeWith('google'))).toBe(
      false,
    );
    const supabase = asked({ data: true, error: null });
    await accountHasPassword(supabase, madeWith('email'));
    expect(supabase.rpc).toHaveBeenCalledWith('account_has_password');
  });

  it('goes by how the account was made when the database cannot be asked', async () => {
    const down = { data: null, error: { message: 'function not found' } };
    // Never "no password" for an account made with one: nothing it guards opens.
    expect(await accountHasPassword(asked(down), madeWith('email'))).toBe(true);
    expect(await accountHasPassword(asked(down), madeWith('email', 'google'))).toBe(true);
    expect(await accountHasPassword(asked(down), madeWith('discord'))).toBe(false);
  });
});
