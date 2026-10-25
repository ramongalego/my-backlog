'use client';

import { useEffect, useRef } from 'react';
import { Gamepad2 } from 'lucide-react';

import { GameCard } from '@/components/games/GameCard';
import { GameDetailModal } from '@/components/games/GameStatusModal';
import { GamesFilter } from '@/components/games/GamesFilter';
import { GamesPageSkeleton } from '@/components/games/GamesPageSkeleton';
import { GamesSearch } from '@/components/games/GamesSearch';
import { GamesSort } from '@/components/games/GamesSort';
import { useGamesPage } from '@/hooks/useGamesPage';
import { Page, PageHeader } from '@/components/layout/Page';

function EmptyState({ searching }: { searching: boolean }) {
  return (
    <div className="text-center py-16">
      <Gamepad2 className="w-12 h-12 text-zinc-600 mx-auto mb-4" aria-hidden="true" />
      <p className="text-zinc-500">
        {searching ? 'No games match your search.' : 'Nothing here yet.'}
      </p>
      <p className="text-zinc-600 text-sm mt-1">
        {searching
          ? 'Try a different search or switch filters.'
          : 'Games will show up here once they match this filter.'}
      </p>
    </div>
  );
}

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
    queuedAppIds,
  } = useGamesPage();

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
            deckCompat={statusModal.deckCompat}
            disablePlaying={hasPlayingGame && statusModal.initialStatus !== 'playing'}
            onAddToQueue={
              hasPlayingGame && statusModal.initialStatus === 'backlog'
                ? () => handleAddToQueue(statusModal.appId)
                : undefined
            }
          />
        )
      }
    >
      <PageHeader
        title="My Games"
        description={
          <span className="flex flex-wrap items-center gap-1" role="status" aria-live="polite">
            <span>{counts[filter]}</span>
            {searchQuery && <span className="text-violet-400 font-medium">{searchQuery}</span>}
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
        <EmptyState searching={searchQuery.trim().length > 0} />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {visibleGames.map((game) => (
              <GameCard
                key={game.app_id}
                game={game}
                onOpenDetail={handleOpenDetail}
                queued={queuedAppIds.has(game.app_id)}
              />
            ))}
          </div>
          <div ref={sentinelRef} />
        </>
      )}
    </Page>
  );
}
