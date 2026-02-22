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
  notes: string | null;
  rating: number | null;
  finished_at: string | null;
  dropped_at: string | null;
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

interface GamesPageStatusModal {
  appId: number;
  gameName: string;
  headerImage: string | null;
  initialStatus: 'backlog' | 'finished' | 'dropped' | 'hidden';
  initialDate: string | null;
  initialNotes: string | null;
  initialRating: number | null;
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
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  statusModal: GamesPageStatusModal | null;
  handleConfirmDetail: (
    status: string,
    date: string,
    notes: string,
    rating: number | null,
  ) => Promise<void>;
  handleCloseStatusModal: () => void;
  handleOpenDetail: (appId: number) => void;
}

export function useGamesPage(): UseGamesPageReturn {
  const [games, setGames] = useState<GameItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<GameFilter>('all');
  const [sort, setSort] = useState<GameSort>('playtime');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusModal, setStatusModal] = useState<GamesPageStatusModal | null>(null);

  // Defer the search value to keep input responsive during filtering
  const deferredSearchQuery = useDeferredValue(searchQuery);

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
          'app_id, name, playtime_forever, steam_review_score, steam_review_count, steam_review_weighted, header_image, main_story_hours, status, notes, rating, finished_at, dropped_at',
        )
        .eq('user_id', user.id)
        .eq('type', 'game')
        .order('playtime_forever', { ascending: false });

      setGames(data || []);
      setLoading(false);
    }

    loadGames();
  }, []);

  const handleOpenDetail = useCallback(
    (appId: number) => {
      const game = games.find((g) => g.app_id === appId);
      if (!game) return;

      const status = (game.status ?? 'backlog') as 'backlog' | 'finished' | 'dropped' | 'hidden';
      const initialDate =
        status === 'finished'
          ? (game.finished_at?.slice(0, 10) ?? null)
          : status === 'dropped'
            ? (game.dropped_at?.slice(0, 10) ?? null)
            : null;

      setStatusModal({
        appId,
        gameName: game.name,
        headerImage: game.header_image,
        initialStatus: status,
        initialDate,
        initialNotes: game.notes,
        initialRating: game.rating,
      });
    },
    [games],
  );

  const handleConfirmDetail = useCallback(
    async (status: string, date: string, notes: string, rating: number | null) => {
      if (!statusModal) return;
      const { appId } = statusModal;
      setStatusModal(null);
      try {
        await fetch('/api/games/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            appId,
            status,
            ...(status === 'finished' ? { finishedAt: date } : {}),
            ...(status === 'dropped' ? { droppedAt: date } : {}),
            notes,
            rating,
          }),
        });
        setGames((prev) =>
          prev.map((g) =>
            g.app_id === appId
              ? {
                  ...g,
                  status,
                  notes,
                  rating,
                  ...(status === 'finished' ? { finished_at: date } : {}),
                  ...(status === 'dropped' ? { dropped_at: date } : {}),
                }
              : g,
          ),
        );
      } catch (err) {
        console.error('Failed to update game:', err);
      }
    },
    [statusModal],
  );

  const handleCloseStatusModal = useCallback(() => setStatusModal(null), []);

  // Memoize filtered and sorted games to avoid recalculation on unrelated state changes
  // Uses deferredSearchQuery so input stays responsive during large list filtering
  const filteredGames = useMemo(() => {
    const searchLower = deferredSearchQuery.toLowerCase();

    const filtered = games.filter((game) => {
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
          return b.app_id - a.app_id;
        case 'playtime':
        default:
          return b.playtime_forever - a.playtime_forever;
      }
    });
  }, [games, filter, sort, deferredSearchQuery]);

  const counts: FilterCounts = {
    all: games.length,
    backlog: games.filter((g) => !g.status || g.status === 'backlog').length,
    finished: games.filter((g) => g.status === 'finished').length,
    dropped: games.filter((g) => g.status === 'dropped').length,
    hidden: games.filter((g) => g.status === 'hidden').length,
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
    searchQuery,
    setSearchQuery,
    statusModal,
    handleConfirmDetail,
    handleCloseStatusModal,
    handleOpenDetail,
  };
}
