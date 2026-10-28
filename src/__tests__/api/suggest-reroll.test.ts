/**
 * @jest-environment node
 */
import type { NextRequest } from 'next/server';
import { POST } from '@/app/api/suggest/reroll/route';
import { RATE_LIMITS } from '@/lib/rate-limit';

const rpc = jest.fn(async () => ({ error: null }));
const userId = `user-${Math.random()}`;

jest.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: userId } } }) },
    rpc: (...args: unknown[]) => rpc(...(args as [])),
  }),
}));

const reroll = () =>
  POST(
    new Request('http://localhost/api/suggest/reroll', {
      method: 'POST',
      body: JSON.stringify({ gameId: 7 }),
    }) as unknown as NextRequest,
  );

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
