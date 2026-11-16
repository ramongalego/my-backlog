'use client';

import { useCallback, useEffect, useRef } from 'react';
import { Gamepad2, Plus } from 'lucide-react';
import { ConnectSteamButton } from '@/components/ui/ConnectSteamButton';

import { GameCard } from '@/components/games/GameCard';
import { GameList } from '@/components/games/GameList';
import { GamesViewToggle } from '@/components/games/GamesViewToggle';
import { GamesSelectToggle } from '@/components/games/GamesSelectToggle';
import { GamesBulkBar } from '@/components/games/GamesBulkBar';
import { useGamesView } from '@/hooks/useGamesView';
import { GameDetailModal } from '@/components/games/GameDetailModal';
import { GamesFilter } from '@/components/games/GamesFilter';
import { GamesPageSkeleton } from './Skeleton';
import { useCachedLibraryMeta } from '@/hooks/useLibraryMeta';
import { GamesSearch } from '@/components/games/GamesSearch';
import { GamesSort } from '@/components/games/GamesSort';
import { GamesPlatform } from '@/components/games/GamesPlatform';
import { useGamesPage } from '@/hooks/useGamesPage';
import type { GameFilter } from '@/lib/games/library-filter';
import { Page, PageHeader } from '@/components/layout/Page';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadError } from '@/components/ui/LoadError';
import { Button } from '@/components/ui/Button';
import { useAddGame } from '@/components/games/AddGameProvider';
import { useAuth } from '@/hooks/useAuth';
import { useConnectSteam } from '@/hooks/useConnectSteam';

const EMPTY_COPY: Record<GameFilter, string> = {
  all: 'Add the games you own, on any console, or connect Steam to bring in your whole library',
  backlog: "Your backlog is clear. Games you haven't started or decided on show up here.",
  finished:
    'Nothing finished yet. Mark a game as finished from its details to log it in your diary.',
  dropped: 'No dropped games. Games you give up on end up here.',
  wont_play: "Nothing marked Won't Play. Use it for games you never plan to start.",
  hidden: 'No hidden games',
};

