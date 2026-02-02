'use client';

import { useState, useEffect, useCallback, useMemo, useDeferredValue } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface GameItem {
  app_id: number;
  name: string;
  playtime_forever: number;
  steam_review_score: number | null;
  steam_review_count: number | null;
  steam_review_weighted: number | null;
  header_image: string | null;
  main_story_hours: number | null;
  status: string | null;
}

export type GameFilter = 'all' | 'backlog' | 'finished' | 'dropped' | 'hidden';
export type GameSort = 'playtime' | 'score' | 'recent';

export interface FilterCounts {
  all: number;
  backlog: number;
  finished: number;
  dropped: number;
  hidden: number;
}

interface UseGamesPageReturn {
  games: GameItem[];
  loading: boolean;
  filter: GameFilter;
  setFilter: (filter: GameFilter) => void;
  sort: GameSort;
  setSort: (sort: GameSort) => void;
  filteredGames: GameItem[];
  counts: FilterCounts;
  handleStatusChange: (appId: number, status: string) => Promise<void>;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  isSearching: boolean;
}

export function useGamesPage(): UseGamesPageReturn {
  const [games, setGames] = useState<GameItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<GameFilter>('all');
  const [sort, setSort] = useState<GameSort>('playtime');
  const [searchQuery, setSearchQuery] = useState('');

  // Defer the search value to keep input responsive during filtering
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const isSearching = searchQuery !== deferredSearchQuery;

  useEffect(() => {
    async function loadGames() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from('games')
        .select(
          'app_id, name, playtime_forever, steam_review_score, steam_review_count, steam_review_weighted, header_image, main_story_hours, status',
        )
        .eq('user_id', user.id)
        .eq('type', 'game')
        .order('playtime_forever', { ascending: false });

      setGames(data || []);
      setLoading(false);
    }

    loadGames();
  }, []);

  const handleStatusChange = useCallback(async (appId: number, status: string) => {
    try {
      await fetch('/api/games/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId, status }),
      });
      setGames(prev =>
        prev.map(g => (g.app_id === appId ? { ...g, status } : g)),
      );
    } catch (err) {
      console.error('Failed to update game status:', err);
    }
  }, []);

  // Memoize filtered and sorted games to avoid recalculation on unrelated state changes
  // Uses deferredSearchQuery so input stays responsive during large list filtering
  const filteredGames = useMemo(() => {
    const searchLower = deferredSearchQuery.toLowerCase();

    const filtered = games.filter(game => {
      // Status filter
      if (filter === 'all' && game.status === 'hidden') return false;
      if (filter === 'backlog' && game.status && game.status !== 'backlog') return false;
      if (filter !== 'all' && filter !== 'backlog' && game.status !== filter) return false;

      // Search filter
      if (searchLower && !game.name.toLowerCase().includes(searchLower)) {
        return false;
      }

      return true;
    });

    // Sort the filtered results
    return filtered.sort((a, b) => {
      switch (sort) {
        case 'score':
          return (b.steam_review_weighted ?? 0) - (a.steam_review_weighted ?? 0);
        case 'recent':
          return (b.app_id) - (a.app_id);
        case 'playtime':
        default:
          return b.playtime_forever - a.playtime_forever;
      }
    });
  }, [games, filter, sort, deferredSearchQuery]);

  const counts: FilterCounts = {
    all: games.length,
    backlog: games.filter(g => !g.status || g.status === 'backlog').length,
    finished: games.filter(g => g.status === 'finished').length,
    dropped: games.filter(g => g.status === 'dropped').length,
    hidden: games.filter(g => g.status === 'hidden').length,
  };

  return {
    games,
    loading,
    filter,
    setFilter,
    sort,
    setSort,
    filteredGames,
    counts,
    handleStatusChange,
    searchQuery,
    setSearchQuery,
    isSearching,
  };
}
