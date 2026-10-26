'use client';

import { useState, useDeferredValue } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { loadGamesList, type GameItem } from '@/lib/data/loaders';
import { parseReleaseDate } from '@/lib/games/release-date';
import { updateGameStatus } from '@/lib/games/status';
import { queryKeys } from '@/lib/query-keys';
import { useInvalidateQueries, usePatchGamesList } from '@/lib/mutations';
import { statusChangeFrom } from '@/lib/games/status-rules';
import { toast } from 'sonner';
import { useAuth } from './useAuth';
import { useAddToQueue, useQueue } from './useNowPlaying';
import { useUrlState } from './useUrlState';
import { useManualGameActions } from './useManualGame';

export type { GameItem };

const GAME_FILTERS = ['all', 'backlog', 'finished', 'dropped', 'wont_play', 'hidden'] as const;
const GAME_SORTS = ['playtime', 'score', 'rating', 'recent', 'released', 'length'] as const;
export type GameFilter = (typeof GAME_FILTERS)[number];
export type GameSort = (typeof GAME_SORTS)[number];

// Steam gives display dates like "Sep 28, 2010"; "To be announced" and missing
// dates parse to NaN and sort last. Parsed once per row: a sort compares each
// game many times, and parsing dominated sorting a big library. Refetched or
// patched rows are new objects, so they're parsed afresh.
const releaseTimes = new WeakMap<GameItem, number>();
function releaseTime(game: GameItem): number {
  let time = releaseTimes.get(game);
  if (time === undefined) {
    time = parseReleaseDate(game.release_date) ?? -Infinity;
    releaseTimes.set(game, time);
  }
  return time;
}

// Ratings only mean something on finished or dropped games. Some older rows
// kept a rating after moving back to the backlog, so those count as unrated.
function myRating(game: GameItem): number {
  const rated = game.status === 'finished' || game.status === 'dropped';
  return rated && game.rating != null ? game.rating : -1;
}

/** Sort comparator for the Games page. */
export function compareGames(a: GameItem, b: GameItem, sort: GameSort): number {
  switch (sort) {
    case 'score':
      return (b.steam_review_weighted ?? 0) - (a.steam_review_weighted ?? 0);
    case 'rating':
      // Your own rating, highest first; ties show the most recently finished
      // first. Unrated games follow, by Steam score.
      return (
        myRating(b) - myRating(a) ||
        (b.finished_at ?? '').localeCompare(a.finished_at ?? '') ||
        (b.steam_review_weighted ?? 0) - (a.steam_review_weighted ?? 0)
      );
    case 'recent':
      // When the game joined the library. The first sync imports everything
      // at once, so ties fall back to the newest on Steam.
      return (
        b.created_at.localeCompare(a.created_at) || (b.app_id ?? 0) - (a.app_id ?? 0) || b.id - a.id
      );
    case 'released':
      return releaseTime(b) - releaseTime(a) || b.id - a.id;
    case 'length': {
      const aHours = a.main_story_hours ?? Infinity;
      const bHours = b.main_story_hours ?? Infinity;
      return aHours - bHours;
    }
    case 'playtime':
    default:
      return b.playtime_forever - a.playtime_forever;
  }
}

export interface FilterCounts {
  all: number;
  backlog: number;
  finished: number;
  dropped: number;
  wont_play: number;
  hidden: number;
}

interface GamesPageStatusModal {
  gameId: number;
  gameName: string;
  headerImage: string | null;
  initialStatus: 'backlog' | 'playing' | 'finished' | 'dropped' | 'wont_play' | 'hidden';
  initialDate: string | null;
  initialNotes: string | null;
  initialRating: number | null;
  mainStoryHours: number | null;
  steamReviewScore: number | null;
  steamReviewCount: number | null;
  playtimeMinutes: number;
  lastPlayedAt: string | null;
  deckCompat?: number | null;
  /** Set for games added by hand, which can be edited and removed. */
  manual: { platform: string | null } | null;
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
  handleOpenDetail: (gameId: number) => void;
  handleAddToQueue: (gameId: number) => Promise<void>;
  handleSaveHours: (gameId: number, hours: number) => Promise<void>;
  handleDelete: (gameId: number) => void;
  queuedGameIds: Set<number>;
}

const BATCH_SIZE = 60;

