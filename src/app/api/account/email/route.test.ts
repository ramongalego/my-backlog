/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/account/email/route';

let user: { id: string; email?: string } | null = { id: 'user-1', email: 'player@example.com' };
let limited = false;
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
  checkSharedRateLimit: async () => ({
    success: !limited,
    limit: 5,
    remaining: 0,
    resetAt: Date.now() + 60_000,
  }),
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

beforeEach(() => {
  user = { id: 'user-1', email: 'player@example.com' };
  limited = false;
  updates.length = 0;
  updateResult = {
    data: { user: { email: 'player@example.com', new_email: 'new@example.com' } },
    error: null,
  };
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

it('asks Supabase to change it, with links that come back to the profile', async () => {
  expect(await change({ email: ' new@example.com ' })).toEqual({
    status: 200,
    body: { email: 'player@example.com', pendingEmail: 'new@example.com' },
  });
  expect(updates).toEqual([
    {
      attributes: { email: 'new@example.com' },
      options: {
        emailRedirectTo: `${ORIGIN}/auth/callback?flow=email-change&next=/profile`,
      },
    },
  ]);
});

it('says when the change is made at once, with nothing to confirm', async () => {
  updateResult = { data: { user: { email: 'new@example.com' } }, error: null };
  expect((await change({ email: 'new@example.com' })).body).toEqual({
    email: 'new@example.com',
    pendingEmail: null,
  });
});

it('refuses the email it already has, in any case', async () => {
  expect(await change({ email: 'Player@Example.com' })).toEqual({
    status: 400,
    body: { error: "That's already your email", field: 'email' },
  });
  expect(updates).toEqual([]);
});

it('refuses what is not an email', async () => {
  expect(await change({ email: 'not an email' })).toEqual({
    status: 400,
    body: { error: 'Please enter a valid email address', field: 'email' },
  });
});

it('refuses a signed-out request, and one past the limit', async () => {
  user = null;
  expect((await change({ email: 'new@example.com' })).status).toBe(401);
  user = { id: 'user-1', email: 'player@example.com' };
  limited = true;
  expect((await change({ email: 'new@example.com' })).status).toBe(429);
  expect(updates).toEqual([]);
});

it("says what Supabase wouldn't take", async () => {
  updateResult = { data: { user: null }, error: { code: 'email_exists', message: 'exists' } };
  expect(await change({ email: 'taken@example.com' })).toEqual({
    status: 400,
    body: { error: 'That email already has an account', field: 'email' },
  });

  updateResult = {
    data: { user: null },
    error: { code: 'over_email_send_rate_limit', message: 'rate limit' },
  };
  expect(await change({ email: 'new@example.com' })).toEqual({
    status: 429,
    body: { error: "We can't send another email right now. Please try again in an hour." },
  });
});
