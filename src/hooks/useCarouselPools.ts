'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/query-keys';
import { loadCarouselPools, type CarouselPools } from '@/lib/data/loaders';
import {
  EMPTY_CAROUSEL_POOLS,
  MORE_LIKE_MIN_GAMES,
  type CarouselGame,
} from '@/lib/games/carousels';

export type { CarouselPools };

// Three pages at five per page on wide screens.
const CAROUSEL_SIZE = 15;

/** Drops a game from every carousel, e.g. optimistically when it starts playing. */
export function removeAppFromPools(pools: CarouselPools, appId: number): CarouselPools {
  const without = (list: CarouselGame[]) => list.filter((g) => g.app_id !== appId);
  return {
    pickUpPool: without(pools.pickUpPool),
    moreLike: pools.moreLike && { ...pools.moreLike, games: without(pools.moreLike.games) },
    shortGamesPool: without(pools.shortGamesPool),
    weekendGamesPool: without(pools.weekendGamesPool),
    highlyRatedGamesPool: without(pools.highlyRatedGamesPool),
    hiddenGemsPool: without(pools.hiddenGemsPool),
    recentlyAddedPool: without(pools.recentlyAddedPool),
  };
}

export function useCarouselPools(userId: string | null) {
  const { data = EMPTY_CAROUSEL_POOLS, isPending } = useQuery({
    queryKey: userId ? queryKeys.carousels.byUser(userId) : queryKeys.carousels.all,
    queryFn: () => loadCarouselPools(createClient(), userId!),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });

  // No game appears in two of the picks carousels. They claim games in this
  // order, which isn't their order on Home: a game you've started belongs in
  // Pick Up Where You Left Off, and More Like ... needs its matches before the
  // general picks take them, or it would rarely have enough to show.
  const shown = new Set<number>();
  const take = (pool: CarouselGame[]) => {
    const games = pool.filter((g) => !shown.has(g.app_id)).slice(0, CAROUSEL_SIZE);
    games.forEach((g) => shown.add(g.app_id));
    return games;
  };

  const pickUp = take(data.pickUpPool);
  const moreLikeGames = data.moreLike ? take(data.moreLike.games) : [];
  const shortGames = take(data.shortGamesPool);
  const weekendGames = take(data.weekendGamesPool);
  const highlyRatedGames = take(data.highlyRatedGamesPool);
  const hiddenGems = take(data.hiddenGemsPool);

  // Recently Added is a factual list of new arrivals, so it's exempt from
  // de-duplication: a new game shows there even if another carousel has it.
  const recentlyAdded = data.recentlyAddedPool.slice(0, CAROUSEL_SIZE);

  return {
    pickUp,
    moreLike:
      // Only worth a row if enough are left after the started games.
      data.moreLike && moreLikeGames.length >= MORE_LIKE_MIN_GAMES
        ? { basedOn: data.moreLike.basedOn, games: moreLikeGames }
        : null,
    shortGames,
    weekendGames,
    highlyRatedGames,
    hiddenGems,
    recentlyAdded,
    carouselsLoading: !!userId && isPending,
  };
}
