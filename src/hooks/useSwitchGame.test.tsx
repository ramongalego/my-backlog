import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { useSwitchGame } from '@/hooks/useSwitchGame';
import { updateGameStatus } from '@/lib/client/game-status';
import { removeFromQueue, reorderQueue } from '@/lib/client/queue';
import { queryKeys } from '@/lib/query-keys';
import type { QueueItem } from '@/types/games';

jest.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));
jest.mock('sonner', () => ({ toast: Object.assign(jest.fn(), { error: jest.fn() }) }));
jest.mock('@/hooks/useGameMutations', () => ({
  useInvalidateQueries: () => ({ statusChanged: jest.fn() }),
  usePatchGamesList: () => ({ patch: jest.fn(), restore: jest.fn() }),
}));
jest.mock('@/lib/client/game-status', () => ({ updateGameStatus: jest.fn() }));
jest.mock('@/lib/client/queue', () => ({ removeFromQueue: jest.fn(), reorderQueue: jest.fn() }));

const game = (id: number, name: string) => ({
  id,
  app_id: null,
  name,
  header_image: null,
  main_story_hours: null,
  playtime_forever: 0,
});
const zelda = game(1, 'Zelda');
const momodora = game(2, 'Momodora');
const queued = (g: ReturnType<typeof game>, position: number): QueueItem => ({
  id: 100 + g.id,
  game_id: g.id,
  position,
  game: { ...g, steam_review_score: null },
});
const metroid = game(3, 'Metroid Dread');

function setup(queue: QueueItem[]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
  queryClient.setQueryData(queryKeys.games.playing('u'), zelda);
  queryClient.setQueryData(queryKeys.queue.list('u'), queue);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { ...renderHook(() => useSwitchGame('u'), { wrapper }), queryClient };
}

const ids = (client: QueryClient) =>
  client.getQueryData<QueueItem[]>(queryKeys.queue.list('u'))?.map((q) => q.game_id);

/** Presses Undo on the switch's toast. */
async function undo() {
  await waitFor(() => expect(toast).toHaveBeenCalled());
  const [, options] = jest.mocked(toast).mock.calls[0] as unknown as [
    string,
    { action: { onClick: () => void } },
  ];
  act(() => options.action.onClick());
}

/** Presses Undo, and waits until everything it sends has been answered. */
async function undone(result: { current: ReturnType<typeof useSwitchGame> }) {
  await undo();
  await waitFor(() => expect(result.current.playing?.id).toBe(1));
  await waitFor(() => expect(result.current.isPending).toBe(false));
}

/**
 * Stops the clock (the timers stay real), so a test can let an exact time
 * pass between a switch and its Undo.
 */
let clock: jest.SpyInstance | undefined;
function stopClock() {
  let now = Date.parse('2026-11-17T12:00:00Z');
  clock = jest.spyOn(Date, 'now').mockImplementation(() => now);
  return { pass: (ms: number) => void (now += ms) };
}

/** Every request sent, in the order they went out, across the status and queue routes. */
function sentInOrder() {
  const requests = <A extends unknown[]>(
    send: (...args: A) => unknown,
    say: (...args: A) => string,
  ) => {
    const { calls, invocationCallOrder } = jest.mocked(send).mock;
    return calls.map((args, i) => [invocationCallOrder[i], say(...(args as A))] as const);
  };
  return [
    ...requests(updateGameStatus, (id, status) => `status ${id} ${status}`),
    ...requests(reorderQueue, (order) => `reorder ${order.join(',')}`),
    ...requests(removeFromQueue, (id) => `remove ${id}`),
  ]
    .sort(([a], [b]) => a - b)
    .map(([, request]) => request);
}

beforeEach(() => {
  // The server reports the game it paused: Zelda, unless Zelda is being resumed.
  jest
    .mocked(updateGameStatus)
    .mockReset()
    .mockImplementation(async (id, _status, opts) => ({
      paused: opts?.pausePlaying && id !== 1 ? [{ id: 1, name: 'Zelda' }] : [],
    }));
  jest.mocked(removeFromQueue).mockReset().mockResolvedValue(undefined);
  jest.mocked(reorderQueue).mockReset().mockResolvedValue(undefined);
  jest.mocked(toast).mockClear();
});

afterEach(() => {
  clock?.mockRestore();
  clock = undefined;
});

