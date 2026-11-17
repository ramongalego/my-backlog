/**
 * @jest-environment node
 */
import type { NextRequest } from 'next/server';
import { DELETE, PATCH, POST } from '@/app/api/queue/route';
import { RATE_LIMITS } from '@/lib/server/rate-limit';

let userId = '';
// What reading the queue's last position returns.
let maxPosition: { data: { position: number } | null; error: { message: string } | null };
const inserted: Record<string, unknown>[] = [];
// The game is in the queue already: the insert breaks the unique constraint.
let alreadyQueued = false;
// Every database function called, with what it was given.
const rpcCalls: [string, unknown][] = [];
// What add_to_queue (an Undo's way back on the queue) answers.
let addToQueueError: { code: string; message: string } | null = null;
// How many times the queue's table was read or written.
let tableUses = 0;

jest.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: userId } } }) },
    rpc: async (name: string, args: unknown) => {
      rpcCalls.push([name, args]);
      return { error: name === 'add_to_queue' ? addToQueueError : null };
    },
    from: () => {
      tableUses++;
      const builder = {
        select: () => builder,
        eq: () => builder,
        order: () => builder,
        limit: () => builder,
        delete: () => builder,
        maybeSingle: async () => maxPosition,
        insert: async (row: Record<string, unknown>) => {
          if (alreadyQueued) return { error: { code: '23505', message: 'duplicate key' } };
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
/** Back on the queue by Undo, pressed `undoAgoMs` after the game was taken off. */
const addBack = (undoAgoMs: unknown) =>
  POST(request('POST', '/api/queue', { gameId: 7, undoAgoMs }));
const reorder = () => PATCH(request('PATCH', '/api/queue', { order: [7, 8] }));
const remove = () => DELETE(request('DELETE', '/api/queue?gameId=7'));

const addToQueueCalls = () => rpcCalls.filter(([name]) => name === 'add_to_queue');

beforeEach(() => {
  userId = `user-${Math.random()}`;
  maxPosition = { data: { position: 2 }, error: null };
  inserted.length = 0;
  alreadyQueued = false;
  rpcCalls.length = 0;
  addToQueueError = null;
  tableUses = 0;
});

// A test that silences console.error gives it back.
afterEach(() => jest.restoreAllMocks());

it('adds the game after the last one in the queue', async () => {
  expect((await add()).status).toBe(200);
  expect(inserted).toEqual([{ user_id: userId, game_id: 7, position: 3 }]);
  // An ordinary add isn't an Undo: the Undo's function is left alone.
  expect(rpcCalls).toEqual([]);
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

it('takes adding a game that is queued already as done, not as an error', async () => {
  alreadyQueued = true;

  const res = await add();

  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ success: true });
});

describe('putting a game back by Undo (undoAgoMs)', () => {
  it('saves it through add_to_queue, with how long ago it was taken off, and nothing else', async () => {
    const res = await addBack(90_000);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(rpcCalls).toEqual([['add_to_queue', { p_game_id: 7, p_undo_ago: 90 }]]);
    // The function puts it on the queue itself: no position read, no insert.
    expect(tableUses).toBe(0);
    expect(inserted).toEqual([]);
  });

  it.each([
    ['none, pressed as the toast appeared', 0, 0],
    ['a moment, rounded up to a whole second', 1, 1],
    ['a little over a minute and a half, rounded up', 90_001, 91],
    ['a week, which counts as a day', 7 * 24 * 60 * 60 * 1000, 86_400],
  ])('says the time in whole seconds: %s', async (_, undoAgoMs, seconds) => {
    expect((await addBack(undoAgoMs)).status).toBe(200);
    expect(addToQueueCalls()).toEqual([['add_to_queue', { p_game_id: 7, p_undo_ago: seconds }]]);
  });

  it("says the game is gone when it isn't one of the player's games", async () => {
    addToQueueError = { code: '23503', message: 'violates foreign key constraint' };

    const res = await addBack(90_000);

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Game not found' });
    expect(inserted).toEqual([]);
  });

  it.each([
    ['PGRST202', 'Could not find the function public.add_to_queue in the schema cache'],
    ['42883', 'function public.add_to_queue(bigint, numeric) does not exist'],
  ])(
    'adds it the ordinary way while the database has no add_to_queue yet (%s)',
    async (code, message) => {
      addToQueueError = { code, message };
      const logged = jest.spyOn(console, 'error').mockImplementation(() => {});

      const res = await addBack(90_000);

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ success: true });
      expect(addToQueueCalls()).toHaveLength(1);
      expect(inserted).toEqual([{ user_id: userId, game_id: 7, position: 3 }]);
      // Expected until the migration is applied: not reported as an error.
      expect(logged).not.toHaveBeenCalled();
    },
  );

  it("doesn't add the game when add_to_queue fails any other way", async () => {
    const logged = jest.spyOn(console, 'error').mockImplementation(() => {});
    addToQueueError = { code: '57014', message: 'canceling statement due to statement timeout' };

    const res = await addBack(90_000);

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Failed to add to queue' });
    expect(tableUses).toBe(0);
    expect(inserted).toEqual([]);
    expect(logged).toHaveBeenCalledWith(addToQueueError);
  });

  it.each([
    ['a time before the game was taken off', -1],
    ['a time that is not a number', '90000'],
    ['no time, said as null', null],
  ])('refuses %s, without touching the queue', async (_, undoAgoMs) => {
    expect((await addBack(undoAgoMs)).status).toBe(400);
    expect(rpcCalls).toEqual([]);
    expect(inserted).toEqual([]);
  });
});
