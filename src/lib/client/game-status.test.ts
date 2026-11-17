import { updateGameStatus } from '@/lib/client/game-status';

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

const sentBody = () => JSON.parse(mockFetch.mock.calls.at(-1)![1].body as string);

beforeEach(() => {
  mockFetch.mockReset().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ success: true, paused: [{ id: 9, name: 'Zelda' }] }),
  });
});

it('sends a status change and resolves with the game the server paused', async () => {
  expect(await updateGameStatus(7, 'playing', { pausePlaying: true })).toEqual({
    paused: [{ id: 9, name: 'Zelda' }],
  });
  expect(mockFetch).toHaveBeenCalledWith(
    '/api/games/status',
    expect.objectContaining({ method: 'POST' }),
  );
  expect(sentBody()).toEqual({ gameId: 7, status: 'playing', pausePlaying: true });
});

it('says when the change is an Undo, and only then', async () => {
  await updateGameStatus(7, 'backlog', { undo: true });
  expect(sentBody()).toEqual({ gameId: 7, status: 'backlog', undo: true });

  await updateGameStatus(7, 'backlog');
  expect(sentBody()).toEqual({ gameId: 7, status: 'backlog' });

  await updateGameStatus(7, 'finished', { finishedAt: '2026-11-17', rating: 9, undo: false });
  expect(sentBody()).toEqual({
    gameId: 7,
    status: 'finished',
    finishedAt: '2026-11-17',
    rating: 9,
  });
});

it("throws with the server's reason when the change is refused", async () => {
  mockFetch.mockResolvedValue({
    ok: false,
    status: 404,
    json: async () => ({ error: 'Game not found' }),
  });
  await expect(updateGameStatus(7, 'backlog')).rejects.toThrow(
    'updateGameStatus failed (404): Game not found',
  );
});
