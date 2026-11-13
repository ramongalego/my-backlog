'use client';

import { isSelectable, reviewsCleared, selectRange, toggleSelected } from '@/lib/games/bulk-status';
import type { BulkStatus } from '@/lib/games/status';
import type { GameSelection } from '@/components/games/GameCard';
import { useBulkStatus } from './useBulkStatus';
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
import { useQueue } from '@/hooks/useQueue';
import { useUrlState } from './useUrlState';
import { useGameDialog } from './useGameDialog';
import type { GameDialogProps } from '@/components/games/GameDetailModal';
import type { GameStatus } from '@/lib/games/status';

interface UseGamesPageReturn {
  games: GameItem[];
  loading: boolean;
  /** The first load failed: show that, not an empty page. */
  loadError: boolean;
  retry: () => void;
  filter: GameFilter;
  setFilter: (filter: GameFilter) => void;
  sort: GameSort;
  /** Picks a sort, in its usual order. */
  setSort: (sort: GameSort) => void;
  /** The sort runs the other way from its usual (lowest first, oldest first...). */
  reversed: boolean;
  reverse: () => void;
  /** A list column's heading: sort by it, or reverse it when it's the sort already. */
  sortBy: (sort: GameSort) => void;
  visibleGames: GameItem[];
  hasMore: boolean;
  loadMore: () => void;
  counts: FilterCounts;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  /** The detail dialog's props for the open game, or null when it's closed. */
  gameDialog: GameDialogProps | null;
  handleOpenDetail: (gameId: number) => void;
  queuedGameIds: Set<number>;
  /** Select mode's state and actions, or null when it's off. */
  selection: GamesSelection | null;
  toggleSelecting: () => void;
}

/** Select mode on the Games page: ticking games to move several at once. */
interface GamesSelection {
  /** Games ticked. */
  count: number;
  /** Games the page lists that can be ticked, loaded on screen or not. */
  total: number;
  /** A game's part in it, for its card or row. */
  of: (game: GameItem) => GameSelection;
  selectAll: () => void;
  clear: () => void;
  /** How many ticked games a move to a status would move: the ones not there already. */
  moves: (status: BulkStatus) => number;
  /** How many ticked games would lose a rating or notes by moving to a status. */
  reviewsCleared: (status: BulkStatus) => number;
  /** Moves the ticked games, and closes Select mode once they're saved. */
  move: (status: BulkStatus) => void;
  pending: boolean;
  stop: () => void;
}

const BATCH_SIZE = 60;

const SORT_ORDERS = ['usual', 'reversed'] as const;
type SortOrder = (typeof SORT_ORDERS)[number];

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

  // Filter, sort and search live in the URL so they survive navigating away
  // and back. Search keeps local state too so typing stays instant.
  const [filter, setFilter] = useUrlState<GameFilter>('filter', 'all', GAME_FILTERS);
  const [sort, setSort] = useUrlState<GameSort>('sort', 'score', GAME_SORTS);
  const [order, setOrder] = useUrlState<SortOrder>('order', 'usual', SORT_ORDERS);
  const reversed = order === 'reversed';
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
  const [opened, setOpened] = useState<GameItem | null>(null);
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);

  // Defer the search value to keep input responsive during filtering
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const statusMutation = useSetGameStatus(userId);

  // Select mode: games ticked to move together. The last one ticked is where
  // a shift-click's range starts.
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set());
  const [lastTicked, setLastTicked] = useState<number | null>(null);
  const bulk = useBulkStatus(userId);
  const stopSelecting = () => {
    setSelecting(false);
    setSelected(new Set());
    setLastTicked(null);
  };

  // The game as it was when its dialog opened.
  const handleOpenDetail = (gameId: number) => {
    const game = games.find((g) => g.id === gameId);
    if (game) setOpened(game);
  };

  const dialogFor = useGameDialog(userId);
  // When it was finished or dropped, for the dialog's date field.
  const openedDate =
    (opened?.status === 'finished'
      ? opened.finished_at?.slice(0, 10)
      : opened?.status === 'dropped'
        ? opened.dropped_at?.slice(0, 10)
        : null) ?? null;
  const gameDialog: GameDialogProps | null = opened && {
    game: opened,
    initialStatus: opened.status,
    initialDate: openedDate,
    initialNotes: opened.notes,
    initialRating: opened.rating,
    onClose: () => setOpened(null),
    onConfirm: (status: GameStatus, date: string, notes: string, rating: number | null) =>
      statusMutation.mutate({ gameId: opened.id, status, date, notes, rating }),
    // Playing it instead of another game: Undo puts it back as it was
    // (queued, backlog, finished with its date and review...).
    ...dialogFor(opened, {
      status: opened.status,
      from: {
        status: opened.status,
        date: openedDate ?? '',
        notes: opened.notes,
        rating: opened.rating,
      },
    }),
  };

  // What the page shows, from the deferred search text so typing stays
  // responsive. Counts follow the search, so each filter says how many of the
  // matches it holds.
  const searched = searchLibrary(games, deferredSearchQuery);
  const filteredGames = filterLibrary(searched, filter, sort, deferredSearchQuery, reversed);
  const counts = countLibrary(searched);

  const visibleGames = filteredGames.slice(0, visibleCount);

  // Everything the page lists that can be ticked, loaded on screen or not.
  const selectableIds = filteredGames
    .filter((game) => isSelectable(game, queuedGameIds))
    .map((game) => game.id);
  const ticked = games.filter((game) => selected.has(game.id));
  const selection: GamesSelection | null = selecting
    ? {
        count: ticked.length,
        total: selectableIds.length,
        of: (game) => ({
          selected: selected.has(game.id),
          selectable: isSelectable(game, queuedGameIds),
          onToggle: (range: boolean) => {
            setSelected((prev) =>
              range && lastTicked !== null
                ? selectRange(selectableIds, prev, lastTicked, game.id)
                : toggleSelected(prev, game.id),
            );
            setLastTicked(game.id);
          },
        }),
        selectAll: () => setSelected((prev) => new Set([...prev, ...selectableIds])),
        clear: () => setSelected(new Set()),
        moves: (status: BulkStatus) => ticked.filter((game) => game.status !== status).length,
        reviewsCleared: (status: BulkStatus) => reviewsCleared(ticked, status),
        // The move is the point of selecting: the bar says "Moving…" while
        // it's saved, then Select mode closes as the toast offers the Undo. If
        // the save fails it stays open, the games still ticked, to try again.
        move: (status: BulkStatus) => bulk.move(ticked, status, stopSelecting),
        pending: bulk.pending,
        stop: stopSelecting,
      }
    : null;

  const hasMore = visibleCount < filteredGames.length;

  const loadMore = () => {
    setVisibleCount((prev) => prev + BATCH_SIZE);
  };

  const setFilterAndReset = (f: GameFilter) => {
    setFilter(f);
    setVisibleCount(BATCH_SIZE);
  };

  const setSortAndReset = (s: GameSort) => {
    setSort(s);
    setOrder('usual');
    setVisibleCount(BATCH_SIZE);
  };

  const reverse = () => {
    setOrder(reversed ? 'usual' : 'reversed');
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
    reversed,
    reverse,
    sortBy: (s: GameSort) => (s === sort ? reverse() : setSortAndReset(s)),
    visibleGames,
    hasMore,
    loadMore,
    counts,
    searchQuery,
    setSearchQuery: setSearchQueryAndReset,
    gameDialog,
    handleOpenDetail,
    queuedGameIds,
    selection,
    toggleSelecting: () => (selecting ? stopSelecting() : setSelecting(true)),
  };
}
