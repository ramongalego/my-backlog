import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { useSwitchGame } from '@/hooks/useSwitchGame';
import { updateGameStatus } from '@/lib/games/status';
import { removeFromQueue, reorderQueue } from '@/lib/games/queue';
import { queryKeys } from '@/lib/query-keys';
import type { QueueItem } from '@/types/games';

jest.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));
jest.mock('sonner', () => ({ toast: Object.assign(jest.fn(), { error: jest.fn() }) }));
jest.mock('@/lib/mutations', () => ({
  useInvalidateQueries: () => ({ statusChanged: jest.fn() }),
  usePatchGamesList: () => ({ patch: jest.fn(), restore: jest.fn() }),
}));
jest.mock('@/lib/games/status', () => ({ updateGameStatus: jest.fn() }));
jest.mock('@/lib/games/queue', () => ({ removeFromQueue: jest.fn(), reorderQueue: jest.fn() }));

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

it('undo puts a backlog game back in the backlog, off the queue', async () => {
  const { result, queryClient } = setup([queued(metroid, 0)]);
  await act(() => result.current.switchTo(momodora));
  await undo();

  await waitFor(() => expect(removeFromQueue).toHaveBeenCalledWith(2));
  expect(updateGameStatus).toHaveBeenCalledWith(1, 'playing', { pausePlaying: true });
  expect(updateGameStatus).toHaveBeenLastCalledWith(2, 'backlog');
  expect(reorderQueue).not.toHaveBeenCalled();
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
  await undo();

  await waitFor(() =>
    expect(updateGameStatus).toHaveBeenLastCalledWith(2, 'finished', {
      finishedAt: '2025-08-20',
      droppedAt: undefined,
      notes: 'Loved it',
      rating: 9,
    }),
  );
  expect(removeFromQueue).not.toHaveBeenCalled();
  expect(result.current.playing?.id).toBe(1);
  expect(ids(queryClient)).toEqual([3]);
});

it('undo puts a queued game back in its place', async () => {
  const { result, queryClient } = setup([queued(metroid, 0), queued(momodora, 1)]);
  await act(() => result.current.switchTo(momodora));
  await waitFor(() => expect(ids(queryClient)).toEqual([1, 3]));
  await undo();

  await waitFor(() => expect(reorderQueue).toHaveBeenCalledWith([3, 2]));
  expect(updateGameStatus).toHaveBeenLastCalledWith(2, 'backlog');
  expect(ids(queryClient)).toEqual([3, 2]);
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

it("does nothing for the game that's already playing", async () => {
  const { result } = setup([]);
  await act(() => result.current.switchTo(zelda));
  expect(updateGameStatus).not.toHaveBeenCalled();
});
