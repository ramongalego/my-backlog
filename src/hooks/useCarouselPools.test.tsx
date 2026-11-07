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
    weekendGamesPool: [1, 2, 3, 4].map(game),
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

it('leaves queued games out of the picks, from the cached queue', () => {
  const { wrapper } = setup([queued(2)]);
  const { result } = renderHook(() => useCarouselPools('u'), { wrapper });

  expect(result.current.weekendGames.map((g) => g.app_id)).toEqual([1, 3, 4]);
  // Recently Added is a plain list of arrivals, queued or not.
  expect(result.current.recentlyAdded.map((g) => g.app_id)).toEqual([2, 5]);
});

it('updates as soon as the queue changes, without refetching the carousels', () => {
  const { client, wrapper } = setup([]);
  const { result, rerender } = renderHook(() => useCarouselPools('u'), { wrapper });
  expect(result.current.weekendGames).toHaveLength(4);

  client.setQueryData(queryKeys.queue.list('u'), [queued(3)]);
  rerender();

  expect(result.current.weekendGames.map((g) => g.app_id)).toEqual([1, 2, 4]);
  expect(global.fetch).not.toHaveBeenCalled();
});