it('plays a backlog game, pausing the one being played at the top of the queue', async () => {
  const { result, queryClient } = setup([queued(metroid, 0)]);

  await act(() => result.current.switchTo(momodora));

  await waitFor(() => expect(result.current.playing?.id).toBe(2));
  expect(ids(queryClient)).toEqual([1, 3]);
  expect(updateGameStatus).toHaveBeenCalledWith(2, 'playing', { pausePlaying: true });
  expect(toast).toHaveBeenCalledWith(
    'Now playing Momodora. Zelda is first in your queue.',
    expect.anything(),
  );
});

it('undo puts a backlog game back in the backlog in one request, off the queue', async () => {
  const { result, queryClient } = setup([queued(metroid, 0)]);
  await act(() => result.current.switchTo(momodora));
  await undone(result);

  // The switch itself was an ordinary change.
  expect(updateGameStatus).toHaveBeenNthCalledWith(1, 2, 'playing', { pausePlaying: true });
  // The Undo says it is one, and how long ago the switch was, so the history
  // takes the switch back out instead of recording a second one. Momodora
  // isn't paused at the top of the queue on the way: starting Zelda again
  // sends it straight back to the backlog, in the same save.
  expect(updateGameStatus).toHaveBeenNthCalledWith(2, 1, 'playing', {
    pausePlaying: false,
    undo: true,
    undoAgoMs: expect.any(Number),
  });
  // And that is all of it.
  expect(sentInOrder()).toEqual(['status 2 playing', 'status 1 playing']);
  expect(result.current.playing?.id).toBe(1);
  expect(ids(queryClient)).toEqual([3]);
});

it('undo puts a finished game back as finished, with its date, notes and rating', async () => {
  const { result, queryClient } = setup([queued(metroid, 0)]);
  await act(() =>
    result.current.switchTo(momodora, {
      status: 'finished',
      date: '2025-08-20',
      notes: 'Loved it',
      rating: 9,
    }),
  );
  await undone(result);

  // Zelda first, which sends Momodora to the backlog; then Momodora as it was.
  expect(updateGameStatus).toHaveBeenNthCalledWith(2, 1, 'playing', {
    pausePlaying: false,
    undo: true,
    undoAgoMs: expect.any(Number),
  });
  expect(updateGameStatus).toHaveBeenNthCalledWith(3, 2, 'finished', {
    finishedAt: '2025-08-20',
    droppedAt: undefined,
    notes: 'Loved it',
    rating: 9,
    undo: true,
    undoAgoMs: expect.any(Number),
    // The switch didn't say it had ever been started: none to put back.
    startedAt: null,
  });
  expect(sentInOrder()).toEqual(['status 2 playing', 'status 1 playing', 'status 2 finished']);
  expect(result.current.playing?.id).toBe(1);
  expect(ids(queryClient)).toEqual([3]);
});

it('undo puts a finished game back as started when it had been: the date the switch reported', async () => {
  // Playing Momodora again stamped its start with now; the server answered
  // the switch with the start date it had before.
  jest.mocked(updateGameStatus).mockResolvedValueOnce({
    paused: [{ id: 1, name: 'Zelda' }],
    startedAt: '2025-08-01T10:00:00+00:00',
  });
  const { result } = setup([queued(metroid, 0)]);
  await act(() =>
    result.current.switchTo(momodora, {
      status: 'finished',
      date: '2025-08-20',
      notes: 'Loved it',
      rating: 9,
    }),
  );
  await undone(result);

  expect(updateGameStatus).toHaveBeenNthCalledWith(3, 2, 'finished', {
    finishedAt: '2025-08-20',
    droppedAt: undefined,
    notes: 'Loved it',
    rating: 9,
    undo: true,
    undoAgoMs: expect.any(Number),
    startedAt: '2025-08-01T10:00:00+00:00',
  });
  expect(updateGameStatus).toHaveBeenCalledTimes(3);
});

it.each([
  [
    'a dropped game back as dropped, with its date and notes',
    { status: 'dropped', date: '2025-08-20', notes: 'Not for me', rating: null },
    { finishedAt: undefined, droppedAt: '2025-08-20', notes: 'Not for me', rating: null },
  ],
  [
    "a game you won't play back there",
    { status: 'wont_play' },
    { finishedAt: undefined, droppedAt: undefined, notes: undefined, rating: null },
  ],
] as const)(
  'undo puts %s, sending the start date the switch reported',
  async (_, from, restored) => {
    jest.mocked(updateGameStatus).mockResolvedValueOnce({
      paused: [{ id: 1, name: 'Zelda' }],
      startedAt: '2025-08-01T10:00:00+00:00',
    });
    const { result } = setup([queued(metroid, 0)]);
    await act(() => result.current.switchTo(momodora, from));
    await undone(result);

    expect(updateGameStatus).toHaveBeenNthCalledWith(2, 1, 'playing', {
      pausePlaying: false,
      undo: true,
      undoAgoMs: expect.any(Number),
    });
    expect(updateGameStatus).toHaveBeenNthCalledWith(3, 2, from.status, {
      ...restored,
      undo: true,
      undoAgoMs: expect.any(Number),
      startedAt: '2025-08-01T10:00:00+00:00',
    });
    expect(sentInOrder()).toEqual([
      'status 2 playing',
      'status 1 playing',
      `status 2 ${from.status}`,
    ]);
  },
);

