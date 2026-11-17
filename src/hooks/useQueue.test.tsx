import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useAddToQueue, useQueue, useRemoveFromQueue } from '@/hooks/useQueue';
import { toast } from 'sonner';
import { addToQueue, removeFromQueue, reorderQueue } from '@/lib/client/queue';
import { QUEUE_UNDO_TOAST } from '@/lib/games/queue-items';
import { loadQueue } from '@/lib/data/loaders';
import type { QueueItem } from '@/types/games';

jest.mock('sonner', () => ({
  toast: Object.assign(jest.fn(), { error: jest.fn(), success: jest.fn() }),
}));
jest.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));
jest.mock('@/lib/client/queue', () => ({
  addToQueue: jest.fn(),
  removeFromQueue: jest.fn(),
  reorderQueue: jest.fn(),
}));
jest.mock('@/lib/data/loaders', () => ({
  ...jest.requireActual('@/lib/data/loaders'),
  loadQueue: jest.fn(),
}));

const item = (game_id: number): QueueItem => ({
  id: game_id,
  game_id,
  position: game_id,
  game: {
    app_id: game_id,
    name: `Game ${game_id}`,
    header_image: null,
    playtime_forever: 0,
    main_story_hours: 10,
    steam_review_score: null,
  },
});

// What the server holds: a removal takes its game off when it's saved.
let server: QueueItem[] = [];
// Each removal's request, to be answered by the test.
let saves: { gameId: number; finish: () => void }[] = [];

function setup() {
  const queryClient = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return renderHook(() => ({ queue: useQueue('u').queue, remove: useRemoveFromQueue('u') }), {
    wrapper,
  });
}
const shown = (result: { current: { queue: QueueItem[] } }) =>
  result.current.queue.map((q) => q.game_id);

/**
 * Stops the clock (the timers stay real), so a test can let an exact time
 * pass between a removal and its Undo.
 */
let clock: jest.SpyInstance | undefined;
function stopClock() {
  let now = Date.parse('2026-11-17T12:00:00Z');
  clock = jest.spyOn(Date, 'now').mockImplementation(() => now);
  return { pass: (ms: number) => void (now += ms) };
}

afterEach(() => {
  clock?.mockRestore();
  clock = undefined;
});

beforeEach(() => {
  server = [item(1), item(2), item(3), item(4)];
  saves = [];
  jest.mocked(toast).mockClear();
  jest.mocked(addToQueue).mockReset().mockResolvedValue(undefined);
  jest.mocked(reorderQueue).mockReset().mockResolvedValue(undefined);
  jest
    .mocked(loadQueue)
    .mockReset()
    .mockImplementation(async () => [...server]);
  jest
    .mocked(removeFromQueue)
    .mockReset()
    .mockImplementation(
      (gameId) =>
        new Promise<void>((resolve) => {
          saves.push({
            gameId,
            finish: () => {
              server = server.filter((q) => q.game_id !== gameId);
              resolve();
            },
          });
        }),
    );
});

it('keeps games removed in quick succession off the list while they are saved one by one', async () => {
  const { result } = setup();
  await waitFor(() => expect(shown(result)).toEqual([1, 2, 3, 4]));
  const seen: number[][] = [];
  const record = () => seen.push(shown(result));

  // Three removals before the first is saved: all three leave at once.
  act(() => {
    result.current.remove(2);
    result.current.remove(3);
    result.current.remove(4);
  });
  await waitFor(() => expect(shown(result)).toEqual([1]));
  record();

  // They're saved in turn. After each, the list on screen still has only
  // game 1: reading the queue back before the last is saved would bring the
  // ones still waiting back for a moment.
  for (const gameId of [2, 3, 4]) {
    await waitFor(() => expect(saves.some((s) => s.gameId === gameId)).toBe(true));
    await act(async () => {
      saves.find((s) => s.gameId === gameId)!.finish();
      await new Promise((r) => setTimeout(r, 20));
    });
    record();
  }

  expect(seen).toEqual([[1], [1], [1], [1]]);
  // Read once on load, and once more after the last removal.
  await waitFor(() => expect(loadQueue).toHaveBeenCalledTimes(2));
  expect(shown(result)).toEqual([1]);
});

