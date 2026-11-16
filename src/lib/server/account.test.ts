/**
 * @jest-environment node
 */
import { createClient } from '@supabase/supabase-js';
import { checkPassword, passwordCheckRefusal } from '@/lib/server/account';

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