export function useGamesPage(): UseGamesPageReturn {
  const queryClient = useQueryClient();
  const { statusChanged } = useInvalidateQueries();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const gamesList = usePatchGamesList(userId);

  const gamesKey = queryKeys.games.list(userId ?? '');
  const { data: games = [], isPending } = useQuery({
    queryKey: gamesKey,
    queryFn: () => loadGamesList(createClient(), userId!),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });

  const { queuedGameIds } = useQueue(userId);
  const addGameToQueue = useAddToQueue(userId);

  // Filter, sort and search live in the URL so they survive navigating away
  // and back. Search keeps local state too so typing stays instant.
  const [filter, setFilter] = useUrlState<GameFilter>('filter', 'backlog', GAME_FILTERS);
  const [sort, setSort] = useUrlState<GameSort>('sort', 'score', GAME_SORTS);
  const [urlSearch, setUrlSearch] = useUrlState<string>('q', '');
  const [searchQuery, setSearchQueryState] = useState(urlSearch);
  const [statusModal, setStatusModal] = useState<GamesPageStatusModal | null>(null);
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);

  // Defer the search value to keep input responsive during filtering
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const statusMutation = useMutation({
    mutationFn: async (vars: {
      gameId: number;
      status: string;
      date: string;
      notes: string;
      rating: number | null;
    }) => {
      await updateGameStatus(vars.gameId, vars.status, {
        finishedAt: vars.status === 'finished' ? vars.date : undefined,
        droppedAt: vars.status === 'dropped' ? vars.date : undefined,
        notes: vars.notes,
        rating: vars.rating,
      });
    },
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: gamesKey });
      return { previous: gamesList.patch(statusChangeFrom(vars)) };
    },
    onError: (err, _vars, context) => {
      console.error(err);
      gamesList.restore(context?.previous);
      toast.error('Could not save your changes. Please try again.');
    },
    onSettled: () => statusChanged(),
  });

  const handleOpenDetail = (gameId: number) => {
    const game = games.find((g) => g.id === gameId);
    if (!game) return;

    const status = (game.status ?? 'backlog') as
      'backlog' | 'playing' | 'finished' | 'dropped' | 'wont_play' | 'hidden';
    const initialDate =
      status === 'finished'
        ? (game.finished_at?.slice(0, 10) ?? null)
        : status === 'dropped'
          ? (game.dropped_at?.slice(0, 10) ?? null)
          : null;

    setStatusModal({
      gameId,
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
      lastPlayedAt: game.last_played_at,
      deckCompat: game.deck_compat,
      manual: game.source === 'manual' ? { platform: game.platform } : null,
    });
  };

  const handleConfirmDetail = async (
    status: string,
    date: string,
    notes: string,
    rating: number | null,
  ) => {
    if (!statusModal) return;
    statusMutation.mutate({ gameId: statusModal.gameId, status, date, notes, rating });
  };

  const handleCloseStatusModal = () => setStatusModal(null);

  const handleAddToQueue = async (gameId: number) => {
    const game = games.find((g) => g.id === gameId);
    if (game) addGameToQueue(game);
  };

  // Games added by hand: hours played (consoles don't report it) and removal,
  // shared with every other page's detail dialog.
  const manualGames = useManualGameActions(userId);
  const handleSaveHours = manualGames.saveHours;
  const handleDelete = (gameId: number) =>
    manualGames.remove(gameId, games.find((g) => g.id === gameId)?.name ?? 'the game');

  // Search-only filtered games (no status filter) — used for dynamic counts and as base for filteredGames
  const searchFilteredGames = (() => {
    if (!deferredSearchQuery) return games;
    const searchLower = deferredSearchQuery.toLowerCase();
    return games.filter((game) => {
      const nameMatch = game.name.toLowerCase().includes(searchLower);
      const tagMatch = game.tags?.some((tag) => tag.toLowerCase().includes(searchLower)) ?? false;
      return nameMatch || tagMatch;
    });
  })();

  // Filter and sort games — uses deferredSearchQuery so input stays responsive
  const filteredGames = (() => {
    const filtered = searchFilteredGames.filter((game) => {
      // "All" excludes only hidden — wont_play games are still part of the
      // library and should appear under All alongside their own tab.
      if (filter === 'all' && game.status === 'hidden') return false;
      // Playing games appear under both "all" and "backlog" (like queued games)
      if (
        filter === 'backlog' &&
        game.status &&
        game.status !== 'backlog' &&
        game.status !== 'playing'
      )
        return false;
      if (filter !== 'all' && filter !== 'backlog' && game.status !== filter) return false;
      return true;
    });

    return filtered.sort((a, b) => compareGames(a, b, sort));
  })();

  const visibleGames = filteredGames.slice(0, visibleCount);

  const hasMore = visibleCount < filteredGames.length;

  const loadMore = () => {
    setVisibleCount((prev) => prev + BATCH_SIZE);
  };

  // Derived directly from the full games array — not search-filtered — so a search query
  // for a backlog game never hides the now playing game from the count.
  const hasPlayingGame = games.some((g) => g.status === 'playing');

  // Single pass over search-filtered games to compute all counts at once.
  // Playing games count under both `all` and `backlog` (like queued games).
  // Hidden games only count under `hidden`.
  const counts: FilterCounts = (() => {
    const result = { all: 0, backlog: 0, finished: 0, dropped: 0, wont_play: 0, hidden: 0 };
    for (const game of searchFilteredGames) {
      const s = game.status;
      if (s === 'hidden') {
        result.hidden++;
      } else if (s === 'wont_play') {
        result.all++;
        result.wont_play++;
      } else if (s === 'finished') {
        result.all++;
        result.finished++;
      } else if (s === 'dropped') {
        result.all++;
        result.dropped++;
      } else {
        // null or 'backlog'
        result.all++;
        result.backlog++;
      }
    }
    return result;
  })();

  const setFilterAndReset = (f: GameFilter) => {
    setFilter(f);
    setVisibleCount(BATCH_SIZE);
  };

  const setSortAndReset = (s: GameSort) => {
    setSort(s);
    setVisibleCount(BATCH_SIZE);
  };

  const setSearchQueryAndReset = (q: string) => {
    setSearchQueryState(q);
    setUrlSearch(q.trim());
    setVisibleCount(BATCH_SIZE);
  };

  return {
    games,
    loading: !!userId && isPending,
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
    handleSaveHours,
    handleDelete,
    queuedGameIds,
  };
}
