/**
 * @jest-environment node
 */
import type { NextRequest } from 'next/server';
import { DELETE, PATCH, POST } from '@/app/api/queue/route';
import { RATE_LIMITS } from '@/lib/rate-limit';

let userId = '';
// What reading the queue's last position returns.
let maxPosition: { data: { position: number } | null; error: { message: string } | null };
const inserted: Record<string, unknown>[] = [];

jest.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: userId } } }) },
    rpc: async () => ({ error: null }),
    from: () => {
      const builder = {
        select: () => builder,
        eq: () => builder,
        order: () => builder,
        limit: () => builder,
        delete: () => builder,
        maybeSingle: async () => maxPosition,
        insert: async (row: Record<string, unknown>) => {
          inserted.push(row);
          return { error: null };
        },
        then: (resolve: (v: unknown) => unknown) => resolve({ error: null }),
      };
      return builder;
    },
  }),
}));

const request = (method: string, url: string, body?: unknown) =>
  new Request(`http://localhost${url}`, {
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }) as unknown as NextRequest;

const add = () => POST(request('POST', '/api/queue', { gameId: 7 }));
const reorder = () => PATCH(request('PATCH', '/api/queue', { order: [7, 8] }));
const remove = () => DELETE(request('DELETE', '/api/queue?gameId=7'));

beforeEach(() => {
  userId = `user-${Math.random()}`;
  maxPosition = { data: { position: 2 }, error: null };
  inserted.length = 0;
});

it('adds the game after the last one in the queue', async () => {
  expect((await add()).status).toBe(200);
  expect(inserted).toEqual([{ user_id: userId, game_id: 7, position: 3 }]);
});

it("doesn't add the game when the queue can't be read", async () => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  maxPosition = { data: null, error: { message: 'down' } };

  const res = await add();

  expect(res.status).toBe(500);
  expect(await res.json()).toEqual({ error: 'Failed to add to queue' });
  expect(inserted).toEqual([]);
});

it('lets a busy minute of adding, reordering and removing through', async () => {
  for (let i = 0; i < 100; i++) {
    expect((await add()).status).toBe(200);
    expect((await reorder()).status).toBe(200);
    expect((await remove()).status).toBe(200);
  }
});

it('rate limits queue writes per user, across adding, reordering and removing', async () => {
  for (let i = 0; i < RATE_LIMITS.queueWrite.limit; i++) await reorder();

  for (const write of [add, reorder, remove]) {
    const res = await write();
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: 'Too many requests' });
  }

  // Someone else's queue isn't affected.
  userId = 'another-user';
  expect((await reorder()).status).toBe(200);
});
