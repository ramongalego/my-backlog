import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useNowPlaying } from '@/hooks/useNowPlaying';
import { toast } from 'sonner';
import { completeGame, updateGameStatus } from '@/lib/client/game-status';
import { reorderQueue } from '@/lib/client/queue';
import { queryKeys } from '@/lib/query-keys';

jest.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));
jest.mock('@/lib/confetti', () => ({ celebrateGameFinished: jest.fn() }));
jest.mock('sonner', () => ({
  toast: Object.assign(jest.fn(), { error: jest.fn(), success: jest.fn() }),
}));
jest.mock('@/hooks/useGameMutations', () => ({
  useInvalidateQueries: () => ({ statusChanged: jest.fn(), queue: jest.fn() }),
  usePatchGamesList: () => ({ patch: jest.fn(), restore: jest.fn() }),
  useSetGameStatus: () => ({ mutate: jest.fn(), isPending: false }),
}));
jest.mock('@/lib/client/game-status', () => ({
  ...jest.requireActual('@/lib/client/game-status'),
  completeGame: jest.fn(),
  updateGameStatus: jest.fn(),
}));
jest.mock('@/lib/client/queue', () => ({
  ...jest.requireActual('@/lib/client/queue'),
  reorderQueue: jest.fn(),
}));

const playing = {
  id: 1,
  app_id: 1,
  name: 'SteamWorld Dig',
  header_image: null,
  main_story_hours: 5,
  playtime_forever: 300,
};
const queued = {
  id: 10,
  game_id: 2,
  position: 0,
  game: {
    app_id: null,
    name: 'Final Fantasy Resonance',
    header_image: null,
    playtime_forever: 0,
    main_story_hours: null,
    steam_review_score: null,
  },
};

const steamWorldPaused = { id: 1, name: 'SteamWorld Dig' };
const metroidPaused = { id: 3, name: 'Metroid Dread' };
const queuedDread = {
  id: 11,
  game_id: 3,
  position: 1,
  game: { ...queued.game, name: 'Metroid Dread' },
};

