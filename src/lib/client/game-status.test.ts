import { updateGameStatus } from '@/lib/client/game-status';

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

const sentBody = () => JSON.parse(mockFetch.mock.calls.at(-1)![1].body as string);

const answers = (body: unknown) =>
  mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => body });

beforeEach(() => {
  mockFetch.mockReset();
  answers({ success: true, paused: [{ id: 9, name: 'Zelda' }] });
});

it('sends a status change and resolves with the game the server paused', async () => {
  expect(await updateGameStatus(7, 'playing', { pausePlaying: true })).toEqual({
    paused: [{ id: 9, name: 'Zelda' }],
    // The server didn't say when the game had been started.
    startedAt: null,
  });
  expect(mockFetch).toHaveBeenCalledWith(
    '/api/games/status',
    expect.objectContaining({ method: 'POST' }),
  );
  expect(sentBody()).toEqual({ gameId: 7, status: 'playing', pausePlaying: true });
});

it('resolves with when the server says the game had been started before the change', async () => {
  answers({ success: true, paused: [], startedAt: '2026-11-13T13:57:00+00:00' });
  expect(await updateGameStatus(7, 'playing', { pausePlaying: true })).toEqual({
    paused: [],
    startedAt: '2026-11-13T13:57:00+00:00',
  });

  // It had never been started.
  answers({ success: true, paused: [], startedAt: null });
  expect(await updateGameStatus(7, 'playing')).toEqual({ paused: [], startedAt: null });

  // An answer that can't be read says nothing.
  mockFetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => {
      throw new SyntaxError('not JSON');
    },
  });
  expect(await updateGameStatus(7, 'playing')).toEqual({ paused: [], startedAt: null });
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

it('says how long ago the change was with its Undo, and never without one', async () => {
  await updateGameStatus(7, 'backlog', { undo: true, undoAgoMs: 90_000 });
  expect(sentBody()).toEqual({ gameId: 7, status: 'backlog', undo: true, undoAgoMs: 90_000 });

  // Pressed the moment the toast appeared: no time at all is still sent.
  await updateGameStatus(7, 'backlog', { undo: true, undoAgoMs: 0 });
  expect(sentBody()).toEqual({ gameId: 7, status: 'backlog', undo: true, undoAgoMs: 0 });

  await updateGameStatus(7, 'backlog', { undoAgoMs: 90_000 });
  expect(sentBody()).toEqual({ gameId: 7, status: 'backlog' });

  await updateGameStatus(7, 'backlog', { undo: false, undoAgoMs: 90_000 });
  expect(sentBody()).toEqual({ gameId: 7, status: 'backlog' });
});

it('sends when the game had been started and last played with an Undo that puts it back', async () => {
  await updateGameStatus(7, 'playing', {
    undo: true,
    startedAt: '2026-11-13T13:57:00+00:00',
    lastPlayedAt: null,
  });
  expect(sentBody()).toEqual({
    gameId: 7,
    status: 'playing',
    undo: true,
    startedAt: '2026-11-13T13:57:00+00:00',
    lastPlayedAt: null,
  });

  // That it had never been started is sent too: a game going back to
  // finished loses the start date that playing it gave it.
  await updateGameStatus(7, 'finished', { undo: true, startedAt: null });
  expect(sentBody()).toEqual({ gameId: 7, status: 'finished', undo: true, startedAt: null });

  // Not told when: nothing is sent, and the server decides.
  await updateGameStatus(7, 'playing', { undo: true });
  expect(sentBody()).toEqual({ gameId: 7, status: 'playing', undo: true });

  // And never without an Undo.
  await updateGameStatus(7, 'playing', {
    startedAt: '2026-11-13T13:57:00+00:00',
    lastPlayedAt: null,
  });
  expect(sentBody()).toEqual({ gameId: 7, status: 'playing' });

  await updateGameStatus(7, 'finished', { startedAt: null });
  expect(sentBody()).toEqual({ gameId: 7, status: 'finished' });
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
