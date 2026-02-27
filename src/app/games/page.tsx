'use client';

import { useEffect, useRef } from 'react';
import { Gamepad2 } from 'lucide-react';
import { Header } from '@/components/Header';
import { GameCard } from '@/components/games/GameCard';
import { GameDetailModal } from '@/components/games/GameStatusModal';
import { GamesFilter } from '@/components/games/GamesFilter';
import { GamesSearch } from '@/components/games/GamesSearch';
import { GamesSort } from '@/components/games/GamesSort';
import { useGamesPage } from '@/hooks/useGamesPage';

function GamesLoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {[...Array(10)].map((_, i) => (
        <div key={i} className="bg-zinc-900 rounded-lg overflow-hidden animate-pulse">
          <div className="h-40 sm:h-28 bg-zinc-800" />
          <div className="p-3 space-y-2">
            <div className="h-4 bg-zinc-800 rounded w-3/4" />
            <div className="h-3 bg-zinc-800 rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-16">
      <Gamepad2 className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
      <p className="text-zinc-500">No games found</p>
    </div>
  );
}

export default function GamesPage() {
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
    return (
      <div className="min-h-screen bg-zinc-950">
        <Header />
        <div className="pt-24">
          <div className="max-w-7xl mx-auto px-6">
            <GamesLoadingSkeleton />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <Header />

      <main className="pt-24 pb-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col gap-4 mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="shrink-0">
                <h1 className="text-2xl font-bold text-zinc-100">My Games</h1>
                <p className="flex items-center gap-1 text-zinc-500 text-sm mt-1">
                  <span>{counts.all}</span>
                  {searchQuery && (
                    <span className="text-violet-400 font-medium">{searchQuery}</span>
                  )}
                  <span>games in library</span>
                </p>
              </div>

              <GamesFilter filter={filter} counts={counts} onFilterChange={setFilter} />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <GamesSearch value={searchQuery} onSearchChange={setSearchQuery} />
              <GamesSort value={sort} onChange={setSort} />
            </div>
          </div>

          {visibleGames.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {visibleGames.map((game) => (
                  <GameCard key={game.app_id} game={game} onOpenDetail={handleOpenDetail} />
                ))}
              </div>
              <div ref={sentinelRef} />
            </>
          )}
        </div>
      </main>

      {statusModal && (
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
              ? () => handleAddToQueue(statusModal.appId, statusModal.gameName)
              : undefined
          }
        />
      )}
    </div>
  );
}
