/**
 * @jest-environment node
 */
import type { NextRequest } from 'next/server';
import { PUT } from '@/app/api/profile/privacy/route';

let user: { id: string } | null = { id: 'user-1' };
let serviceKey = true;
let saveError: { message: string } | null = null;
const saves: { table: string; change: Record<string, unknown>; id: unknown }[] = [];

jest.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user } }) } }),
}));
jest.mock('@/lib/supabase/service', () => ({
  tryCreateServiceClient: () =>
    serviceKey
      ? {
          from: (table: string) => ({
            update: (change: Record<string, unknown>) => ({
              eq: async (column: string, id: unknown) => {
                if (column !== 'id') throw new Error(`unexpected filter ${column}`);
                saves.push({ table, change, id });
                return { error: saveError };
              },
            }),
          }),
        }
      : null,
}));

const save = async (body: unknown, raw?: string) => {
  const res = await PUT(
    new Request('http://localhost/api/profile/privacy', {
      method: 'PUT',
      body: raw ?? JSON.stringify(body),
    }) as unknown as NextRequest,
  );
  return { status: res.status, body: await res.json() };
};

beforeEach(() => {
  // Its own account each time: the rate limit is per player.
  user = { id: `user-${Math.random()}` };
  serviceKey = true;
  saveError = null;
  saves.length = 0;
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

it("makes the player's own profile private, and public again", async () => {
  expect(await save({ private: true })).toEqual({ status: 200, body: { private: true } });
  expect(await save({ private: false })).toEqual({ status: 200, body: { private: false } });
  expect(saves.map((one) => [one.table, one.id, one.change.is_private])).toEqual([
    ['profiles', user!.id, true],
    ['profiles', user!.id, false],
  ]);
});

it('changes nothing else on the profile, whatever is sent', async () => {
  await save({ private: true, username: 'admin', id: 'someone-else', display_name: 'Admin' });
  expect(Object.keys(saves[0].change).sort()).toEqual(['is_private', 'updated_at']);
  expect(saves[0].id).toBe(user!.id);
});

it('refuses anything that is not a yes or a no', async () => {
  for (const body of [{}, { private: 'true' }, { private: 1 }, { private: null }, [], 'private']) {
    expect((await save(body)).status).toBe(400);
  }
  expect((await save(null, '{not json')).status).toBe(400);
  expect(saves).toEqual([]);
});

it('refuses a signed-out request', async () => {
  user = null;
  expect((await save({ private: true })).status).toBe(401);
  expect(saves).toEqual([]);
});

it('says so, and logs it, when it could not be saved', async () => {
  saveError = { message: 'boom' };
  expect(await save({ private: true })).toEqual({
    status: 500,
    body: { error: "Couldn't save that. Please try again." },
  });
  expect(console.error).toHaveBeenCalledWith('Saving the profile visibility failed:', saveError);

  serviceKey = false;
  expect((await save({ private: true })).status).toBe(500);
});

it('stops a player who keeps flipping it', async () => {
  let last = 200;
  for (let i = 0; i < 61; i++) last = (await save({ private: i % 2 === 0 })).status;
  expect(last).toBe(429);
  expect(saves).toHaveLength(60);
});
