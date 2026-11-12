'use client';

import { useEffect, useRef } from 'react';
import { Gamepad2, Plus } from 'lucide-react';
import { SteamIcon } from '@/components/ui/SteamIcon';

import { GameCard } from '@/components/games/GameCard';
import { GameList } from '@/components/games/GameList';
import { GamesViewToggle } from '@/components/games/GamesViewToggle';
import { useGamesView } from '@/hooks/useGamesView';
import { GameDetailModal } from '@/components/games/GameDetailModal';
import { GamesFilter } from '@/components/games/GamesFilter';
import { GamesPageSkeleton } from './Skeleton';
import { useCachedLibraryMeta } from '@/hooks/useLibraryMeta';
import { GamesSearch } from '@/components/games/GamesSearch';
import { GamesSort } from '@/components/games/GamesSort';
import { useGamesPage } from '@/hooks/useGamesPage';
import type { GameFilter } from '@/lib/games/library-filter';
import { Page, PageHeader } from '@/components/layout/Page';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadError } from '@/components/ui/LoadError';
import { Button } from '@/components/ui/Button';
import { useAddGame } from '@/components/games/AddGameProvider';
import { useAuth } from '@/hooks/useAuth';
import { connectSteam } from '@/lib/client/steam-connect';

const EMPTY_COPY: Record<GameFilter, string> = {
  all: 'Add the games you own, on any console, or connect Steam to bring in your whole library.',
  backlog: "Your backlog is clear. Games you haven't started or decided on show up here.",
  finished:
    'Nothing finished yet. Mark a game as finished from its details to log it in your diary.',
  dropped: 'No dropped games. Games you give up on end up here.',
  wont_play: "Nothing marked Won't Play. Use it for games you never plan to start.",
  hidden: 'No hidden games.',
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
    gameDialog,
    handleOpenDetail,
    queuedGameIds,
  } = useGamesPage();
  const { open: openAddGame } = useAddGame();
  const isSteamConnected = !!useAuth().profile?.steam_id;
  const libraryMeta = useCachedLibraryMeta();
  const [view, setView] = useGamesView();
  // In All and Backlog the badge tells statuses apart (e.g. Playing); in a
  // single-status filter it would repeat the filter on every game.
  const showStatus = filter === 'all' || filter === 'backlog';

  const sentinelRef = useRef<HTMLDivElement>(null);

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
            </span>
          </span>
        }
        actions={<GamesFilter filter={filter} counts={counts} onFilterChange={setFilter} />}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <GamesSearch value={searchQuery} onSearchChange={setSearchQuery} />
          <div className="flex items-center justify-between sm:justify-end gap-4">
            <GamesViewToggle value={view} onChange={setView} />
            <GamesSort value={sort} onChange={setSort} reversed={reversed} onReverse={reverse} />
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
            Try a different name or tag, or switch filters.
            {isSteamConnected && ' Not on Steam? Add it by hand.'}
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
                  {!isSteamConnected && (
                    <Button variant="secondary" onClick={connectSteam}>
                      <SteamIcon className="w-4 h-4" />
                      Connect Steam
                    </Button>
                  )}
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
                />
              ))}
            </div>
          )}
          <div ref={sentinelRef} />
        </>
      )}
    </Page>
  );
}
