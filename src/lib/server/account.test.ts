/**
 * @jest-environment node
 */
import { createClient } from '@supabase/supabase-js';
import { isCurrentPassword } from '@/lib/server/account';

const signIn = jest.fn();
const signOut = jest.fn(async () => ({ error: null }));
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({ auth: { signInWithPassword: signIn, signOut } })),
}));

beforeEach(() => jest.clearAllMocks());

it("checks a password on a client that keeps nothing, leaving the player's session alone", async () => {
  signIn.mockResolvedValue({ data: { session: { access_token: 't' } }, error: null });
  expect(await isCurrentPassword('player@example.com', 'Right-pass1')).toBe(true);

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

it('is false for a wrong password, with nothing to sign out', async () => {
  signIn.mockResolvedValue({ data: { session: null }, error: { message: 'Invalid' } });
  expect(await isCurrentPassword('player@example.com', 'wrong')).toBe(false);
  expect(signOut).not.toHaveBeenCalled();
});
