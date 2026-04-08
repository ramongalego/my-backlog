'use client';

import { useState } from 'react';
import type { GameWithImage } from '@/types/games';

export function useCarouselPools() {
  const [shortGamesPool, setShortGamesPool] = useState<GameWithImage[]>([]);
  const [weekendGamesPool, setWeekendGamesPool] = useState<GameWithImage[]>([]);
  const [highlyRatedGamesPool, setHighlyRatedGamesPool] = useState<GameWithImage[]>([]);
  const [hiddenGemsPool, setHiddenGemsPool] = useState<GameWithImage[]>([]);
  const [recentlyAddedPool, setRecentlyAddedPool] = useState<GameWithImage[]>([]);
  const [carouselsLoading, setCarouselsLoading] = useState(true);

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

  const removeFromPools = (appId: number) => {
    setShortGamesPool((prev) => prev.filter((g) => g.app_id !== appId));
    setWeekendGamesPool((prev) => prev.filter((g) => g.app_id !== appId));
    setHighlyRatedGamesPool((prev) => prev.filter((g) => g.app_id !== appId));
    setHiddenGemsPool((prev) => prev.filter((g) => g.app_id !== appId));
    setRecentlyAddedPool((prev) => prev.filter((g) => g.app_id !== appId));
  };

  const addBackToPool = (game: GameWithImage) => {
    if (game.main_story_hours <= 5) {
      setShortGamesPool((prev) => [...prev, game]);
    } else if (game.main_story_hours <= 12) {
      setWeekendGamesPool((prev) => [...prev, game]);
    }
  };

  return {
    shortGames,
    weekendGames,
    highlyRatedGames,
    hiddenGems,
    recentlyAdded,
    carouselsLoading,
    removeFromPools,
    addBackToPool,
    setShortGamesPool,
    setWeekendGamesPool,
    setHighlyRatedGamesPool,
    setHiddenGemsPool,
    setRecentlyAddedPool,
    setCarouselsLoading,
  };
}
