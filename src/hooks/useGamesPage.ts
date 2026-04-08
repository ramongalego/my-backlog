'use client';

import { useState, useCallback, useMemo, useDeferredValue } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { fetchQueuedAppIds, addToQueue } from '@/lib/games/queue';
import { queryKeys } from '@/lib/query-keys';
import { useInvalidateGameQueries } from '@/lib/mutations';
import { toast } from 'sonner';

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
  deck_compat?: number | null;
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
  mainStoryHours: number | null;
  steamReviewScore: number | null;
  steamReviewCount: number | null;
  playtimeMinutes: number;
  deckCompat?: number | null;
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
  handleAddToQueue: (appId: number, gameName: string) => Promise<void>;
  queuedAppIds: Set<number>;
}

const BATCH_SIZE = 60;

interface GamesData {
  games: GameItem[];
  queuedAppIds: Set<number>;
}

async function fetchGamesData(): Promise<GamesData> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { games: [], queuedAppIds: new Set<number>() };

  const [{ data }, queuedIds] = await Promise.all([
    supabase
      .from('games')
      .select(
        'app_id, name, playtime_forever, steam_review_score, steam_review_count, steam_review_weighted, header_image, main_story_hours, status, notes, rating, finished_at, dropped_at, tags, deck_compat',
      )
      .eq('user_id', user.id)
      .eq('type', 'game')
      .order('playtime_forever', { ascending: false }),
    fetchQueuedAppIds(),
  ]);

  return { games: (data || []) as GameItem[], queuedAppIds: queuedIds };
}

export function useGamesPage(): UseGamesPageReturn {
  const queryClient = useQueryClient();
  const invalidateGameQueries = useInvalidateGameQueries();

  const { data, isPending } = useQuery({
    queryKey: queryKeys.games.list(),
    queryFn: fetchGamesData,
    staleTime: 5 * 60 * 1000,
  });

  const games = useMemo(() => data?.games ?? [], [data?.games]);
  const queuedAppIds = useMemo(() => data?.queuedAppIds ?? new Set<number>(), [data?.queuedAppIds]);

  const [filter, setFilter] = useState<GameFilter>('all');
  const [sort, setSort] = useState<GameSort>('playtime');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusModal, setStatusModal] = useState<GamesPageStatusModal | null>(null);
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);

  // Defer the search value to keep input responsive during filtering
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const statusMutation = useMutation({
    mutationFn: async (vars: {
      appId: number;
      status: string;
      date: string;
      notes: string;
      rating: number | null;
    }) => {
      await fetch('/api/games/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appId: vars.appId,
          status: vars.status,
          ...(vars.status === 'finished' ? { finishedAt: vars.date } : {}),
          ...(vars.status === 'dropped' ? { droppedAt: vars.date } : {}),
          ...(vars.status === 'playing' ? { started_at: new Date().toISOString() } : {}),
          notes: vars.notes,
          rating: vars.rating,
        }),
      });
    },
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.games.list() });
      const previous = queryClient.getQueryData<GamesData>(queryKeys.games.list());
      queryClient.setQueryData(queryKeys.games.list(), (old: GamesData | undefined) => {
        if (!old) return old;
        return {
          ...old,
          games: old.games.map((g) =>
            g.app_id === vars.appId
              ? {
                  ...g,
                  status: vars.status,
                  notes: vars.notes,
                  rating: vars.rating,
                  ...(vars.status === 'finished' ? { finished_at: vars.date || null } : {}),
                  ...(vars.status === 'dropped' ? { dropped_at: vars.date || null } : {}),
                }
              : g,
          ),
        };
      });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.games.list(), context.previous);
      }
    },
    onSettled: () => invalidateGameQueries(),
  });

  const queueMutation = useMutation({
    mutationFn: async (vars: { appId: number; gameName: string }) => {
      const ok = await addToQueue(vars.appId);
      return ok;
    },
    onSuccess: (ok, vars) => {
      if (ok) {
        queryClient.setQueryData(queryKeys.games.list(), (old: GamesData | undefined) => {
          if (!old) return old;
          return { ...old, queuedAppIds: new Set([...old.queuedAppIds, vars.appId]) };
        });
        toast.success(`${vars.gameName} added to the queue!`);
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.queue.all }),
  });

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
        mainStoryHours: game.main_story_hours,
        steamReviewScore: game.steam_review_score,
        steamReviewCount: game.steam_review_count,
        playtimeMinutes: game.playtime_forever,
        deckCompat: game.deck_compat,
      });
    },
    [games],
  );

  const handleConfirmDetail = useCallback(
    async (status: string, date: string, notes: string, rating: number | null) => {
      if (!statusModal) return;
      statusMutation.mutate({ appId: statusModal.appId, status, date, notes, rating });
    },
    [statusModal, statusMutation],
  );

  const handleCloseStatusModal = useCallback(() => setStatusModal(null), []);

  const handleAddToQueue = useCallback(
    async (appId: number, gameName: string) => {
      queueMutation.mutate({ appId, gameName });
    },
    [queueMutation],
  );

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
    loading: isPending,
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
