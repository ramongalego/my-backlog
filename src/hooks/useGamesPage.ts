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
  countPlatforms,
  filterLibrary,
  libraryPlatforms,
  onPlatform,
  searchLibrary,
  type FilterCounts,
  type GameFilter,
  type GameSort,
} from '@/lib/games/library-filter';
import { useAuth } from './useAuth';
import { useQueue } from '@/hooks/useQueue';
import { useUrlState } from './useUrlState';
import { useLibraryGameDialog } from './useLibraryGameDialog';
import type { GameDialogProps } from '@/components/games/GameDetailModal';

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
  /**
   * Null when there's nothing to choose between, under the status filter too.
   * Stays while a platform is chosen: it's the way back to all of them.
   */
  platforms: GamesPlatforms | null;
  /** The detail dialog's props for the open game, or null when it's closed. */
  gameDialog: GameDialogProps | null;
  handleOpenDetail: (gameId: number) => void;
  queuedGameIds: Set<number>;
  /** Select mode's state and actions, or null when it's off. */
  selection: GamesSelection | null;
  toggleSelecting: () => void;
}

interface GamesPlatforms {
  /** '' for all of them. */
  value: string;
  set: (platform: string) => void;
  /**
   * Platforms with games under the status filter and search. The chosen one
   * stays even at zero, so the menu always has what it's set to.
   */
  options: { value: string; count: number }[];
  /** How many games every platform together lists. */
  allCount: number;
}

interface GamesSelection {
  count: number;
  /** Games the page lists that can be ticked, loaded on screen or not. */
  total: number;
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
  // Only a platform the library has, and only when there's a choice: a
  // bookmarked ?platform= for a console whose games are gone shows everything.
  const allPlatforms = libraryPlatforms(games);
  const platformChoices = allPlatforms.length > 1 ? allPlatforms : [];
  const [platform, setPlatform] = useUrlState<string>('platform', '', platformChoices);
  const [urlSearch, setUrlSearch] = useUrlState<string>('q', '');
  const [searchQuery, setSearchQueryState] = useState(urlSearch);
  // The URL also changes from outside the box (the header's Games link) with
  // the page still mounted, so the box follows it. A URL matching the trimmed
  // text is the box's own change.
  const [seenUrlSearch, setSeenUrlSearch] = useState(urlSearch);
  if (urlSearch !== seenUrlSearch) {
    setSeenUrlSearch(urlSearch);
    if (urlSearch !== searchQuery.trim()) setSearchQueryState(urlSearch);
  }
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);

  const deferredSearchQuery = useDeferredValue(searchQuery);

  // The last game ticked is where a shift-click's range starts.
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set());
  const [lastTicked, setLastTicked] = useState<number | null>(null);
  const bulk = useBulkStatus(userId);
  const stopSelecting = () => {
    setSelecting(false);
    setSelected(new Set());
    setLastTicked(null);
  };

  const { gameDialog, openGame: handleOpenDetail } = useLibraryGameDialog(userId);

  // Each status filter's count follows the search and platform; each
  // platform's count follows the search and status filter.
  const searched = searchLibrary(games, deferredSearchQuery);
  const listed = onPlatform(searched, platform);
  const filteredGames = filterLibrary(listed, filter, sort, deferredSearchQuery, reversed);
  const counts = countLibrary(listed);
  const perPlatform = countPlatforms(searched, filter);
  // Not from the search, so the control beside the search field doesn't come
  // and go as you type.
  const platformsToChoose = countPlatforms(games, filter).size;
  const showPlatforms = platformChoices.length > 0 && (platform !== '' || platformsToChoose > 1);

  const visibleGames = filteredGames.slice(0, visibleCount);

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
        clear: () => {
          setSelected(new Set());
          setLastTicked(null);
        },
        moves: (status: BulkStatus) => ticked.filter((game) => game.status !== status).length,
        reviewsCleared: (status: BulkStatus) => reviewsCleared(ticked, status),
        // Select mode closes once saved, as the toast offers Undo; if the save
        // fails it stays open with the games still ticked.
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

  const setPlatformAndReset = (p: string) => {
    setPlatform(p);
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
    platforms: showPlatforms
      ? {
          value: platform,
          set: setPlatformAndReset,
          // A platform with nothing to list here would be a dead end: with
          // Backlog on, most of a library's old consoles have none.
          options: platformChoices
            .map((value) => ({ value, count: perPlatform.get(value) ?? 0 }))
            .filter((option) => option.count > 0 || option.value === platform),
          allCount: countLibrary(searched)[filter],
        }
      : null,
    gameDialog,
    handleOpenDetail,
    queuedGameIds,
    selection,
    toggleSelecting: () => (selecting ? stopSelecting() : setSelecting(true)),
  };
}
