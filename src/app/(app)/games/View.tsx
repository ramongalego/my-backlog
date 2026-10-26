'use client';

import { useEffect, useRef } from 'react';
import { Gamepad2, Plus } from 'lucide-react';

import { GameCard } from '@/components/games/GameCard';
import { GameDetailModal } from '@/components/games/GameStatusModal';
import { GamesFilter } from '@/components/games/GamesFilter';
import { GamesPageSkeleton } from '@/components/games/GamesPageSkeleton';
import { GamesSearch } from '@/components/games/GamesSearch';
import { GamesSort } from '@/components/games/GamesSort';
import { useGamesPage, type GameFilter } from '@/hooks/useGamesPage';
import { Page, PageHeader } from '@/components/layout/Page';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { useAddGame } from '@/components/games/AddGameProvider';

const EMPTY_COPY: Record<GameFilter, string> = {
  all: 'Your Steam library is empty, or still syncing.',
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
    filter,
    setFilter,
    sort,
    setSort,
    visibleGames,
    hasMore,
    loadMore,
    counts,
    hasPlayingGame,
    searchQuery,
    setSearchQuery,
    statusModal,
    handleConfirmDetail,
    handleCloseStatusModal,
    handleOpenDetail,
    handleAddToQueue,
    queuedGameIds,
  } = useGamesPage();
  const { open: openAddGame } = useAddGame();

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
    return <GamesPageSkeleton />;
  }

  return (
    <Page
      overlay={
        statusModal && (
          <GameDetailModal
            isOpen={true}
            onClose={handleCloseStatusModal}
            onConfirm={handleConfirmDetail}
            gameName={statusModal.gameName}
            headerImage={statusModal.headerImage}
            initialStatus={statusModal.initialStatus}
            initialDate={statusModal.initialDate}
            initialNotes={statusModal.initialNotes}
            initialRating={statusModal.initialRating}
            mainStoryHours={statusModal.mainStoryHours}
            steamReviewScore={statusModal.steamReviewScore}
            steamReviewCount={statusModal.steamReviewCount}
            playtimeMinutes={statusModal.playtimeMinutes}
            lastPlayedAt={statusModal.lastPlayedAt}
            deckCompat={statusModal.deckCompat}
            disablePlaying={hasPlayingGame && statusModal.initialStatus !== 'playing'}
            onAddToQueue={
              hasPlayingGame && statusModal.initialStatus === 'backlog'
                ? () => handleAddToQueue(statusModal.gameId)
                : undefined
            }
            manual={statusModal.manual}
          />
        )
      }
    >
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
          <GamesSort value={sort} onChange={setSort} />
        </div>
      </PageHeader>

      {visibleGames.length === 0 ? (
        searchQuery.trim().length > 0 ? (
          <EmptyState
            icon={Gamepad2}
            title="No games match your search."
            action={
              // The moment you notice a game is missing is when you search for it.
              <Button variant="secondary" onClick={() => openAddGame(searchQuery.trim())}>
                <Plus className="w-4 h-4" aria-hidden="true" />
                Add “{searchQuery.trim()}” from another console
              </Button>
            }
          >
            Try a different name or tag, or switch filters. Not on Steam? Add it by hand.
          </EmptyState>
        ) : (
          <EmptyState icon={Gamepad2} title="Nothing here yet.">
            {EMPTY_COPY[filter]}
          </EmptyState>
        )
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-3 sm:gap-x-4 gap-y-5 sm:gap-y-6">
            {visibleGames.map((game) => (
              <GameCard
                key={game.id}
                game={game}
                onOpenDetail={handleOpenDetail}
                queued={queuedGameIds.has(game.id)}
                // In All and Backlog the badge tells statuses apart (e.g. Playing);
                // in a single-status filter it would repeat the filter on every card.
                showStatus={filter === 'all' || filter === 'backlog'}
              />
            ))}
          </div>
          <div ref={sentinelRef} />
        </>
      )}
    </Page>
  );
}
