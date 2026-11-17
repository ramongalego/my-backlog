import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useHomeActions } from '@/hooks/useHomeActions';
import { recordRandomPick } from '@/lib/client/picks';

const pick = jest.fn();
jest.mock('@/hooks/useNowPlaying', () => ({
  useNowPlaying: () => ({ pick, isStatusLoading: false, queuedGameIds: new Set([7, 8]) }),
}));
// The carousel dialog's queue and playing wiring has its own tests.
jest.mock('@/hooks/useGameDialog', () => ({ useGameDialog: () => () => ({}) }));
jest.mock('@/hooks/useGameMutations', () => ({
  useInvalidateQueries: () => ({ statusChanged: jest.fn() }),
  usePatchGamesList: () => ({ patch: jest.fn(), restore: jest.fn() }),
  useSetGameStatus: () => ({ mutate: jest.fn(), isPending: false }),
}));
jest.mock('@/lib/client/picks', () => ({ recordRandomPick: jest.fn() }));
jest.mock('sonner', () => ({
  toast: Object.assign(jest.fn(), { error: jest.fn(), info: jest.fn() }),
}));

// The filters Random's game queries were built with.
const filters: string[] = [];
const hollowKnight = { id: 3, name: 'Hollow Knight', header_image: null };
const silksong = { id: 4, name: 'Hollow Knight: Silksong', header_image: null };
// The eligible games Random chooses between: their ids and release dates.
let candidates: { id: number; release_date: string | null }[] = [];
// The game it then fetched in full.
let fetchedId: number | null = null;
jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: (table: string) => {
      const builder = {
        cols: '',
        select: (cols: string) => {
          if (table === 'games') filters.push('select');
          return Object.assign(builder, { cols });
        },
        eq: (col: string, value: number) => {
          if (col === 'id') fetchedId = value;
          return builder;
        },
        not: (col: string, op: string, value: unknown) => {
          filters.push(`not ${col} ${op} ${value}`);
          return builder;
        },
        or: (value: string) => {
          filters.push(`or ${value}`);
          return builder;
        },
        lte: () => builder,
        contains: () => builder,
        order: () => builder,
        range: () => builder,
        overrideTypes: () => builder,
        then: (resolve: (v: unknown) => unknown) =>
          resolve(
            table === 'playing_queue'
              ? { data: [{ game_id: 7 }, { game_id: 8 }], error: null }
              : builder.cols === 'id, release_date'
                ? { data: candidates, error: null }
                : { data: [hollowKnight, silksong].filter((g) => g.id === fetchedId), error: null },
          ),
      };
      return builder;
    },
  }),
}));

beforeEach(() => {
  filters.length = 0;
  candidates = [{ id: 3, release_date: 'Feb 24, 2017' }];
  fetchedId = null;
  pick.mockReset();
  jest.mocked(recordRandomPick).mockReset().mockResolvedValue(41);
  window.scrollTo = jest.fn();
});

it("picks from the backlog only: never a queued game or the one you're playing", async () => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useHomeActions('u'), { wrapper });

  await act(() => result.current.handleRandomPick());

  expect(filters).toContain('not id in (7,8)');
  expect(filters).toContain('or status.is.null,status.eq.backlog');
  expect(pick).toHaveBeenCalledWith(hollowKnight);
});

it("never picks a game that isn't out yet", async () => {
  candidates = [
    { id: 4, release_date: `Sep 4, ${new Date().getFullYear() + 1}` },
    { id: 3, release_date: 'Feb 24, 2017' },
  ];
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useHomeActions('u'), { wrapper });

  await act(() => result.current.handleRandomPick());

  expect(pick).toHaveBeenCalledWith(hollowKnight);
});

it('picks one game, however many times Random is pressed before the page shows it', async () => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useHomeActions('u'), { wrapper });

  await act(async () => {
    void result.current.handleRandomPick();
    void result.current.handleRandomPick();
    await result.current.handleRandomPick();
  });

  expect(pick).toHaveBeenCalledTimes(1);
  expect(recordRandomPick).toHaveBeenCalledTimes(1);

  // And again later, once that pick is done.
  await act(() => result.current.handleRandomPick());
  expect(pick).toHaveBeenCalledTimes(2);
  expect(recordRandomPick).toHaveBeenCalledTimes(2);
});

it('has the random pick kept, as a pick to play that was played', async () => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useHomeActions('u'), { wrapper });

  await act(() => result.current.handleRandomPick());

  expect(recordRandomPick).toHaveBeenCalledTimes(1);
  expect(recordRandomPick).toHaveBeenCalledWith({
    gameId: hollowKnight.id,
    mode: 'play',
    attempt: 1,
    outcome: 'played',
  });
});

it("starts the game without waiting for the pick to be kept, or minding that it wasn't", async () => {
  // Never answers.
  jest.mocked(recordRandomPick).mockReturnValue(new Promise(() => {}));
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useHomeActions('u'), { wrapper });

  await act(() => result.current.handleRandomPick());
  expect(pick).toHaveBeenCalledWith(hollowKnight);

  jest.mocked(recordRandomPick).mockResolvedValue(null);
  await act(() => result.current.handleRandomPick());
  expect(pick).toHaveBeenCalledTimes(2);
});

it('keeps nothing when there was no game to pick', async () => {
  candidates = [];
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useHomeActions('u'), { wrapper });

  await act(() => result.current.handleRandomPick());

  expect(pick).not.toHaveBeenCalled();
  expect(recordRandomPick).not.toHaveBeenCalled();
});
