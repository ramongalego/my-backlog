import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { useNowPlaying } from '@/hooks/useNowPlaying';
import { reorderQueue } from '@/lib/games/queue';
import { queryKeys } from '@/lib/query-keys';
import type { QueueItem } from '@/types/games';

jest.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));
// A server holding the last saved order, which the queue refetches from.
let server: QueueItem[] = [];
jest.mock('@/lib/data/loaders', () => ({
  ...jest.requireActual('@/lib/data/loaders'),
  loadQueue: async () => server,
  loadCurrentlyPlaying: async () => null,
}));
jest.mock('@/lib/confetti', () => ({ celebrateGameFinished: jest.fn() }));
jest.mock('sonner', () => ({
  toast: Object.assign(jest.fn(), { error: jest.fn(), success: jest.fn() }),
}));
jest.mock('@/lib/mutations', () => ({
  useInvalidateQueries: () => ({ statusChanged: jest.fn(), queue: jest.fn() }),
  usePatchGamesList: () => ({ patch: jest.fn(), restore: jest.fn() }),
  useSetGameStatus: () => ({ mutate: jest.fn(), isPending: false }),
}));
jest.mock('@/lib/games/queue', () => ({
  ...jest.requireActual('@/lib/games/queue'),
  reorderQueue: jest.fn(),
}));

const item = (gameId: number, name: string, position: number): QueueItem => ({
  id: gameId * 10,
  game_id: gameId,
  position,
  game: {
    app_id: null,
    name,
    header_image: null,
    playtime_forever: 0,
    main_story_hours: null,
    steam_review_score: null,
  },
});
const QUEUE = [item(1, 'A', 0), item(2, 'B', 1), item(3, 'C', 2), item(4, 'D', 3)];
const queueKey = queryKeys.queue.list('u');

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
  queryClient.setQueryData(queryKeys.games.playing('u'), null);
  queryClient.setQueryData(queueKey, QUEUE);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useNowPlaying('u'), { wrapper });
  const order = () =>
    (queryClient.getQueryData<QueueItem[]>(queueKey) ?? []).map((q) => q.game.name);
  // The Undo on the n-th "Moved … to the top" message.
  const undo = (n = 0) =>
    (
      jest.mocked(toast).mock.calls[n][1] as unknown as { action: { onClick: () => void } }
    ).action.onClick();
  return { result, queryClient, order, undo };
}

beforeEach(() => {
  jest.clearAllMocks();
  server = QUEUE;
  jest.mocked(reorderQueue).mockImplementation(async (gameIds) => {
    const byId = new Map(server.map((q) => [q.game_id, q]));
    server = gameIds.map((id, i) => ({ ...byId.get(id)!, position: i }));
  });
});

it('moves a game to the front at once and saves the new order', async () => {
  const { result, order } = setup();

  act(() => {
    expect(result.current.moveToTop(3)).toBe(true);
  });

  expect(order()).toEqual(['C', 'A', 'B', 'D']);
  await waitFor(() => expect(reorderQueue).toHaveBeenCalledWith([3, 1, 2, 4]));
  expect(toast).toHaveBeenCalledWith('Moved C to the top', expect.anything());
});

it('does nothing for the first game, or one no longer queued', () => {
  const { result, order } = setup();

  act(() => {
    expect(result.current.moveToTop(1)).toBe(false);
    expect(result.current.moveToTop(99)).toBe(false);
  });

  expect(order()).toEqual(['A', 'B', 'C', 'D']);
  expect(reorderQueue).not.toHaveBeenCalled();
  expect(toast).not.toHaveBeenCalled();
});

it('builds quick moves in a row on each other, saving them in order', async () => {
  const { result, order } = setup();

  act(() => {
    result.current.moveToTop(4);
    result.current.moveToTop(3);
  });

  expect(order()).toEqual(['C', 'D', 'A', 'B']);
  await waitFor(() => expect(reorderQueue).toHaveBeenCalledTimes(2));
  expect(jest.mocked(reorderQueue).mock.calls).toEqual([[[4, 1, 2, 3]], [[3, 4, 1, 2]]]);
});

it('puts the game back where it was on Undo', async () => {
  const { result, order, undo } = setup();

  act(() => {
    result.current.moveToTop(3);
  });
  await waitFor(() => expect(reorderQueue).toHaveBeenCalledTimes(1));
  act(() => undo());

  expect(order()).toEqual(['A', 'B', 'C', 'D']);
  await waitFor(() => expect(reorderQueue).toHaveBeenLastCalledWith([1, 2, 3, 4]));
});

it('keeps later moves when undoing an earlier one', async () => {
  const { result, order, undo } = setup();

  act(() => {
    result.current.moveToTop(3); // C A B D
    result.current.moveToTop(4); // D C A B
  });
  await waitFor(() => expect(reorderQueue).toHaveBeenCalledTimes(2));
  // C was third: it goes back to third, and D stays on top.
  act(() => undo(0));

  expect(order()).toEqual(['D', 'A', 'C', 'B']);
});

it('ignores Undo once the game has left the queue', async () => {
  const { result, queryClient, order, undo } = setup();

  act(() => {
    result.current.moveToTop(3);
  });
  await waitFor(() => expect(reorderQueue).toHaveBeenCalledTimes(1));
  // Started or moved to the backlog meanwhile.
  queryClient.setQueryData<QueueItem[]>(queueKey, (old) => old?.filter((q) => q.game_id !== 3));
  act(() => undo());

  expect(order()).toEqual(['A', 'B', 'D']);
  expect(reorderQueue).toHaveBeenCalledTimes(1);
});

it('goes back to the old order, and says so, if saving fails', async () => {
  jest.mocked(reorderQueue).mockRejectedValue(new Error('offline'));
  const { result, order } = setup();

  act(() => {
    result.current.moveToTop(3);
  });

  await waitFor(() => expect(order()).toEqual(['A', 'B', 'C', 'D']));
  expect(toast.error).toHaveBeenCalledWith('Failed to reorder queue');
});

it("never shows an older order while quick moves are saving, and ends on the server's", async () => {
  const { result, queryClient, order } = setup();
  const seen: string[] = [];
  queryClient.getQueryCache().subscribe(() => {
    const now = order().join('');
    if (seen[seen.length - 1] !== now) seen.push(now);
  });

  act(() => {
    result.current.moveToTop(4); // DABC
    result.current.moveToTop(3); // CDAB
  });
  await waitFor(() => expect(reorderQueue).toHaveBeenCalledTimes(2));
  // The refetch after the last save brings the saved order.
  await waitFor(() => expect(server.map((q) => q.game.name).join('')).toBe('CDAB'));

  expect(seen.slice(seen.indexOf('CDAB'))).toEqual(['CDAB']);
  expect(order().join('')).toBe('CDAB');
});
