'use client';

import { useState, useEffect, useCallback, useMemo, useDeferredValue } from 'react';
import { createClient } from '@/lib/supabase/client';
import { fetchQueuedAppIds, addToQueue } from '@/lib/games/queue';

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
  tags: string[] | null;
}

export type GameFilter = 'all' | 'playing' | 'backlog' | 'finished' | 'dropped' | 'hidden';
export type GameSort = 'playtime' | 'score' | 'recent';

export interface FilterCounts {
  all: number;
  playing: number;
  backlog: number;
  finished: number;
  dropped: number;
  hidden: number;
}

interface GamesPageStatusModal {
  appId: number;
  gameName: string;
  headerImage: string | null;
  initialStatus: 'backlog' | 'playing' | 'finished' | 'dropped' | 'hidden';
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
  visibleGames: GameItem[];
  hasMore: boolean;
  loadMore: () => void;
  counts: FilterCounts;
  hasPlayingGame: boolean;
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
  handleAddToQueue: (appId: number) => Promise<void>;
  queuedAppIds: Set<number>;
}

const BATCH_SIZE = 60;

export function useGamesPage(): UseGamesPageReturn {
  const [games, setGames] = useState<GameItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<GameFilter>('all');
  const [sort, setSort] = useState<GameSort>('playtime');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusModal, setStatusModal] = useState<GamesPageStatusModal | null>(null);
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const [queuedAppIds, setQueuedAppIds] = useState<Set<number>>(new Set());

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

      const [{ data }, queuedIds] = await Promise.all([
        supabase
          .from('games')
          .select(
            'app_id, name, playtime_forever, steam_review_score, steam_review_count, steam_review_weighted, header_image, main_story_hours, status, notes, rating, finished_at, dropped_at, tags',
          )
          .eq('user_id', user.id)
          .eq('type', 'game')
          .order('playtime_forever', { ascending: false }),
        fetchQueuedAppIds(),
      ]);

      setGames(data || []);
      setQueuedAppIds(queuedIds);

      setLoading(false);
    }

    loadGames();
  }, []);

  const handleOpenDetail = useCallback(
    (appId: number) => {
      const game = games.find((g) => g.app_id === appId);
      if (!game) return;

      const status = (game.status ?? 'backlog') as
        | 'backlog'
        | 'playing'
        | 'finished'
        | 'dropped'
        | 'hidden';
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
            ...(status === 'playing' ? { started_at: new Date().toISOString() } : {}),
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
                  ...(status === 'finished' ? { finished_at: date || null } : {}),
                  ...(status === 'dropped' ? { dropped_at: date || null } : {}),
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

  const handleAddToQueue = useCallback(async (appId: number) => {
    const ok = await addToQueue(appId);
    if (ok) setQueuedAppIds((prev) => new Set([...prev, appId]));
  }, []);

  // Search-only filtered games (no status filter) — used for dynamic counts and as base for filteredGames
  const searchFilteredGames = useMemo(() => {
    if (!deferredSearchQuery) return games;
    const searchLower = deferredSearchQuery.toLowerCase();
    return games.filter((game) => {
      const nameMatch = game.name.toLowerCase().includes(searchLower);
      const tagMatch = game.tags?.some((tag) => tag.toLowerCase().includes(searchLower)) ?? false;
      return nameMatch || tagMatch;
    });
  }, [games, deferredSearchQuery]);

  // Memoize filtered and sorted games to avoid recalculation on unrelated state changes
  // Uses deferredSearchQuery so input stays responsive during large list filtering
  const filteredGames = useMemo(() => {
    const filtered = searchFilteredGames.filter((game) => {
      if (filter === 'all' && game.status === 'hidden') return false;
      if (filter === 'backlog' && game.status && game.status !== 'backlog') return false;
      if (filter !== 'all' && filter !== 'backlog' && game.status !== filter) return false;
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
  }, [searchFilteredGames, filter, sort]);

  const visibleGames = useMemo(
    () => filteredGames.slice(0, visibleCount),
    [filteredGames, visibleCount],
  );

  const hasMore = visibleCount < filteredGames.length;

  const loadMore = useCallback(() => {
    setVisibleCount((prev) => prev + BATCH_SIZE);
  }, []);

  // Derived directly from the full games array — not search-filtered — so a search query
  // for a backlog game never hides the now playing game from the count.
  const hasPlayingGame = useMemo(() => games.some((g) => g.status === 'playing'), [games]);

  // Single pass over search-filtered games to compute all counts at once
  const counts = useMemo((): FilterCounts => {
    const result = { all: 0, playing: 0, backlog: 0, finished: 0, dropped: 0, hidden: 0 };
    for (const game of searchFilteredGames) {
      const s = game.status;
      if (s === 'hidden') {
        result.hidden++;
      } else if (s === 'finished') {
        result.all++;
        result.finished++;
      } else if (s === 'dropped') {
        result.all++;
        result.dropped++;
      } else if (s === 'playing') {
        result.all++;
        result.playing++;
      } else {
        // null or 'backlog'
        result.all++;
        result.backlog++;
      }
    }
    return result;
  }, [searchFilteredGames]);

  const setFilterAndReset = useCallback((f: GameFilter) => {
    setFilter(f);
    setVisibleCount(BATCH_SIZE);
  }, []);

  const setSortAndReset = useCallback((s: GameSort) => {
    setSort(s);
    setVisibleCount(BATCH_SIZE);
  }, []);

  const setSearchQueryAndReset = useCallback((q: string) => {
    setSearchQuery(q);
    setVisibleCount(BATCH_SIZE);
  }, []);

  return {
    games,
    loading,
    filter,
    setFilter: setFilterAndReset,
    sort,
    setSort: setSortAndReset,
    visibleGames,
    hasMore,
    loadMore,
    counts,
    hasPlayingGame,
    searchQuery,
    setSearchQuery: setSearchQueryAndReset,
    statusModal,
    handleConfirmDetail,
    handleCloseStatusModal,
    handleOpenDetail,
    handleAddToQueue,
    queuedAppIds,
  };
}