it.each([
  ['the date it had', '2026-11-16T12:11:47.090Z'],
  ['none, when it had none', null],
])('undo puts the paused game back as last played when it was: %s', async (_, lastPlayedAt) => {
  const { result, queryClient } = setup([queued(metroid, 0)]);
  // Pausing a console game stamps it as last played now.
  queryClient.setQueryData(queryKeys.games.playing('u'), {
    ...zelda,
    last_played_at: lastPlayedAt,
  });
  await act(() => result.current.switchTo(momodora));
  await undone(result);

  expect(updateGameStatus).toHaveBeenNthCalledWith(2, 1, 'playing', {
    pausePlaying: false,
    undo: true,
    undoAgoMs: expect.any(Number),
    lastPlayedAt,
  });
  expect(updateGameStatus).toHaveBeenCalledTimes(2);
});

it("undo leaves the paused game's last-played date alone when it wasn't the game the page had", async () => {
  // Switched to Castlevania on another device: the page still shows Zelda.
  jest.mocked(updateGameStatus).mockResolvedValueOnce({ paused: [{ id: 7, name: 'Castlevania' }] });
  const { result, queryClient } = setup([]);
  queryClient.setQueryData(queryKeys.games.playing('u'), {
    ...zelda,
    last_played_at: '2026-11-16T12:11:47.090Z',
  });
  await act(() => result.current.switchTo(momodora));
  await undo();

  await waitFor(() => expect(updateGameStatus).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(result.current.isPending).toBe(false));
  const [id, status, sent] = jest.mocked(updateGameStatus).mock.calls[1];
  expect([id, status]).toEqual([7, 'playing']);
  expect(sent).toEqual({ pausePlaying: false, undo: true, undoAgoMs: expect.any(Number) });
  expect(sent).not.toHaveProperty('lastPlayedAt');
});

it('undo puts a queued game back in its place', async () => {
  const { result, queryClient } = setup([queued(metroid, 0), queued(momodora, 1)]);
  await act(() => result.current.switchTo(momodora));
  await waitFor(() => expect(ids(queryClient)).toEqual([1, 3]));
  await undone(result);

  // Momodora goes back to its place, so it waits at the top of the queue
  // (paused) while Zelda starts again.
  expect(updateGameStatus).toHaveBeenNthCalledWith(2, 1, 'playing', {
    pausePlaying: true,
    undo: true,
    undoAgoMs: expect.any(Number),
  });
  // It wasn't really started: its start date is cleared.
  expect(updateGameStatus).toHaveBeenNthCalledWith(3, 2, 'backlog', {
    undo: true,
    undoAgoMs: expect.any(Number),
  });
  expect(reorderQueue).toHaveBeenCalledWith([3, 2]);
  expect(sentInOrder()).toEqual([
    'status 2 playing',
    'status 1 playing',
    'status 2 backlog',
    'reorder 3,2',
  ]);
  expect(ids(queryClient)).toEqual([3, 2]);
});

it('undo puts a queued game that was paused itself back in its place, still started', async () => {
  // Momodora had been paused for Zelda earlier: it kept its start date in the queue.
  const paused = queued(momodora, 1);
  paused.game.started_at = '2026-11-01T09:00:00+00:00';
  const { result, queryClient } = setup([queued(metroid, 0), paused]);
  await act(() => result.current.switchTo(momodora));
  await waitFor(() => expect(ids(queryClient)).toEqual([1, 3]));
  await undone(result);

  expect(updateGameStatus).toHaveBeenNthCalledWith(2, 1, 'playing', {
    pausePlaying: true,
    undo: true,
    undoAgoMs: expect.any(Number),
  });
  // No write to the backlog, which would clear its start date.
  expect(sentInOrder()).toEqual(['status 2 playing', 'status 1 playing', 'reorder 3,2']);
  expect(ids(queryClient)).toEqual([3, 2]);
});

