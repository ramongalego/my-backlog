'use client';

import { Gamepad2 } from 'lucide-react';
import { Header } from '@/components/Header';
import { GameCard } from '@/components/games/GameCard';
import { GamesFilter } from '@/components/games/GamesFilter';
import { GamesSearch } from '@/components/games/GamesSearch';
import { GamesSort } from '@/components/games/GamesSort';
import { useGamesPage } from '@/hooks/useGamesPage';

function GamesLoadingSkeleton() {
  return (
    <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4'>
      {[...Array(10)].map((_, i) => (
        <div
          key={i}
          className='bg-zinc-900 rounded-lg overflow-hidden animate-pulse'
        >
          <div className='h-40 sm:h-28 bg-zinc-800' />
          <div className='p-3 space-y-2'>
            <div className='h-4 bg-zinc-800 rounded w-3/4' />
            <div className='h-3 bg-zinc-800 rounded w-1/2' />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className='text-center py-16'>
      <Gamepad2 className='w-12 h-12 text-zinc-700 mx-auto mb-4' />
      <p className='text-zinc-500'>No games found</p>
    </div>
  );
}

export default function GamesPage() {
  const {
    games,
    loading,
    filter,
    setFilter,
    sort,
    setSort,
    filteredGames,
    counts,
    handleStatusChange,
    searchQuery,
    setSearchQuery,
  } = useGamesPage();

  if (loading) {
    return (
      <div className='min-h-screen bg-zinc-950'>
        <Header />
        <div className='pt-24 px-6'>
          <div className='max-w-6xl mx-auto'>
            <GamesLoadingSkeleton />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-zinc-950'>
      <Header />

      <main className='pt-24 pb-12 px-6'>
        <div className='max-w-6xl mx-auto'>
          <div className='flex flex-col gap-4 mb-8'>
            <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4'>
              <div className='shrink-0'>
                <h1 className='text-2xl font-bold text-zinc-100'>My Games</h1>
                <p className='text-zinc-500 text-sm mt-1'>
                  {games.length} games in library
                </p>
              </div>

              <GamesFilter
                filter={filter}
                counts={counts}
                onFilterChange={setFilter}
              />
            </div>

            <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-3'>
              <GamesSearch
                value={searchQuery}
                onSearchChange={setSearchQuery}
              />
              <GamesSort value={sort} onChange={setSort} />
            </div>
          </div>

          {filteredGames.length === 0 ? (
            <EmptyState />
          ) : (
            <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4'>
              {filteredGames.map(game => (
                <GameCard
                  key={game.app_id}
                  game={game}
                  onStatusChange={handleStatusChange}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