export default function GamesView() {
  const {
    loading,
    loadError,
    retry,
    filter,
    setFilter,
    sort,
    setSort,
    reversed,
    reverse,
    sortBy,
    visibleGames,
    hasMore,
    loadMore,
    counts,
    searchQuery,
    setSearchQuery,
    platforms,
    gameDialog,
    handleOpenDetail,
    queuedGameIds,
    selection,
    toggleSelecting,
  } = useGamesPage();
  const { open: openAddGame } = useAddGame();
  const isSteamConnected = !!useAuth().profile?.steam_id;
  const { connect: connectSteam } = useConnectSteam();
  const libraryMeta = useCachedLibraryMeta();
  const [view, setView] = useGamesView();
  // In All and Backlog the badge tells statuses apart (e.g. Playing); in a
  // single-status filter it would repeat the filter on every game.
  const showStatus = filter === 'all' || filter === 'backlog';

  const sentinelRef = useRef<HTMLDivElement>(null);
  // Select, the view switch and Sort: where focus goes if the platform menu
  // before them leaves the page while it has it.
  const controlsRef = useRef<HTMLDivElement>(null);
  const focusControls = useCallback(
    () => controlsRef.current?.querySelector('button')?.focus(),
    [],
  );

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: '300px' },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  if (loading) {
    return <GamesPageSkeleton empty={libraryMeta?.gameCount === 0} view={view} />;
  }

  // Counts, filters and search would all describe an empty library.
  if (loadError) {
    return (
      <Page>
        <PageHeader title="My Games" />
        <LoadError what="your games" onRetry={retry} />
      </Page>
    );
  }

  return (
    <Page overlay={gameDialog && <GameDetailModal isOpen {...gameDialog} />}>
      <PageHeader
        title="My Games"
        description={
          <span className="flex flex-wrap items-center gap-1" role="status" aria-live="polite">
            <span className="tabular-nums">{counts[filter]}</span>
            {searchQuery && <span className="text-ink-100 font-medium">“{searchQuery}”</span>}
            <span>
              {counts[filter] === 1 ? 'game' : 'games'}{' '}
              {filter === 'all'
                ? 'in library'
                : filter === 'backlog'
                  ? 'in the backlog'
                  : filter === 'finished'
                    ? 'finished'
                    : filter === 'dropped'
                      ? 'dropped'
                      : filter === 'wont_play'
                        ? "you won't play"
                        : 'hidden'}
              {/* Said here too: below md the platform menu is its icon alone. */}
              {platforms?.value && ` on ${platforms.value}`}
            </span>
          </span>
        }
        actions={<GamesFilter filter={filter} counts={counts} onFilterChange={setFilter} />}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* What's listed: the search, and the platform when there's more
              than one to choose between. */}
          <div className="flex min-w-0 items-center gap-2">
            <GamesSearch value={searchQuery} onSearchChange={setSearchQuery} />
            <GamesPlatform platforms={platforms} onGone={focusControls} />
          </div>
          {/* One row of controls on the same surface, 8px apart: what to act
              on, how it's laid out, what order it's in. On phones the sort
              keeps the right edge. They keep their size when the row is tight:
              the search field is what gives way. */}
          <div ref={controlsRef} className="flex shrink-0 items-center gap-2">
            <GamesSelectToggle on={!!selection} onToggle={toggleSelecting} />
            <GamesViewToggle value={view} onChange={setView} />
            <div className="ml-auto sm:ml-0">
              <GamesSort value={sort} onChange={setSort} reversed={reversed} onReverse={reverse} />
            </div>
          </div>
        </div>
      </PageHeader>

      {visibleGames.length === 0 ? (
        searchQuery.trim().length > 0 ? (
          <EmptyState
            icon={Gamepad2}
            title="No games match your search"
            action={
              // The moment you notice a game is missing is when you search for it.
              <Button variant="secondary" onClick={() => openAddGame(searchQuery.trim())}>
                <Plus className="w-4 h-4" aria-hidden="true" />
                {/* Without Steam, every game is added by hand. */}
                Add “{searchQuery.trim()}”{isSteamConnected && ' from another console'}
              </Button>
            }
          >
            {/* One sentence alone has no period; with the second, both do. */}
            {isSteamConnected
              ? 'Try a different name or tag, or switch filters. Not on Steam? Add it by hand.'
              : 'Try a different name or tag, or switch filters'}
          </EmptyState>
        ) : platforms?.value ? (
          // The status filter may well have games: just none on this platform.
          <EmptyState
            icon={Gamepad2}
            title={`No ${platforms.value} games here`}
            action={
              <Button variant="secondary" onClick={() => platforms.set('')}>
                All platforms
              </Button>
            }
          >
            Switch filters, or show every platform
          </EmptyState>
        ) : (
          <EmptyState
            icon={Gamepad2}
            title="Nothing here yet"
            action={
              filter === 'all' && (
                <div className="flex flex-wrap justify-center gap-2">
                  <Button onClick={() => openAddGame()}>
                    <Plus className="w-4 h-4" aria-hidden="true" />
                    Add a game
                  </Button>
                  {!isSteamConnected && <ConnectSteamButton onClick={connectSteam} />}
                </div>
              )
            }
          >
            {filter === 'all' && isSteamConnected
              ? 'Your Steam library is empty, or still syncing. Games from other consoles can be added by hand.'
              : EMPTY_COPY[filter]}
          </EmptyState>
        )
      ) : (
        <>
          {view === 'list' ? (
            <GameList
              games={visibleGames}
              queuedGameIds={queuedGameIds}
              showStatus={showStatus}
              sort={sort}
              reversed={reversed}
              onSortChange={sortBy}
              onOpenDetail={handleOpenDetail}
              selectionFor={selection?.of}
            />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-3 sm:gap-x-4 gap-y-5 sm:gap-y-6">
              {visibleGames.map((game) => (
                <GameCard
                  key={game.id}
                  game={game}
                  onOpenDetail={handleOpenDetail}
                  queued={queuedGameIds.has(game.id)}
                  showStatus={showStatus}
                  selection={selection?.of(game)}
                />
              ))}
            </div>
          )}
          <div ref={sentinelRef} />
        </>
      )}

      {selection && (
        <>
          {/* Room for the last games to scroll clear of the bar. */}
          <div className="h-56 sm:h-28" aria-hidden="true" />
          <GamesBulkBar
            count={selection.count}
            total={selection.total}
            onSelectAll={selection.selectAll}
            onClear={selection.clear}
            moves={selection.moves}
            reviewsCleared={selection.reviewsCleared}
            onMove={selection.move}
            pending={selection.pending}
            onClose={selection.stop}
          />
        </>
      )}
    </Page>
  );
}
