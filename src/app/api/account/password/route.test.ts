/**
 * @jest-environment node
 */
import type { NextRequest } from 'next/server';
import { POST } from '@/app/api/account/password/route';
import { checkPassword } from '@/lib/server/account';

let user: { id: string; email?: string } | null = { id: 'user-1', email: 'player@example.com' };
let limited = false;
let updateError: { code?: string; message: string } | null = null;
const updates: unknown[] = [];
const signOuts: unknown[] = [];

jest.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user } }),
      updateUser: async (attributes: unknown) => {
        updates.push(attributes);
        return { error: updateError };
      },
      signOut: async (options: unknown) => {
        signOuts.push(options);
        return { error: null };
      },
    },
  }),
}));
jest.mock('@/lib/server/rate-limit', () => ({
  ...jest.requireActual('@/lib/server/rate-limit'),
  checkSharedRateLimit: jest.fn(async () => ({
    success: !limited,
    limit: 5,
    remaining: 0,
    resetAt: Date.now() + 60_000,
  })),
}));
jest.mock('@/lib/server/account', () => ({
  ...jest.requireActual('@/lib/server/account'),
  checkPassword: jest.fn(),
}));

const change = async (body: unknown) => {
  const res = await POST(
    new Request('http://localhost/api/account/password', {
      method: 'POST',
      body: JSON.stringify(body),
    }) as unknown as NextRequest,
  );
  return { status: res.status, body: await res.json() };
};
const valid = { currentPassword: 'Old-pass1', newPassword: 'New-pass1' };

beforeEach(() => {
  jest.clearAllMocks();
  user = { id: 'user-1', email: 'player@example.com' };
  limited = false;
  updateError = null;
  updates.length = 0;
  signOuts.length = 0;
  jest.mocked(checkPassword).mockResolvedValue('right');
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

it('checks the current password, sets the new one, and signs out every other device', async () => {
  expect(await change(valid)).toEqual({ status: 200, body: { ok: true } });
  expect(checkPassword).toHaveBeenCalledWith('player@example.com', 'Old-pass1');
  // The current one goes along: Supabase can be set to refuse a change without it.
  expect(updates).toEqual([{ password: 'New-pass1', current_password: 'Old-pass1' }]);
  expect(signOuts).toEqual([{ scope: 'others' }]);
});

it('changes nothing when the current password is wrong, and says which field', async () => {
  jest.mocked(checkPassword).mockResolvedValue('wrong');
  expect(await change(valid)).toEqual({
    status: 400,
    body: { error: "That isn't your current password", field: 'currentPassword' },
  });
  expect(updates).toEqual([]);
  expect(signOuts).toEqual([]);
});

it("changes nothing, and doesn't blame the password, when it couldn't be checked", async () => {
  jest.mocked(checkPassword).mockResolvedValue('unavailable');
  expect(await change(valid)).toEqual({
    status: 503,
    body: { error: "Couldn't check your password right now. Please try again." },
  });
  expect(updates).toEqual([]);
});

it('refuses a new password longer than Supabase takes, with words of its own', async () => {
  const res = await change({ currentPassword: 'Old-pass1', newPassword: `Aa1${'x'.repeat(70)}` });
  expect(res).toEqual({ status: 400, body: { error: 'Password must be at most 72 characters' } });
});

it('refuses a signed-out request', async () => {
  user = null;
  expect((await change(valid)).status).toBe(401);
  expect(checkPassword).not.toHaveBeenCalled();
});

it('stops once the tries are used up, before checking the password', async () => {
  limited = true;
  expect((await change(valid)).status).toBe(429);
  expect(checkPassword).not.toHaveBeenCalled();
});

it('holds a new password to the sign-up rules', async () => {
  const res = await change({ currentPassword: 'Old-pass1', newPassword: 'short' });
  expect(res.status).toBe(400);
  expect(res.body.error).toBe('Password must be at least 8 characters');
  expect(checkPassword).not.toHaveBeenCalled();
});

it("says what Supabase wouldn't take, on the field it's about", async () => {
  updateError = { code: 'same_password', message: 'New password should be different' };
  expect(await change(valid)).toEqual({
    status: 400,
    body: { error: "That's your current password. Pick a new one", field: 'password' },
  });
  expect(signOuts).toEqual([]);

  // Supabase's own check of the current password, on that field.
  updateError = { code: 'current_password_invalid', message: 'Current password required' };
  expect(await change(valid)).toEqual({
    status: 400,
    body: { error: "That isn't your current password", field: 'currentPassword' },
  });

  // A session over a day old, with "Secure password change" on.
  updateError = {
    code: 'reauthentication_needed',
    message: 'Password update requires reauthentication',
  };
  expect(await change(valid)).toEqual({
    status: 400,
    body: { error: 'For your security, sign out and sign back in, then try again.' },
  });

  updateError = { code: 'unexpected_failure', message: 'boom' };
  expect(await change(valid)).toEqual({
    status: 500,
    body: { error: "Couldn't change your password. Please try again." },
  });
});
