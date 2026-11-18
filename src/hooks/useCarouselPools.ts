'use client';

import { useQuery } from '@tanstack/react-query';
import { queries } from '@/lib/data/queries';
import type { CarouselPools } from '@/lib/data/loaders';
import { useQueue } from '@/hooks/useQueue';
import {
  EMPTY_CAROUSEL_POOLS,
  MORE_LIKE_MIN_GAMES,
  type CarouselGame,
} from '@/lib/games/carousels';

export type { CarouselPools };

// Three pages at five per page on wide screens.
const CAROUSEL_SIZE = 15;

export function removeGameFromPools(pools: CarouselPools, gameId: number): CarouselPools {
  const without = (list: CarouselGame[]) => list.filter((g) => g.id !== gameId);
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

const SHUFFLE_COVERS = 16;

/** What flicks past while Pick My Game or Random picks a game (ArtShuffle). */
export function backlogCovers(
  pools: CarouselPools | undefined,
  /** Queued games, which neither picks from. */
  exclude: ReadonlySet<number> = new Set(),
): string[] {
  if (!pools) return [];
  const games = [
    ...pools.pickUpPool,
    ...(pools.moreLike?.games ?? []),
    ...pools.shortGamesPool,
    ...pools.weekendGamesPool,
    ...pools.highlyRatedGamesPool,
    ...pools.hiddenGemsPool,
    ...pools.recentlyAddedPool,
  ];
  const covers = [
    ...new Set(
      games.flatMap((g) => (g.header_image && !exclude.has(g.id) ? [g.header_image] : [])),
    ),
  ];
  for (let i = covers.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [covers[i], covers[j]] = [covers[j], covers[i]];
  }
  return covers.slice(0, SHUFFLE_COVERS);
}

export function useCarouselPools(userId: string | null) {
  const { data = EMPTY_CAROUSEL_POOLS, isPending } = useQuery(queries.carousels(userId));

  // Queued games stay in the rows, marked Queued, but don't count toward a
  // row's size: a game already queued never takes a suggestion's place.
  const { queuedGameIds } = useQueue(userId);
  const upTo = (pool: CarouselGame[]) => {
    const games: CarouselGame[] = [];
    let suggestions = 0;
    for (const game of pool) {
      if (suggestions === CAROUSEL_SIZE) break;
      games.push(game);
      if (!queuedGameIds.has(game.id)) suggestions++;
    }
    return games;
  };

  // No game appears in two picks carousels. They claim games in this order, not
  // Home's: a started game belongs in Pick Up Where You Left Off first.
  const shown = new Set<number>();
  const take = (pool: CarouselGame[]) => {
    const games = upTo(pool.filter((g) => !shown.has(g.id)));
    games.forEach((g) => shown.add(g.id));
    return games;
  };

  // More Like ... lists every game like the one you loved, even ones another
  // row also shows, and takes none away from them.
  const moreLikeGames = upTo(data.moreLike?.games ?? []);
  const pickUp = take(data.pickUpPool);
  const shortGames = take(data.shortGamesPool);
  const weekendGames = take(data.weekendGamesPool);
  const highlyRatedGames = take(data.highlyRatedGamesPool);
  const hiddenGems = take(data.hiddenGemsPool);

  // A factual list of new arrivals, so not de-duplicated.
  const recentlyAdded = data.recentlyAddedPool.slice(0, CAROUSEL_SIZE);

  return {
    pickUp,
    moreLike:
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
