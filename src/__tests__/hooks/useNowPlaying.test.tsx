import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useNowPlaying } from '@/hooks/useNowPlaying';
import { completeGame } from '@/lib/games/status';
import { queryKeys } from '@/lib/query-keys';

jest.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));
jest.mock('@/lib/confetti', () => ({ celebrateGameFinished: jest.fn() }));
jest.mock('sonner', () => ({
  toast: Object.assign(jest.fn(), { error: jest.fn(), success: jest.fn() }),
}));
jest.mock('@/lib/mutations', () => ({
  useInvalidateQueries: () => ({ statusChanged: jest.fn(), queue: jest.fn() }),
  usePatchGamesList: () => ({ patch: jest.fn(), restore: jest.fn() }),
  useSetGameStatus: () => ({ mutate: jest.fn(), isPending: false }),
}));
jest.mock('@/lib/games/status', () => ({
  ...jest.requireActual('@/lib/games/status'),
  completeGame: jest.fn(),
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

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
  queryClient.setQueryData(queryKeys.games.playing('u'), playing);
  queryClient.setQueryData(queryKeys.queue.list('u'), [queued]);
  queryClient.setQueryData(queryKeys.library.meta('u'), {
    gameCount: 192,
    historyCount: 50,
    backlogCount: 100,
    finishedCount: 40,
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return renderHook(() => useNowPlaying('u'), { wrapper });
}

beforeEach(() => jest.mocked(completeGame).mockReset());

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
