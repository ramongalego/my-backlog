/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/account/email/route';
import { checkPassword } from '@/lib/server/account';

let user: { id: string; email?: string } | null = { id: 'user-1', email: 'player@example.com' };
/** Which of the route's two limits is used up: the hourly one, or the password tries. */
let limited: 'email' | 'tries' | null = null;
let updateResult: {
  data: { user: { email: string; new_email?: string } | null };
  error: { code?: string; message: string } | null;
};
const updates: { attributes: unknown; options: unknown }[] = [];

jest.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user } }),
      updateUser: async (attributes: unknown, options: unknown) => {
        updates.push({ attributes, options });
        return updateResult;
      },
    },
  }),
}));
jest.mock('@/lib/server/rate-limit', () => ({
  ...jest.requireActual('@/lib/server/rate-limit'),
  checkSharedRateLimit: async (key: string) => ({
    success: !(
      (limited === 'email' && key.startsWith('account-email:')) ||
      (limited === 'tries' && key.startsWith('account-password:'))
    ),
    limit: 5,
    remaining: 0,
    resetAt: Date.now() + 60_000,
  }),
}));
jest.mock('@/lib/server/account', () => ({
  ...jest.requireActual('@/lib/server/account'),
  checkPassword: jest.fn(),
}));

const ORIGIN = 'https://mybacklog.test';
const change = async (body: unknown) => {
  const res = await POST(
    new NextRequest(`${ORIGIN}/api/account/email`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  );
  return { status: res.status, body: await res.json() };
};
const valid = { email: 'new@example.com', password: 'My-pass1' };

beforeEach(() => {
  jest.clearAllMocks();
  user = { id: 'user-1', email: 'player@example.com' };
  limited = null;
  updates.length = 0;
  updateResult = {
    data: { user: { email: 'player@example.com', new_email: 'new@example.com' } },
    error: null,
  };
  jest.mocked(checkPassword).mockResolvedValue('right');
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

it('checks the password, then asks Supabase to change it, with links back to the profile', async () => {
  expect(await change({ ...valid, email: ' new@example.com ' })).toEqual({
    status: 200,
    body: { email: 'player@example.com', pendingEmail: 'new@example.com' },
  });
  expect(checkPassword).toHaveBeenCalledWith('player@example.com', 'My-pass1');
  expect(updates).toEqual([
    {
      attributes: { email: 'new@example.com' },
      options: {
        emailRedirectTo: `${ORIGIN}/auth/callback?flow=email-change&next=/profile`,
      },
    },
  ]);
});

it('changes nothing with the wrong password: a new email is a way into the account', async () => {
  jest.mocked(checkPassword).mockResolvedValue('wrong');
  expect(await change(valid)).toEqual({
    status: 400,
    body: { error: "That isn't your password", field: 'password' },
  });
  expect(updates).toEqual([]);
});

it('asks for the password, on its own field', async () => {
  expect(await change({ email: 'new@example.com' })).toMatchObject({
    status: 400,
    body: { field: 'password' },
  });
  expect(await change({ email: 'new@example.com', password: '' })).toEqual({
    status: 400,
    body: { error: 'Enter your password', field: 'password' },
  });
  expect(checkPassword).not.toHaveBeenCalled();
});

it("doesn't blame the password when it couldn't be checked", async () => {
  jest.mocked(checkPassword).mockResolvedValue('unavailable');
  expect((await change(valid)).status).toBe(503);
  expect(updates).toEqual([]);
});

it('says when the change is made at once, with nothing to confirm', async () => {
  updateResult = { data: { user: { email: 'new@example.com' } }, error: null };
  expect((await change(valid)).body).toEqual({ email: 'new@example.com', pendingEmail: null });
});

it('refuses the email it already has, in any case, before spending a password try', async () => {
  expect(await change({ ...valid, email: 'Player@Example.com' })).toEqual({
    status: 400,
    body: { error: "That's already your email", field: 'email' },
  });
  expect(checkPassword).not.toHaveBeenCalled();
  expect(updates).toEqual([]);
});

it('refuses what is not an email', async () => {
  expect(await change({ ...valid, email: 'not an email' })).toEqual({
    status: 400,
    body: { error: 'Please enter a valid email address', field: 'email' },
  });
});

it('refuses a signed-out request, and one past either limit', async () => {
  user = null;
  expect((await change(valid)).status).toBe(401);
  user = { id: 'user-1', email: 'player@example.com' };
  limited = 'email';
  expect((await change(valid)).status).toBe(429);
  // Guesses at the password are limited with the other places that ask for it.
  limited = 'tries';
  expect((await change(valid)).status).toBe(429);
  expect(checkPassword).not.toHaveBeenCalled();
  expect(updates).toEqual([]);
});

it("says what Supabase wouldn't take", async () => {
  updateResult = { data: { user: null }, error: { code: 'email_exists', message: 'exists' } };
  expect(await change({ ...valid, email: 'taken@example.com' })).toEqual({
    status: 400,
    body: { error: 'That email already has an account', field: 'email' },
  });

  updateResult = {
    data: { user: null },
    error: { code: 'over_email_send_rate_limit', message: 'rate limit' },
  };
  expect(await change(valid)).toEqual({
    status: 429,
    body: { error: "We can't send another email right now. Please try again in an hour." },
  });
});
