import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useCarouselPools } from '@/hooks/useCarouselPools';
import { EMPTY_CAROUSEL_POOLS, type CarouselGame } from '@/lib/games/carousels';
import { queryKeys } from '@/lib/query-keys';
import type { QueueItem } from '@/types/games';

const game = (id: number): CarouselGame => ({
  id,
  app_id: id,
  name: `Game ${id}`,
  header_image: null,
  main_story_hours: 10,
  playtime_forever: 0,
  steam_review_score: 90,
  steam_review_count: 1000,
  steam_review_weighted: 85,
  deck_compat: null,
  tags: null,
  categories: ['Single-player'],
  created_at: '2026-01-01T00:00:00Z',
  last_played_at: null,
});

const queued = (id: number): QueueItem => ({
  id,
  game_id: id,
  position: 0,
  game: {
    app_id: id,
    name: `Game ${id}`,
    header_image: null,
    playtime_forever: 0,
    main_story_hours: 10,
    steam_review_score: 90,
  },
});

function setup(queue: QueueItem[]) {
  const client = new QueryClient();
  // Fresh cached data for both queries, so nothing is fetched.
  client.setQueryData(queryKeys.carousels.byUser('u'), {
    ...EMPTY_CAROUSEL_POOLS,
    // More than a row shows (15).
    weekendGamesPool: Array.from({ length: 20 }, (_, i) => game(i + 1)),
    recentlyAddedPool: [2, 5].map(game),
  });
  client.setQueryData(queryKeys.queue.list('u'), queue);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

beforeEach(() => {
  global.fetch = jest.fn(() => Promise.reject(new Error('should not fetch'))) as typeof fetch;
});

it("keeps queued games in the rows, without counting them toward a row's 15", () => {
  const { wrapper } = setup([queued(2), queued(3)]);
  const { result } = renderHook(() => useCarouselPools('u'), { wrapper });

  // 15 suggestions, plus the two queued games among them.
  expect(result.current.weekendGames.map((g) => g.app_id)).toEqual([
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17,
  ]);
  expect(result.current.recentlyAdded.map((g) => g.app_id)).toEqual([2, 5]);
});

it('makes room as soon as a game is queued, without refetching the carousels', () => {
  const { client, wrapper } = setup([]);
  const { result, rerender } = renderHook(() => useCarouselPools('u'), { wrapper });
  expect(result.current.weekendGames).toHaveLength(15);

  client.setQueryData(queryKeys.queue.list('u'), [queued(3)]);
  rerender();

  expect(result.current.weekendGames).toHaveLength(16);
  expect(global.fetch).not.toHaveBeenCalled();
});

it('lists every game in More Like ..., even ones another row shows or that are queued', () => {
  const client = new QueryClient();
  client.setQueryData(queryKeys.carousels.byUser('u'), {
    ...EMPTY_CAROUSEL_POOLS,
    pickUpPool: [1].map(game),
    moreLike: { basedOn: 'Aria of Sorrow', games: [1, 2, 3, 4, 5].map(game) },
    shortGamesPool: [2, 3].map(game),
  });
  client.setQueryData(queryKeys.queue.list('u'), [queued(5)]);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useCarouselPools('u'), { wrapper });

  expect(result.current.moreLike?.games.map((g) => g.app_id)).toEqual([1, 2, 3, 4, 5]);
  // And the other rows keep theirs.
  expect(result.current.pickUp.map((g) => g.app_id)).toEqual([1]);
  expect(result.current.shortGames.map((g) => g.app_id)).toEqual([2, 3]);
});
