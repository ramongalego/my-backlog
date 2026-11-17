/**
 * @jest-environment node
 */
import type { NextRequest } from 'next/server';
import { POST } from '@/app/api/suggest/reroll/route';
import { RATE_LIMITS } from '@/lib/server/rate-limit';
import { recordPickOutcome } from '@/lib/server/picks';

const rpc = jest.fn(async (): Promise<{ error: { message: string } | null }> => ({
  error: null,
}));
let userId = `user-${Math.random()}`;

jest.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: userId } } }) },
    rpc: (...args: unknown[]) => rpc(...(args as [])),
  }),
}));

jest.mock('@/lib/server/picks', () => ({ recordPickOutcome: jest.fn() }));

const reroll = (body: unknown = { gameId: 7 }) =>
  POST(
    new Request('http://localhost/api/suggest/reroll', {
      method: 'POST',
      body: JSON.stringify(body),
    }) as unknown as NextRequest,
  );

beforeEach(() => {
  // A new player each time, so one test's rerolls don't count toward another's limit.
  userId = `user-${Math.random()}`;
  rpc.mockClear();
  jest.mocked(recordPickOutcome).mockReset().mockResolvedValue();
});

it('keeps the pick passed on as rerolled, when the request names it', async () => {
  expect((await reroll({ gameId: 7, pickId: 41 })).status).toBe(200);

  expect(rpc).toHaveBeenCalledWith('record_game_reroll', { p_game_id: 7 });
  expect(recordPickOutcome).toHaveBeenCalledTimes(1);
  // Only as a pick of the game the reroll is counted on.
  expect(recordPickOutcome).toHaveBeenCalledWith(userId, 41, 'rerolled', 7);
});

it("still keeps the pick as rerolled when the reroll itself couldn't be counted", async () => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  rpc.mockResolvedValueOnce({ error: { message: 'down' } });

  expect((await reroll({ gameId: 7, pickId: 41 })).status).toBe(200);
  expect(recordPickOutcome).toHaveBeenCalledWith(userId, 41, 'rerolled', 7);
  jest.restoreAllMocks();
});

it("counts the reroll alone when the pick wasn't kept", async () => {
  expect((await reroll()).status).toBe(200);
  expect(rpc).toHaveBeenCalledTimes(1);
  expect(recordPickOutcome).not.toHaveBeenCalled();
});

it.each([
  ['zero', 0],
  ['text', '41'],
  ['not whole', 1.5],
])('refuses a pick id that is %s, counting nothing', async (_, pickId) => {
  expect((await reroll({ gameId: 7, pickId })).status).toBe(400);
  expect(rpc).not.toHaveBeenCalled();
  expect(recordPickOutcome).not.toHaveBeenCalled();
});

it('records rerolls until the per-user limit, then refuses without recording', async () => {
  for (let i = 0; i < RATE_LIMITS.suggestionReroll.limit; i++) {
    expect((await reroll()).status).toBe(200);
  }
  expect(rpc).toHaveBeenCalledTimes(RATE_LIMITS.suggestionReroll.limit);

  const res = await reroll();
  expect(res.status).toBe(429);
  expect(await res.json()).toEqual({ error: 'Too many requests' });
  expect(rpc).toHaveBeenCalledTimes(RATE_LIMITS.suggestionReroll.limit);
});
