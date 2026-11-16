/**
 * @jest-environment node
 */
import type { NextRequest } from 'next/server';
import { PUT } from '@/app/api/profile/favorites/route';

let user: { id: string } | null = { id: 'user-1' };
let rpcError: { code: string; message: string } | null = null;
const rpcCalls: { name: string; args: unknown }[] = [];

jest.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user } }) },
    rpc: async (name: string, args: unknown) => {
      rpcCalls.push({ name, args });
      return { error: rpcError };
    },
  }),
}));

const save = async (body: unknown, raw = false) => {
  const res = await PUT(
    new Request('http://localhost/api/profile/favorites', {
      method: 'PUT',
      body: raw ? (body as string) : JSON.stringify(body),
    }) as unknown as NextRequest,
  );
  return { status: res.status, body: await res.json() };
};

beforeEach(() => {
  user = { id: `user-${Math.random()}` };
  rpcError = null;
  rpcCalls.length = 0;
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

it('saves the picked games, in order, in one step', async () => {
  const res = await save({ gameIds: [12, 7, 30] });
  expect(res).toEqual({ status: 200, body: { gameIds: [12, 7, 30] } });
  expect(rpcCalls).toEqual([{ name: 'set_favorite_games', args: { p_game_ids: [12, 7, 30] } }]);
});

it('clears them with an empty list', async () => {
  expect((await save({ gameIds: [] })).status).toBe(200);
  expect(rpcCalls[0].args).toEqual({ p_game_ids: [] });
});

it('refuses a signed-out request', async () => {
  user = null;
  expect((await save({ gameIds: [1] })).status).toBe(401);
  expect(rpcCalls).toEqual([]);
});

it('refuses more than four, a game twice, and anything that is not a list of ids', async () => {
  expect(await save({ gameIds: [1, 2, 3, 4, 5] })).toEqual({
    status: 400,
    body: { error: 'Pick 4 games at most' },
  });
  expect(await save({ gameIds: [1, 1] })).toEqual({
    status: 400,
    body: { error: 'Each game can be picked once' },
  });
  for (const body of [{}, { gameIds: 'all' }, { gameIds: [0] }, { gameIds: [1.5] }, null]) {
    expect((await save(body)).status).toBe(400);
  }
  expect((await save('{not json', true)).status).toBe(400);
  expect(rpcCalls).toEqual([]);
});

it("says so when a picked game isn't in the library any more", async () => {
  rpcError = { code: '22023', message: 'Favorites reference games not in the library' };
  expect(await save({ gameIds: [999] })).toEqual({
    status: 400,
    body: { error: 'One of those games is no longer in your library' },
  });
});

it("doesn't pass the database's own words on when the save fails", async () => {
  rpcError = { code: 'PGRST202', message: 'Could not find the function public.set_favorite_games' };
  expect(await save({ gameIds: [1] })).toEqual({
    status: 500,
    body: { error: "Couldn't save your favorites. Please try again." },
  });
});

it('stops a player past the limit', async () => {
  let last = 200;
  for (let i = 0; i < 61; i++) last = (await save({ gameIds: [1] })).status;
  expect(last).toBe(429);
});
