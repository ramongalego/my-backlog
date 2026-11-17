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
  expect(await res.json()).toEqual({
    success: true,
    paused: [{ id: 9, name: 'Zelda' }],
    // The rules didn't say when the game had been started.
    startedAt: null,
  });
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

it('answers with when the game had been started before the change, for its Undo to put back', async () => {
  jest.mocked(applyStatusChange).mockResolvedValue({
    ok: true,
    paused: [],
    startedAt: '2026-11-13T13:57:21.123+00:00',
  });
  const started = await change({ gameId: 7, status: 'playing', pausePlaying: true });
  expect(await started.json()).toEqual({
    success: true,
    paused: [],
    startedAt: '2026-11-13T13:57:21.123+00:00',
  });

  // It had never been started.
  jest.mocked(applyStatusChange).mockResolvedValue({ ok: true, paused: [], startedAt: null });
  const neverStarted = await change({ gameId: 7, status: 'playing', pausePlaying: true });
  expect(await neverStarted.json()).toEqual({ success: true, paused: [], startedAt: null });
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

it('passes an Undo on as one, and an ordinary change as not', async () => {
  await change({ gameId: 7, status: 'playing', undo: true });
  expect(applyStatusChange).toHaveBeenLastCalledWith(
    expect.anything(),
    user!.id,
    expect.objectContaining({ gameId: 7, status: 'playing', undo: true }),
  );

  await change({ gameId: 7, status: 'backlog' });
  const [, , sent] = jest.mocked(applyStatusChange).mock.calls.at(-1)!;
  expect(sent.undo).toBeUndefined();

  expect((await change({ gameId: 7, status: 'backlog', undo: 'yes' })).status).toBe(400);
});

it("passes on how long ago an Undo's change was made", async () => {
  await change({ gameId: 7, status: 'playing', undo: true, undoAgoMs: 90_000 });
  expect(applyStatusChange).toHaveBeenLastCalledWith(
    expect.anything(),
    user!.id,
    expect.objectContaining({ gameId: 7, status: 'playing', undo: true, undoAgoMs: 90_000 }),
  );

  // Pressed the moment the toast appeared.
  await change({ gameId: 7, status: 'playing', undo: true, undoAgoMs: 0 });
  expect(applyStatusChange).toHaveBeenLastCalledWith(
    expect.anything(),
    user!.id,
    expect.objectContaining({ undoAgoMs: 0 }),
  );

  // An Undo from a page loaded before this: no time with it.
  await change({ gameId: 7, status: 'playing', undo: true });
  const [, , sent] = jest.mocked(applyStatusChange).mock.calls.at(-1)!;
  expect(sent.undoAgoMs).toBeUndefined();
});

it.each([
  ['a time before the change', -1],
  ['a time that is not a number', '90000'],
  ['no time, said as null', null],
])("refuses %s for how long ago an Undo's change was", async (_, undoAgoMs) => {
  const res = await change({ gameId: 7, status: 'playing', undo: true, undoAgoMs });
  expect(res.status).toBe(400);
  expect(applyStatusChange).not.toHaveBeenCalled();
});

it('takes the dates an Undo puts back, and refuses ones that are not dates', async () => {
  await change({
    gameId: 7,
    status: 'playing',
    undo: true,
    startedAt: '2026-11-13T13:57:21.123+00:00',
    lastPlayedAt: null,
  });
  expect(applyStatusChange).toHaveBeenLastCalledWith(
    expect.anything(),
    user!.id,
    expect.objectContaining({ startedAt: '2026-11-13T13:57:21.123+00:00', lastPlayedAt: null }),
  );

  // That it had never been started is taken too: a game put back as finished.
  await change({ gameId: 7, status: 'finished', undo: true, startedAt: null });
  expect(applyStatusChange).toHaveBeenLastCalledWith(
    expect.anything(),
    user!.id,
    expect.objectContaining({ status: 'finished', undo: true, startedAt: null }),
  );

  const refused = await change({ gameId: 7, status: 'playing', undo: true, startedAt: 'soon' });
  expect(refused.status).toBe(400);
});
