/**
 * @jest-environment node
 */
import type { NextRequest } from 'next/server';
import { POST } from '@/app/api/account/delete/route';
import { checkPassword } from '@/lib/server/account';

let user: { id: string; email?: string } | null = { id: 'user-1', email: 'player@example.com' };
let limited = false;
let deleteError: { message: string } | null = null;
let stored: { name: string }[] = [];
const calls: string[] = [];
const removed: string[][] = [];

jest.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user } }),
      signOut: async () => {
        calls.push('signOut');
        return { error: null };
      },
    },
  }),
}));
jest.mock('@/lib/supabase/service', () => ({
  tryCreateServiceClient: () => ({
    storage: {
      from: () => ({
        list: async () => ({ data: stored, error: null }),
        remove: async (paths: string[]) => {
          calls.push('removePictures');
          removed.push(paths);
          return { error: null };
        },
      }),
    },
    auth: {
      admin: {
        deleteUser: async (id: string) => {
          calls.push(`deleteUser:${id}`);
          return { error: deleteError };
        },
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
jest.mock('@/lib/server/account', () => ({
  ...jest.requireActual('@/lib/server/account'),
  checkPassword: jest.fn(),
}));

const remove = async (body: unknown) => {
  const res = await POST(
    new Request('http://localhost/api/account/delete', {
      method: 'POST',
      body: JSON.stringify(body),
    }) as unknown as NextRequest,
  );
  return { status: res.status, body: await res.json() };
};

beforeEach(() => {
  jest.clearAllMocks();
  user = { id: 'user-1', email: 'player@example.com' };
  limited = false;
  deleteError = null;
  stored = [];
  calls.length = 0;
  removed.length = 0;
  jest.mocked(checkPassword).mockResolvedValue('right');
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

it('deletes the account, then its pictures, then clears the session', async () => {
  stored = [{ name: 'a.webp' }, { name: 'b.webp' }];
  expect(await remove({ password: 'My-pass1' })).toEqual({ status: 200, body: { ok: true } });
  expect(checkPassword).toHaveBeenCalledWith('player@example.com', 'My-pass1');
  expect(removed).toEqual([['user-1/a.webp', 'user-1/b.webp']]);
  // The account first: a failure after it can't leave a profile pointing at a
  // deleted picture.
  expect(calls).toEqual(['deleteUser:user-1', 'removePictures', 'signOut']);
});

it('deletes nothing with the wrong password, and says which field', async () => {
  jest.mocked(checkPassword).mockResolvedValue('wrong');
  expect(await remove({ password: 'wrong' })).toEqual({
    status: 400,
    body: { error: "That isn't your password", field: 'password' },
  });
  expect(calls).toEqual([]);
});

it("deletes nothing, and doesn't blame the password, when it couldn't be checked", async () => {
  jest.mocked(checkPassword).mockResolvedValue('unavailable');
  expect(await remove({ password: 'My-pass1' })).toEqual({
    status: 503,
    body: { error: "Couldn't check your password right now. Please try again." },
  });
  expect(calls).toEqual([]);
});

it('deletes nothing without a password, signed out, or past the limit', async () => {
  expect((await remove({})).status).toBe(400);
  user = null;
  expect((await remove({ password: 'My-pass1' })).status).toBe(401);
  user = { id: 'user-1', email: 'player@example.com' };
  limited = true;
  expect((await remove({ password: 'My-pass1' })).status).toBe(429);
  expect(checkPassword).not.toHaveBeenCalled();
  expect(calls).toEqual([]);
});

it('says so when the account could not be deleted, keeping its pictures and the session', async () => {
  stored = [{ name: 'a.webp' }];
  deleteError = { message: 'boom' };
  expect(await remove({ password: 'My-pass1' })).toEqual({
    status: 500,
    body: { error: "Couldn't delete your account. Please try again." },
  });
  expect(calls).toEqual(['deleteUser:user-1']);
});
