'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/query-keys';
import { loadCarouselPools, type CarouselPools } from '@/lib/data/loaders';
import type { GameWithImage } from '@/types/games';

export type { CarouselPools };

const EMPTY_POOLS: CarouselPools = {
  shortGamesPool: [],
  weekendGamesPool: [],
  highlyRatedGamesPool: [],
  hiddenGemsPool: [],
  recentlyAddedPool: [],
};

/** Drops a game from every carousel, e.g. optimistically when it starts playing. */
export function removeAppFromPools(pools: CarouselPools, appId: number): CarouselPools {
  const without = (list: GameWithImage[]) => list.filter((g) => g.app_id !== appId);
  return {
    shortGamesPool: without(pools.shortGamesPool),
    weekendGamesPool: without(pools.weekendGamesPool),
    highlyRatedGamesPool: without(pools.highlyRatedGamesPool),
    hiddenGemsPool: without(pools.hiddenGemsPool),
    recentlyAddedPool: without(pools.recentlyAddedPool),
  };
}

export function useCarouselPools(userId: string | null) {
  const { data = EMPTY_POOLS, isPending } = useQuery({
    queryKey: userId ? queryKeys.carousels.byUser(userId) : queryKeys.carousels.all,
    queryFn: () => loadCarouselPools(createClient(), userId!),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });

  const {
    shortGamesPool,
    weekendGamesPool,
    highlyRatedGamesPool,
    hiddenGemsPool,
    recentlyAddedPool,
  } = data;

  const shortGames = shortGamesPool.slice(0, 10);
  const weekendGames = weekendGamesPool.slice(0, 10);

  // Recently Added is a factual list of new arrivals, so it's exempt from
  // de-duplication: a new game shows there even if another carousel has it.
  const recentlyAdded = recentlyAddedPool.slice(0, 10);

  // Build a running exclusion set so no game appears in two of the picks carousels
  const { highlyRatedGames, hiddenGems } = (() => {
    const shown = new Set([
      ...shortGames.map((g) => g.app_id),
      ...weekendGames.map((g) => g.app_id),
    ]);

    const rated = highlyRatedGamesPool.filter((g) => !shown.has(g.app_id)).slice(0, 10);
    rated.forEach((g) => shown.add(g.app_id));

    const gems = hiddenGemsPool.filter((g) => !shown.has(g.app_id)).slice(0, 10);

    return { highlyRatedGames: rated, hiddenGems: gems };
  })();

  return {
    shortGames,
    weekendGames,
    highlyRatedGames,
    hiddenGems,
    recentlyAdded,
    carouselsLoading: !!userId && isPending,
  };
}
