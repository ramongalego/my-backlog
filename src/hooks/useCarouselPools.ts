'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/query-keys';
import {
  SHORT_GAME_MIN_HOURS,
  SHORT_GAME_MAX_HOURS,
  WEEKEND_GAME_MAX_HOURS,
  MAX_PLAYTIME_MINUTES,
} from '@/lib/games/filtering';
import type { GameWithImage } from '@/types/games';

interface CarouselPools {
  shortGamesPool: GameWithImage[];
  weekendGamesPool: GameWithImage[];
  highlyRatedGamesPool: GameWithImage[];
  hiddenGemsPool: GameWithImage[];
  recentlyAddedPool: GameWithImage[];
}

const EMPTY_POOLS: CarouselPools = {
  shortGamesPool: [],
  weekendGamesPool: [],
  highlyRatedGamesPool: [],
  hiddenGemsPool: [],
  recentlyAddedPool: [],
};

const CAROUSEL_SELECT =
  'app_id, name, header_image, main_story_hours, playtime_forever, steam_review_score, steam_review_count, deck_compat';

const SINGLE_PLAYER = ['Single-player'];
const BACKLOG_FILTER = 'status.is.null,status.eq.backlog';

async function fetchCarouselPools(userId: string): Promise<CarouselPools> {
  const supabase = createClient();

  const [
    { data: shortData },
    { data: weekendData },
    { data: highlyRatedData },
    { data: hiddenGemsData },
    { data: recentlyAddedData },
  ] = await Promise.all([
    supabase
      .from('games')
      .select(CAROUSEL_SELECT)
      .eq('user_id', userId)
      .eq('type', 'game')
      .not('main_story_hours', 'is', null)
      .not('steam_review_weighted', 'is', null)
      .gte('main_story_hours', SHORT_GAME_MIN_HOURS)
      .lte('main_story_hours', SHORT_GAME_MAX_HOURS)
      .lte('playtime_forever', MAX_PLAYTIME_MINUTES)
      .contains('categories', SINGLE_PLAYER)
      .or(BACKLOG_FILTER)
      .order('steam_review_weighted', { ascending: false }),
    supabase
      .from('games')
      .select(CAROUSEL_SELECT)
      .eq('user_id', userId)
      .eq('type', 'game')
      .not('main_story_hours', 'is', null)
      .not('steam_review_weighted', 'is', null)
      .gt('main_story_hours', SHORT_GAME_MAX_HOURS)
      .lte('main_story_hours', WEEKEND_GAME_MAX_HOURS)
      .lte('playtime_forever', MAX_PLAYTIME_MINUTES)
      .contains('categories', SINGLE_PLAYER)
      .or(BACKLOG_FILTER)
      .order('steam_review_weighted', { ascending: false }),
    supabase
      .from('games')
      .select(CAROUSEL_SELECT)
      .eq('user_id', userId)
      .eq('type', 'game')
      .not('steam_review_weighted', 'is', null)
      .eq('playtime_forever', 0)
      .contains('categories', SINGLE_PLAYER)
      .or(BACKLOG_FILTER)
      .order('steam_review_weighted', { ascending: false })
      .limit(20),
    // Hidden Gems: high score, few reviews
    supabase
      .from('games')
      .select(CAROUSEL_SELECT)
      .eq('user_id', userId)
      .eq('type', 'game')
      .gte('steam_review_score', 80)
      .gt('steam_review_count', 10)
      .lte('steam_review_count', 500)
      .contains('categories', SINGLE_PLAYER)
      .or(BACKLOG_FILTER)
      .order('steam_review_score', { ascending: false })
      .limit(20),
    // Recently Added (higher app_id = newer Steam release)
    supabase
      .from('games')
      .select(CAROUSEL_SELECT)
      .eq('user_id', userId)
      .eq('type', 'game')
      .contains('categories', SINGLE_PLAYER)
      .or(BACKLOG_FILTER)
      .order('app_id', { ascending: false })
      .limit(20),
  ]);

  return {
    shortGamesPool: shortData ?? [],
    weekendGamesPool: weekendData ?? [],
    highlyRatedGamesPool: highlyRatedData ?? [],
    hiddenGemsPool: hiddenGemsData ?? [],
    recentlyAddedPool: recentlyAddedData ?? [],
  };
}

export function useCarouselPools(userId: string | null) {
  const queryClient = useQueryClient();

  const { data = EMPTY_POOLS, isPending } = useQuery({
    queryKey: userId ? queryKeys.carousels.byUser(userId) : queryKeys.carousels.all,
    queryFn: () => fetchCarouselPools(userId!),
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

  // Build a running exclusion set so no game appears in two carousels
  const { highlyRatedGames, hiddenGems, recentlyAdded } = (() => {
    const shown = new Set([
      ...shortGames.map((g) => g.app_id),
      ...weekendGames.map((g) => g.app_id),
    ]);

    const rated = highlyRatedGamesPool.filter((g) => !shown.has(g.app_id)).slice(0, 10);
    rated.forEach((g) => shown.add(g.app_id));

    const gems = hiddenGemsPool.filter((g) => !shown.has(g.app_id)).slice(0, 10);
    gems.forEach((g) => shown.add(g.app_id));

    const recent = recentlyAddedPool.filter((g) => !shown.has(g.app_id)).slice(0, 10);

    return { highlyRatedGames: rated, hiddenGems: gems, recentlyAdded: recent };
  })();

  const updatePools = (updater: (pools: CarouselPools) => CarouselPools) => {
    if (!userId) return;
    queryClient.setQueryData<CarouselPools>(queryKeys.carousels.byUser(userId), (old) =>
      updater(old ?? EMPTY_POOLS),
    );
  };

  const removeFromPools = (appId: number) => {
    updatePools((pools) => ({
      shortGamesPool: pools.shortGamesPool.filter((g) => g.app_id !== appId),
      weekendGamesPool: pools.weekendGamesPool.filter((g) => g.app_id !== appId),
      highlyRatedGamesPool: pools.highlyRatedGamesPool.filter((g) => g.app_id !== appId),
      hiddenGemsPool: pools.hiddenGemsPool.filter((g) => g.app_id !== appId),
      recentlyAddedPool: pools.recentlyAddedPool.filter((g) => g.app_id !== appId),
    }));
  };

  const addBackToPool = (game: GameWithImage) => {
    updatePools((pools) => {
      const hours = game.main_story_hours;
      const playtime = game.playtime_forever ?? 0;
      if (playtime > MAX_PLAYTIME_MINUTES || hours == null) return pools;
      if (hours >= SHORT_GAME_MIN_HOURS && hours <= SHORT_GAME_MAX_HOURS) {
        return { ...pools, shortGamesPool: [...pools.shortGamesPool, game] };
      }
      if (hours > SHORT_GAME_MAX_HOURS && hours <= WEEKEND_GAME_MAX_HOURS) {
        return { ...pools, weekendGamesPool: [...pools.weekendGamesPool, game] };
      }
      return pools;
    });
  };

  return {
    shortGames,
    weekendGames,
    highlyRatedGames,
    hiddenGems,
    recentlyAdded,
    carouselsLoading: !!userId && isPending,
    removeFromPools,
    addBackToPool,
  };
}
