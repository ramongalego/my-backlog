import { QueryClient } from '@tanstack/react-query';
import { homeShape } from '@/components/home/HomeLoading';
import { PLAYING_SHAPE } from '@/components/home/HomeLoadingStates';
import { queryKeys } from '@/lib/query-keys';

const game = {
  id: 1,
  app_id: 1,
  name: 'Celeste',
  header_image: null,
  main_story_hours: 8,
  playtime_forever: 0,
};

function cache({
  playing,
  queue,
  meta,
  steamId = 'steam-1',
}: {
  playing?: unknown;
  queue?: unknown[];
  meta?: { gameCount: number; historyCount: number; backlogCount: number };
  steamId?: string | null;
}) {
  const queryClient = new QueryClient();
  queryClient.setQueryData(queryKeys.auth.session(), {
    user: { id: 'u' },
    profile: { steam_id: steamId },
  });
  if (playing !== undefined) queryClient.setQueryData(queryKeys.games.playing('u'), playing);
  if (queue) queryClient.setQueryData(queryKeys.queue.list('u'), queue);
  if (meta) queryClient.setQueryData(queryKeys.library.meta('u'), meta);
  return queryClient;
}

it('guesses a game being played when nothing is known yet', () => {
  expect(homeShape(new QueryClient())).toEqual(PLAYING_SHAPE);
});

it('draws the playing band, with the empty-queue line when nothing is queued', () => {
  expect(homeShape(cache({ playing: game, queue: [] }))).toMatchObject({
    band: 'playing',
    queued: false,
  });
});

it('draws the picker when nothing is playing and there are games to pick from', () => {
  expect(
    homeShape(cache({ playing: null, meta: { gameCount: 40, historyCount: 5, backlogCount: 30 } })),
  ).toMatchObject({ band: 'picker', carouselRows: 2 });
});

it('draws "Build your backlog" for a new library, with its Steam line', () => {
  expect(
    homeShape(
      cache({
        playing: null,
        meta: { gameCount: 1, historyCount: 0, backlogCount: 1 },
        steamId: null,
      }),
    ),
  ).toEqual({ band: 'building', queued: false, steamConnected: false, carouselRows: 1 });
});
