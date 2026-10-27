'use client';

import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { MIN_GAMES_TO_PICK, type LibraryMeta } from '@/lib/data/loaders';
import type { GameWithImage, QueueItem } from '@/types/games';
import { LoadingState, PLAYING_SHAPE, type HomeShape } from './HomeLoadingStates';

/** The first cached value under a key prefix (one signed-in user per cache). */
function cached<T>(queryClient: QueryClient, queryKey: readonly unknown[]): T | undefined {
  return queryClient
    .getQueriesData<T>({ queryKey })
    .map(([, data]) => data)
    .find((data) => data !== undefined);
}

/**
 * The shape Home will have, from what the app already knows (an earlier page
 * this visit loaded the game being played, the queue, the library's counts).
 * Knowing nothing, the usual case: a game being played.
 */
export function homeShape(queryClient: QueryClient): HomeShape {
  const playing = cached<GameWithImage | null>(queryClient, [...queryKeys.games.all, 'playing']);
  if (playing === undefined) return PLAYING_SHAPE;

  const session = queryClient.getQueryData<{ profile?: { steam_id?: string | null } | null }>(
    queryKeys.auth.session(),
  );
  const steamConnected = !!session?.profile?.steam_id;

  if (playing) {
    const queue = cached<QueueItem[]>(queryClient, [...queryKeys.queue.all, 'list']);
    return { ...PLAYING_SHAPE, queued: queue ? queue.length > 0 : true, steamConnected };
  }

  const meta = cached<LibraryMeta>(queryClient, [...queryKeys.library.all, 'meta']);
  if (meta && meta.backlogCount < MIN_GAMES_TO_PICK) {
    // Recently Added shows from the first game; nothing else does yet.
    return {
      band: 'building',
      queued: false,
      steamConnected,
      carouselRows: meta.gameCount ? 1 : 0,
    };
  }
  return { band: 'picker', queued: false, steamConnected, carouselRows: 2 };
}

/** Home's skeleton, in the shape the page is about to have. */
export function HomeLoading() {
  const queryClient = useQueryClient();
  return <LoadingState shape={homeShape(queryClient)} />;
}
