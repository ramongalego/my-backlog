'use client';

import { useState, useCallback, useMemo } from 'react';
import type { GameWithImage } from '@/types/games';

export function useCarouselPools() {
  const [shortGamesPool, setShortGamesPool] = useState<GameWithImage[]>([]);
  const [weekendGamesPool, setWeekendGamesPool] = useState<GameWithImage[]>([]);
  const [highlyRatedGamesPool, setHighlyRatedGamesPool] = useState<GameWithImage[]>([]);
  const [carouselsLoading, setCarouselsLoading] = useState(true);

  const shortGames = useMemo(() => shortGamesPool.slice(0, 10), [shortGamesPool]);
  const weekendGames = useMemo(() => weekendGamesPool.slice(0, 10), [weekendGamesPool]);

  const highlyRatedGames = useMemo(() => {
    const excludedAppIds = new Set([
      ...shortGames.map((g) => g.app_id),
      ...weekendGames.map((g) => g.app_id),
    ]);
    return highlyRatedGamesPool.filter((g) => !excludedAppIds.has(g.app_id)).slice(0, 10);
  }, [highlyRatedGamesPool, shortGames, weekendGames]);

  const removeFromPools = useCallback((appId: number) => {
    setShortGamesPool((prev) => prev.filter((g) => g.app_id !== appId));
    setWeekendGamesPool((prev) => prev.filter((g) => g.app_id !== appId));
    setHighlyRatedGamesPool((prev) => prev.filter((g) => g.app_id !== appId));
  }, []);

  const addBackToPool = useCallback((game: GameWithImage) => {
    if (game.main_story_hours <= 5) {
      setShortGamesPool((prev) => [...prev, game]);
    } else if (game.main_story_hours <= 12) {
      setWeekendGamesPool((prev) => [...prev, game]);
    }
  }, []);

  return {
    shortGames,
    weekendGames,
    highlyRatedGames,
    carouselsLoading,
    removeFromPools,
    addBackToPool,
    setShortGamesPool,
    setWeekendGamesPool,
    setHighlyRatedGamesPool,
    setCarouselsLoading,
  };
}
