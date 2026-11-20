/**
 * @jest-environment node
 */
import type { NextRequest } from 'next/server';
import { PUT } from '@/app/api/profile/username/route';
import { RATE_LIMITS } from '@/lib/server/rate-limit';

let user: { id: string } | null = { id: 'user-1' };
let answer: unknown = 'ok';
let rpcError: { message: string } | null = null;
const claims: { name: string; args: Record<string, unknown> }[] = [];
/** Tries counted by the database's limiter, by key: shared by every server instance. */
const counted = new Map<string, number>();

jest.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user } }) } }),
}));
jest.mock('@/lib/supabase/service', () => ({
  tryCreateServiceClient: () => ({
    rpc: (name: string, args: Record<string, unknown>) => {
      if (name === 'consume_rate_limit') {
        const key = args.p_key as string;
        const limit = args.p_limit as number;
        const used = (counted.get(key) ?? 0) + 1;
        counted.set(key, used);
        const data = {
          allowed: used <= limit,
          remaining: Math.max(0, limit - used),
          reset_at: new Date(Date.now() + 60_000).toISOString(),
        };
        return { single: async () => ({ data, error: null }) };
      }
      claims.push({ name, args });
      return Promise.resolve({ data: rpcError ? null : answer, error: rpcError });
    },
  }),
}));

const save = async (body: unknown) => {
  const res = await PUT(
    new Request('http://localhost/api/profile/username', {
      method: 'PUT',
      body: JSON.stringify(body),
    }) as unknown as NextRequest,
  );
  return { status: res.status, body: await res.json() };
};

beforeEach(() => {
  user = { id: `user-${Math.random()}` };
  answer = 'ok';
  rpcError = null;
  claims.length = 0;
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

it("claims the username, cleaned, for the signed-in player's own profile", async () => {
  expect(await save({ username: '  MistKai ' })).toEqual({
    status: 200,
    body: { username: 'mistkai' },
  });
  expect(claims).toEqual([
    { name: 'claim_username', args: { p_user: user!.id, p_username: 'mistkai' } },
  ]);
});

it('refuses what is not a username without asking the database, and says why', async () => {
  expect(await save({ username: 'ab' })).toEqual({
    status: 400,
    body: { error: 'Use at least 3 characters', field: 'username' },
  });
  expect((await save({ username: 'mist kai' })).body).toEqual({
    error: 'Use only letters, numbers, - and _',
    field: 'username',
  });
  expect((await save({ username: 'x'.repeat(21) })).status).toBe(400);
  expect((await save({ username: 42 })).status).toBe(400);
  expect((await save({})).status).toBe(400);
  expect(claims).toEqual([]);
});

it('says so under the field when the username is taken or reserved', async () => {
  answer = 'taken';
  expect(await save({ username: 'mistkai' })).toEqual({
    status: 409,
    body: { error: 'That username is taken', field: 'username' },
  });
  answer = 'reserved';
  expect(await save({ username: 'admin' })).toEqual({
    status: 409,
    body: { error: "That username isn't available", field: 'username' },
  });
  answer = 'invalid';
  expect((await save({ username: 'mistkai' })).status).toBe(400);
});

it('fails plainly, and logs it, when the database fails or answers something else', async () => {
  rpcError = { message: 'boom' };
  expect(await save({ username: 'mistkai' })).toEqual({
    status: 500,
    body: { error: "Couldn't save your username. Please try again." },
  });
  rpcError = null;
  answer = 'no_profile';
  expect((await save({ username: 'mistkai' })).status).toBe(500);
  expect(console.error).toHaveBeenCalledTimes(2);
});

it('turns a signed-out caller away', async () => {
  user = null;
  expect((await save({ username: 'mistkai' })).status).toBe(401);
  expect(claims).toEqual([]);
});

it('stops a script trying one username after another', async () => {
  const { limit } = RATE_LIMITS.usernameChange;
  answer = 'taken';
  for (let i = 0; i < limit; i++) expect((await save({ username: `name${i}` })).status).toBe(409);
  expect((await save({ username: 'onemore' })).status).toBe(429);
  expect(claims).toHaveLength(limit);
  // Counted in the database, under the player's own key.
  expect(counted.get(`username:${user!.id}`)).toBe(limit + 1);
});
