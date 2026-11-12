'use client';

import { useState, useDeferredValue } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { GameItem } from '@/lib/data/loaders';
import { queries } from '@/lib/data/queries';
import {
  GAME_FILTERS,
  GAME_SORTS,
  countLibrary,
  filterLibrary,
  searchLibrary,
  type FilterCounts,
  type GameFilter,
  type GameSort,
} from '@/lib/games/library-filter';
import { useSetGameStatus } from '@/hooks/useGameMutations';
import { useAuth } from './useAuth';
import { useAddToQueue, useQueue, useRemoveFromQueue } from '@/hooks/useQueue';
import { useSwitchGame } from './useSwitchGame';
import { useUrlState } from './useUrlState';
import { useManualGameActions } from './useManualGameActions';
import type { GameStatus } from '@/lib/games/status';

interface GamesPageStatusModal {
  /** The game as it was when the dialog opened. */
  game: GameItem;
  /** When it was finished or dropped, for the dialog's date field. */
  initialDate: string | null;
  /** The detail dialog's `manual` prop (hours, removal, back to Steam), for games on a console. */
  manual: ReturnType<ReturnType<typeof useManualGameActions>['dialogProps']>;
}

interface UseGamesPageReturn {
  games: GameItem[];
  loading: boolean;
  /** The first load failed: show that, not an empty page. */
  loadError: boolean;
  retry: () => void;
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
  /** Plays the open game instead of the one being played. */
  handlePlayInstead: () => Promise<void>;
  /** The game being played, which that would pause. */
  playingName: string | null;
  handleConfirmDetail: (
    status: GameStatus,
    date: string,
    notes: string,
    rating: number | null,
  ) => Promise<void>;
  handleCloseStatusModal: () => void;
  handleOpenDetail: (gameId: number) => void;
  handleAddToQueue: (gameId: number) => Promise<void>;
  /** Takes a queued game off the queue, with Undo; it stays in the backlog. */
  handleRemoveFromQueue: (gameId: number) => void;
  queuedGameIds: Set<number>;
}

const BATCH_SIZE = 60;

export function useGamesPage(): UseGamesPageReturn {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const {
    data: games = [],
    isPending,
    isLoadingError,
    refetch,
  } = useQuery(queries.gamesList(userId));

  const { queuedGameIds } = useQueue(userId);
  const addGameToQueue = useAddToQueue(userId);
  const removeFromQueue = useRemoveFromQueue(userId);
  const switchGame = useSwitchGame(userId);

  // Filter, sort and search live in the URL so they survive navigating away
  // and back. Search keeps local state too so typing stays instant.
  const [filter, setFilter] = useUrlState<GameFilter>('filter', 'all', GAME_FILTERS);
  const [sort, setSort] = useUrlState<GameSort>('sort', 'score', GAME_SORTS);
  const [urlSearch, setUrlSearch] = useUrlState<string>('q', '');
  const [searchQuery, setSearchQueryState] = useState(urlSearch);
  // The URL also changes from outside the box (Games in the header, View on a
  // game just added), and the page stays mounted when only the query changes:
  // the box follows it. Typing writes the trimmed text to the URL, so a URL
  // that matches what's typed is the box's own change and is left alone.
  const [seenUrlSearch, setSeenUrlSearch] = useState(urlSearch);
  if (urlSearch !== seenUrlSearch) {
    setSeenUrlSearch(urlSearch);
    if (urlSearch !== searchQuery.trim()) setSearchQueryState(urlSearch);
  }
  const [statusModal, setStatusModal] = useState<GamesPageStatusModal | null>(null);
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);

  // Defer the search value to keep input responsive during filtering
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const statusMutation = useSetGameStatus(userId);

  const manualGames = useManualGameActions(userId);

  const handleOpenDetail = (gameId: number) => {
    const game = games.find((g) => g.id === gameId);
    if (!game) return;

    const initialDate =
      game.status === 'finished'
        ? (game.finished_at?.slice(0, 10) ?? null)
        : game.status === 'dropped'
          ? (game.dropped_at?.slice(0, 10) ?? null)
          : null;

    setStatusModal({ game, initialDate, manual: manualGames.dialogProps(game) });
  };

  const handleConfirmDetail = async (
    status: GameStatus,
    date: string,
    notes: string,
    rating: number | null,
  ) => {
    if (!statusModal) return;
    statusMutation.mutate({ gameId: statusModal.game.id, status, date, notes, rating });
  };

  const handleCloseStatusModal = () => setStatusModal(null);

  // The dialog's Playing while another game is playing: play this one
  // instead. Undo puts it back as it was (queued, backlog, finished...).
  const handlePlayInstead = async () => {
    if (!statusModal) return;
    const game = games.find((g) => g.id === statusModal.game.id);
    if (!game) return;
    await switchGame.switchTo(game, {
      status: statusModal.game.status,
      date: statusModal.initialDate ?? '',
      notes: statusModal.game.notes,
      rating: statusModal.game.rating,
    });
  };

  const handleAddToQueue = async (gameId: number) => {
    const game = games.find((g) => g.id === gameId);
    if (game) addGameToQueue(game);
  };

  // What the page shows, from the deferred search text so typing stays
  // responsive. Counts follow the search, so each filter says how many of the
  // matches it holds.
  const searched = searchLibrary(games, deferredSearchQuery);
  const filteredGames = filterLibrary(searched, filter, sort, deferredSearchQuery);
  const counts = countLibrary(searched);

  const visibleGames = filteredGames.slice(0, visibleCount);

  const hasMore = visibleCount < filteredGames.length;

  const loadMore = () => {
    setVisibleCount((prev) => prev + BATCH_SIZE);
  };

  // Derived directly from the full games array — not search-filtered — so a search query
  // for a backlog game never hides the now playing game from the count.
  const hasPlayingGame = games.some((g) => g.status === 'playing');

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
    loadError: isLoadingError,
    retry: () => void refetch(),
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
    handlePlayInstead,
    playingName: switchGame.playing?.name ?? null,
    handleCloseStatusModal,
    handleOpenDetail,
    handleAddToQueue,
    handleRemoveFromQueue: removeFromQueue,
    queuedGameIds,
  };
}
