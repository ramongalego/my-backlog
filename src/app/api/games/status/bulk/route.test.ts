/**
 * @jest-environment node
 */
import type { NextRequest } from 'next/server';
import { POST } from '@/app/api/games/status/bulk/route';
import { applyStatusChanges, restoreGames } from '@/lib/server/apply-status';

let user: { id: string } | null = { id: 'user-1' };

jest.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user } }) } }),
}));
jest.mock('@/lib/server/apply-status', () => ({
  applyStatusChanges: jest.fn(),
  restoreGames: jest.fn(),
}));

const was = (id: number, overrides: Record<string, unknown> = {}) => ({
  id,
  status: 'backlog',
  started_at: null,
  finished_at: null,
  dropped_at: null,
  notes: null,
  rating: null,
  last_played_at: null,
  ...overrides,
});

const move = (body: unknown) =>
  POST(
    new Request('http://localhost/api/games/status/bulk', {
      method: 'POST',
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }) as unknown as NextRequest,
  );

beforeEach(() => {
  user = { id: `user-${Math.random()}` };
  jest
    .mocked(applyStatusChanges)
    .mockReset()
    .mockImplementation(async (_client, _user, changes) => ({
      ok: true,
      count: changes.length,
      previous: changes.map((change) => was(change.gameId)) as never,
    }));
  jest
    .mocked(restoreGames)
    .mockReset()
    .mockImplementation(async (_client, _user, games) => ({ ok: true, count: games.length }));
});

it('refuses a signed-out request', async () => {
  user = null;
  expect((await move({ changes: [{ gameId: 1, status: 'hidden' }] })).status).toBe(401);
  expect(applyStatusChanges).not.toHaveBeenCalled();
});

it.each([
  ['a body that is not JSON', '{'],
  ['no changes', { changes: [] }],
  ['a game without an id', { changes: [{ status: 'hidden' }] }],
  ['Playing, which only one game can be', { changes: [{ gameId: 1, status: 'playing' }] }],
  ['a status that does not exist', { changes: [{ gameId: 1, status: 'queue' }] }],
  ['a rating out of range', { changes: [{ gameId: 1, status: 'finished', rating: 11 }] }],
  [
    'more games than one change takes',
    { changes: Array.from({ length: 2001 }, (_, i) => ({ gameId: i + 1, status: 'hidden' })) },
  ],
])('refuses %s', async (_, body) => {
  expect((await move(body)).status).toBe(400);
  expect(applyStatusChanges).not.toHaveBeenCalled();
});

it("moves the caller's games, and answers with what each had, for Undo", async () => {
  const changes = [
    { gameId: 1, status: 'hidden' },
    { gameId: 2, status: 'finished', notes: 'Loved it', rating: 9 },
  ];

  const res = await move({ changes });

  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ success: true, count: 2, previous: [was(1), was(2)] });
  expect(applyStatusChanges).toHaveBeenCalledWith(expect.anything(), user!.id, changes);
  expect(restoreGames).not.toHaveBeenCalled();
});

describe('an Undo', () => {
  const games = [
    was(1, { started_at: '2026-02-28T17:43:40.217+00:00', notes: '' }),
    was(2, { status: 'finished', finished_at: '2026-10-25T00:00:00+00:00', rating: 9 }),
  ];

  it('writes the games back as they were, not through a status change', async () => {
    const res = await move({ restore: games });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, count: 2 });
    expect(restoreGames).toHaveBeenCalledWith(expect.anything(), user!.id, games);
    expect(applyStatusChanges).not.toHaveBeenCalled();
  });

  it.each([
    ['Playing', [was(1, { status: 'playing' })]],
    ['a date that is not one', [was(1, { finished_at: 'yesterday' })]],
    ['a rating out of range', [was(1, { rating: 11 })]],
    ['a game missing what it had', [{ id: 1, status: 'backlog' }]],
    ['no games', []],
  ])('refuses %s', async (_, restore) => {
    expect((await move({ restore })).status).toBe(400);
    expect(restoreGames).not.toHaveBeenCalled();
  });

  it("answers with the rules' refusal", async () => {
    jest
      .mocked(restoreGames)
      .mockResolvedValue({ ok: false, status: 404, error: 'Game not found' });
    expect((await move({ restore: games })).status).toBe(404);
  });
});

it('takes as many games as a big library has', async () => {
  const changes = Array.from({ length: 2000 }, (_, i) => ({ gameId: i + 1, status: 'wont_play' }));
  expect((await move({ changes })).status).toBe(200);
});

it("answers with the rules' refusal", async () => {
  jest.mocked(applyStatusChanges).mockResolvedValue({
    ok: false,
    status: 404,
    error: 'Game not found',
  });

  const res = await move({ changes: [{ gameId: 1, status: 'hidden' }] });

  expect(res.status).toBe(404);
  expect(await res.json()).toEqual({ error: 'Game not found' });
});