function setup({ queue = [queued] as unknown[], nowPlaying = playing as unknown } = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
  queryClient.setQueryData(queryKeys.games.playing('u'), nowPlaying);
  queryClient.setQueryData(queryKeys.queue.list('u'), queue);
  queryClient.setQueryData(queryKeys.library.meta('u'), {
    gameCount: 192,
    historyCount: 50,
    backlogCount: 100,
    finishedCount: 40,
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { ...renderHook(() => useNowPlaying('u'), { wrapper }), queryClient };
}

beforeEach(() => {
  jest.mocked(completeGame).mockReset();
  // The server reports the game it paused: whichever game was playing.
  jest
    .mocked(updateGameStatus)
    .mockReset()
    .mockImplementation(async (id, _status, opts) => ({
      paused: opts?.pausePlaying ? [id === 1 ? metroidPaused : steamWorldPaused] : [],
    }));
  jest.mocked(reorderQueue).mockReset().mockResolvedValue(undefined);
  jest.mocked(toast).mockClear();
});

it('opens the summary as soon as a game is saved as finished, before the server answers', async () => {
  let answer!: (value: Awaited<ReturnType<typeof completeGame>>) => void;
  jest.mocked(completeGame).mockReturnValue(new Promise((resolve) => (answer = resolve)));
  const { result } = setup();

  act(() => result.current.confirmStatusChange('finished', '2026-10-28', '', 8));

  // From what's already known: one more finished game, the first queued next.
  expect(result.current.statusModal).toBeNull();
  expect(result.current.gameSummary).toMatchObject({
    gameName: 'SteamWorld Dig',
    gamesFinished: 41,
    totalGames: 192,
    nextGame: 'Final Fantasy Resonance',
    rating: 8,
  });

  // The server's figures replace the estimate.
  await act(async () =>
    answer({
      counts: { gamesFinished: 42, totalGames: 193 },
      promoted: { ...playing, id: 2, name: 'Final Fantasy Resonance' },
      promoteFailed: false,
    }),
  );
  await waitFor(() =>
    expect(result.current.gameSummary).toMatchObject({ gamesFinished: 42, totalGames: 193 }),
  );
});

it('takes the summary away if the game could not be saved', async () => {
  jest.mocked(completeGame).mockRejectedValue(new Error('offline'));
  const { result } = setup();

  act(() => result.current.confirmStatusChange('finished', '2026-10-28', '', null));
  expect(result.current.gameSummary).not.toBeNull();

  await waitFor(() => expect(result.current.gameSummary).toBeNull());
});

it("doesn't reopen a summary that was closed before the server answered", async () => {
  let answer!: (value: Awaited<ReturnType<typeof completeGame>>) => void;
  jest.mocked(completeGame).mockReturnValue(new Promise((resolve) => (answer = resolve)));
  const { result } = setup();

  act(() => result.current.confirmStatusChange('finished', '2026-10-28', '', null));
  act(() => result.current.closeSummary());
  await act(async () =>
    answer({
      counts: { gamesFinished: 41, totalGames: 192 },
      promoted: null,
      promoteFailed: false,
    }),
  );

  expect(result.current.gameSummary).toBeNull();
});

describe('switching games from the queue', () => {
  const ids = (items: { game_id: number }[] | undefined) => items?.map((q) => q.game_id);

  it('starts the queued game and pauses the playing one at the top of the queue', async () => {
    const { result, queryClient } = setup({ queue: [queued, queuedDread] });

    act(() => result.current.pickFromQueue(3));

    // Shown before the server answers.
    await waitFor(() => expect(result.current.currentlyPlaying?.id).toBe(3));
    expect(ids(queryClient.getQueryData(queryKeys.queue.list('u')))).toEqual([1, 2]);
    await waitFor(() =>
      expect(updateGameStatus).toHaveBeenCalledWith(3, 'playing', { pausePlaying: true }),
    );
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        'Now playing Metroid Dread. SteamWorld Dig is first in your queue.',
        expect.objectContaining({ action: expect.objectContaining({ label: 'Undo' }) }),
      ),
    );
  });

  it('undoes a switch: back to the old game and the queue in its old order', async () => {
    const { result, queryClient } = setup({ queue: [queued, queuedDread] });
    act(() => result.current.pickFromQueue(3));
    await waitFor(() => expect(toast).toHaveBeenCalled());

    const [, options] = jest.mocked(toast).mock.calls[0] as unknown as [
      string,
      { action: { onClick: () => void } },
    ];
    act(() => options.action.onClick());

    await waitFor(() => expect(result.current.currentlyPlaying?.id).toBe(1));
    expect(ids(queryClient.getQueryData(queryKeys.queue.list('u')))).toEqual([2, 3]);
    await waitFor(() => expect(reorderQueue).toHaveBeenCalledWith([2, 3]));
    expect(updateGameStatus).toHaveBeenCalledWith(1, 'playing', { pausePlaying: true });
    // Metroid Dread was only playing for a moment: its start date is cleared.
    expect(updateGameStatus).toHaveBeenCalledWith(3, 'backlog');
    // No second Undo for the undo.
    expect(toast).toHaveBeenCalledTimes(1);
  });

  it('after a switch, finishing the game goes back to the paused one', async () => {
    jest.mocked(completeGame).mockReturnValue(new Promise(() => {}));
    const { result } = setup({ queue: [queued, queuedDread] });
    act(() => result.current.pickFromQueue(3));
    await waitFor(() => expect(updateGameStatus).toHaveBeenCalled());

    act(() => result.current.confirmStatusChange('finished', '2026-11-07', '', 9));

    expect(result.current.gameSummary).toMatchObject({
      gameName: 'Metroid Dread',
      nextGame: 'SteamWorld Dig',
    });
  });

  it('with nothing playing, Play just starts the game', async () => {
    const { result, queryClient } = setup({ queue: [queued, queuedDread], nowPlaying: null });

    act(() => result.current.pickFromQueue(3));

    await waitFor(() => expect(result.current.currentlyPlaying?.id).toBe(3));
    expect(ids(queryClient.getQueryData(queryKeys.queue.list('u')))).toEqual([2]);
    await waitFor(() => expect(updateGameStatus).toHaveBeenCalledWith(3, 'playing'));
  });
});