it('still reads the queue back after a single removal', async () => {
  const { result } = setup();
  await waitFor(() => expect(shown(result)).toEqual([1, 2, 3, 4]));

  act(() => result.current.remove(3));
  await waitFor(() => expect(saves).toHaveLength(1));
  await act(async () => saves[0].finish());

  await waitFor(() => expect(loadQueue).toHaveBeenCalledTimes(2));
  expect(shown(result)).toEqual([1, 2, 4]);
});

it('puts a removed game back once, however many times Undo is pressed', async () => {
  const { result } = setup();
  await waitFor(() => expect(shown(result)).toEqual([1, 2, 3, 4]));

  act(() => result.current.remove(4));
  await waitFor(() => expect(saves).toHaveLength(1));
  await act(async () => saves[0].finish());
  await waitFor(() => expect(toast).toHaveBeenCalled());
  const [said, options] = jest.mocked(toast).mock.calls[0] as unknown as [
    string,
    { id: string; action: { onClick: () => void } },
  ];
  expect(said).toBe('Moved Game 4 to your backlog');
  // The queue's one Undo toast: a later change takes its place.
  expect(options.id).toBe(QUEUE_UNDO_TOAST);

  act(() => {
    options.action.onClick();
    options.action.onClick();
  });

  await waitFor(() => expect(addToQueue).toHaveBeenCalled());
  expect(addToQueue).toHaveBeenCalledTimes(1);
  // Sent as an Undo: with how long ago the game was taken off, for the history.
  expect(addToQueue).toHaveBeenCalledWith(4, expect.any(Number));
});

it('tells the server how long the Undo waited: the time since the removal was saved', async () => {
  const time = stopClock();
  const { result } = setup();
  await waitFor(() => expect(shown(result)).toEqual([1, 2, 3, 4]));

  act(() => result.current.remove(2));
  await waitFor(() => expect(saves).toHaveLength(1));
  // The save itself takes a while: the Undo is timed from when it's done,
  // as the toast appears.
  time.pass(4_000);
  await act(async () => saves[0].finish());
  await waitFor(() => expect(toast).toHaveBeenCalled());
  const [, options] = jest.mocked(toast).mock.calls[0] as unknown as [
    string,
    { action: { onClick: () => void } },
  ];

  // The toast waits while its tab is in the background: a minute and a half.
  time.pass(90_000);
  act(() => options.action.onClick());

  await waitFor(() => expect(addToQueue).toHaveBeenCalledWith(2, 90_000));
  // Back in its old place, second: the server adds it last.
  await waitFor(() => expect(reorderQueue).toHaveBeenCalledWith([1, 2, 3, 4]));
  expect(addToQueue).toHaveBeenCalledTimes(1);
});

describe('adding a game to the queue', () => {
  const game = {
    id: 9,
    app_id: 9,
    name: 'Game 9',
    header_image: null,
    main_story_hours: 10,
    playtime_forever: 0,
  };
  const setupAdd = () => {
    const queryClient = new QueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    return renderHook(() => ({ queue: useQueue('u').queue, add: useAddToQueue('u') }), { wrapper });
  };

  it('adds it once, however many times Add to Queue is pressed', async () => {
    const { result } = setupAdd();
    await waitFor(() => expect(shown(result)).toEqual([1, 2, 3, 4]));

    act(() => {
      result.current.add(game);
      result.current.add(game);
      result.current.add(game);
    });

    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(addToQueue).toHaveBeenCalledTimes(1);
    // An ordinary add, not an Undo: no time goes with it.
    expect(addToQueue).toHaveBeenCalledWith(9);
    expect(toast.success).toHaveBeenCalledTimes(1);
  });

  it('leaves a game that is queued already alone', async () => {
    const { result } = setupAdd();
    await waitFor(() => expect(shown(result)).toEqual([1, 2, 3, 4]));

    act(() => result.current.add({ ...game, id: 2 }));

    expect(addToQueue).not.toHaveBeenCalled();
    expect(shown(result)).toEqual([1, 2, 3, 4]);
  });
});
