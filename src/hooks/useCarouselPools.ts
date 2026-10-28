'use client';

import { useQuery } from '@tanstack/react-query';
import { queries } from '@/lib/data/queries';
import type { CarouselPools } from '@/lib/data/loaders';
import { useQueue } from './useNowPlaying';
import {
  EMPTY_CAROUSEL_POOLS,
  MORE_LIKE_MIN_GAMES,
  type CarouselGame,
} from '@/lib/games/carousels';

export type { CarouselPools };

// Three pages at five per page on wide screens.
const CAROUSEL_SIZE = 15;

/** Drops a game from every carousel, e.g. optimistically when it starts playing. */
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

// How many games' art flicks past while a game is picked.
const SHUFFLE_COVERS = 16;

/**
 * Art from the backlog games Home already has, in a random order: what flicks
 * past while Pick My Game or Random picks one (ArtShuffle).
 */
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

  // No game appears in two of the picks carousels. They claim games in this
  // order, which isn't their order on Home: a game you've started belongs in
  // Pick Up Where You Left Off, and More Like ... needs its matches before the
  // general picks take them, or it would rarely have enough to show.
  // Queued games are already decided, so they aren't suggested again (Recently
  // Added still lists them). Filtering here, from the queue the page already
  // has, means adding or removing one updates the carousels instantly.
  const { queuedGameIds } = useQueue(userId);
  const shown = new Set<number>(queuedGameIds);
  const take = (pool: CarouselGame[]) => {
    const games = pool.filter((g) => !shown.has(g.id)).slice(0, CAROUSEL_SIZE);
    games.forEach((g) => shown.add(g.id));
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
