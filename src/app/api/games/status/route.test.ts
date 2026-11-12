/**
 * @jest-environment node
 */
import type { NextRequest } from 'next/server';
import { POST } from '@/app/api/games/status/route';
import { applyStatusChange } from '@/lib/server/apply-status';
import { RATE_LIMITS } from '@/lib/server/rate-limit';

let user: { id: string } | null = null;
// A fresh user per test, so the in-memory limiter starts from zero.
let userCount = 0;

jest.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user } }) } }),
}));
jest.mock('@/lib/server/apply-status', () => ({ applyStatusChange: jest.fn() }));

const change = (body: unknown) =>
  POST(
    new Request('http://localhost/api/games/status', {
      method: 'POST',
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }) as unknown as NextRequest,
  );

beforeEach(() => {
  user = { id: `status-user-${++userCount}` };
  jest.mocked(applyStatusChange).mockReset().mockResolvedValue({ ok: true, paused: [] });
});

it('refuses a signed-out request', async () => {
  user = null;
  expect((await change({ gameId: 1, status: 'finished' })).status).toBe(401);
  expect(applyStatusChange).not.toHaveBeenCalled();
});

it.each([
  ['a body that is not JSON', '{'],
  ['no game', { status: 'finished' }],
  ['a status that does not exist', { gameId: 1, status: 'completed' }],
  ['a rating out of range', { gameId: 1, status: 'finished', rating: 11 }],
  ['a date that is not a date', { gameId: 1, status: 'finished', finishedAt: '2026-13-99' }],
  ['notes that are too long', { gameId: 1, status: 'finished', notes: 'x'.repeat(1001) }],
])('refuses %s, without changing anything', async (_, body) => {
  expect((await change(body)).status).toBe(400);
  expect(applyStatusChange).not.toHaveBeenCalled();
});

it('applies a valid change for the signed-in player and reports what it paused', async () => {
  jest
    .mocked(applyStatusChange)
    .mockResolvedValue({ ok: true, paused: [{ id: 9, name: 'Zelda' }] });

  const res = await change({
    gameId: 7,
    status: 'finished',
    finishedAt: '2026-11-12',
    rating: 9,
    notes: 'Loved the <b>ending</b>',
  });

  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ success: true, paused: [{ id: 9, name: 'Zelda' }] });
  expect(applyStatusChange).toHaveBeenCalledWith(
    expect.anything(),
    user!.id,
    // HTML tags are taken out of notes on the way in.
    expect.objectContaining({
      gameId: 7,
      status: 'finished',
      rating: 9,
      notes: 'Loved the ending',
    }),
  );
});

it("passes on the rule's own refusal, with its status code", async () => {
  jest
    .mocked(applyStatusChange)
    .mockResolvedValue({ ok: false, error: 'Game not found', status: 404 });

  const res = await change({ gameId: 7, status: 'playing' });
  expect(res.status).toBe(404);
  expect(await res.json()).toEqual({ error: 'Game not found' });
});

it('stops a player past the limit, without touching the game', async () => {
  for (let i = 0; i < RATE_LIMITS.gameStatus.limit; i++) {
    expect((await change({ gameId: 1, status: 'backlog' })).status).toBe(200);
  }
  jest.mocked(applyStatusChange).mockClear();

  const res = await change({ gameId: 1, status: 'backlog' });
  expect(res.status).toBe(429);
  expect(res.headers.get('Retry-After')).toBeTruthy();
  expect(applyStatusChange).not.toHaveBeenCalled();
});