describe('every write of an Undo says how long ago the switch was: the time since its toast', () => {
  const sentTimes = () =>
    jest
      .mocked(updateGameStatus)
      .mock.calls.map(([id, status, opts]) => [id, status, opts?.undo, opts?.undoAgoMs]);

  it('for a backlog game', async () => {
    const time = stopClock();
    const { result } = setup([queued(metroid, 0)]);
    await act(() => result.current.switchTo(momodora));
    await waitFor(() => expect(toast).toHaveBeenCalled());

    // The toast waits while its tab is in the background: a minute and a half.
    time.pass(90_000);
    await undone(result);

    expect(sentTimes()).toEqual([
      // The switch is no Undo: it says no time.
      [2, 'playing', undefined, undefined],
      [1, 'playing', true, 90_000],
    ]);
  });

  it('for a queued game', async () => {
    const time = stopClock();
    const { result } = setup([queued(metroid, 0), queued(momodora, 1)]);
    await act(() => result.current.switchTo(momodora));
    await waitFor(() => expect(toast).toHaveBeenCalled());

    time.pass(90_000);
    await undone(result);

    expect(sentTimes()).toEqual([
      [2, 'playing', undefined, undefined],
      [1, 'playing', true, 90_000],
      [2, 'backlog', true, 90_000],
    ]);
  });

  it('for a finished game: the same time on both writes, though the second is sent later', async () => {
    const time = stopClock();
    // The clock moves on while the first write of the Undo is being saved.
    jest
      .mocked(updateGameStatus)
      .mockResolvedValueOnce({ paused: [{ id: 1, name: 'Zelda' }], startedAt: null })
      .mockImplementationOnce(async () => {
        time.pass(2_000);
        return { paused: [] };
      });
    const { result } = setup([queued(metroid, 0)]);
    await act(() => result.current.switchTo(momodora, { status: 'finished', date: '2025-08-20' }));
    await waitFor(() => expect(toast).toHaveBeenCalled());

    time.pass(90_000);
    await undone(result);

    expect(sentTimes()).toEqual([
      [2, 'playing', undefined, undefined],
      [1, 'playing', true, 90_000],
      [2, 'finished', true, 90_000],
    ]);
  });
});

it('names the game the server paused, even if the page thought another was playing', async () => {
  // Switched to Castlevania on another device: the page still shows Zelda.
  jest.mocked(updateGameStatus).mockResolvedValueOnce({ paused: [{ id: 7, name: 'Castlevania' }] });
  const { result } = setup([]);

  await act(() => result.current.switchTo(momodora));

  await waitFor(() =>
    expect(toast).toHaveBeenCalledWith(
      'Now playing Momodora. Castlevania is first in your queue.',
      expect.anything(),
    ),
  );
});

it('switches once, however many times Play is pressed before the page shows it', async () => {
  const { result } = setup([queued(metroid, 0)]);

  await act(async () => {
    void result.current.switchTo(momodora);
    void result.current.switchTo(momodora);
    await result.current.switchTo(momodora);
  });

  await waitFor(() => expect(toast).toHaveBeenCalled());
  expect(updateGameStatus).toHaveBeenCalledTimes(1);
  expect(toast).toHaveBeenCalledTimes(1);
});

it('can switch to the same game again later', async () => {
  const { result, queryClient } = setup([queued(metroid, 0)]);
  await act(() => result.current.switchTo(momodora));
  await waitFor(() => expect(toast).toHaveBeenCalledTimes(1));

  // Zelda is played again, then Momodora once more.
  act(() => queryClient.setQueryData(queryKeys.games.playing('u'), zelda));
  await act(() => result.current.switchTo(momodora));

  await waitFor(() => expect(updateGameStatus).toHaveBeenCalledTimes(2));
});

it('undoes a switch once, however many times Undo is pressed', async () => {
  const { result } = setup([queued(metroid, 0)]);
  await act(() => result.current.switchTo(momodora));
  await waitFor(() => expect(toast).toHaveBeenCalled());
  const [, options] = jest.mocked(toast).mock.calls[0] as unknown as [
    string,
    { action: { onClick: () => void } },
  ];

  act(() => {
    options.action.onClick();
    options.action.onClick();
    options.action.onClick();
  });

  await waitFor(() => expect(result.current.playing?.id).toBe(1));
  await waitFor(() => expect(result.current.isPending).toBe(false));
  // The switch, and one Undo.
  expect(sentInOrder()).toEqual(['status 2 playing', 'status 1 playing']);
});

it("does nothing for the game that's already playing", async () => {
  const { result } = setup([]);
  await act(() => result.current.switchTo(zelda));
  expect(updateGameStatus).not.toHaveBeenCalled();
});
