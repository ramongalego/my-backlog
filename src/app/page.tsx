'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/Button';
import { GameCarousel } from '@/components/GameCarousel';
import { CurrentlyPlaying } from '@/components/CurrentlyPlaying';
import { SyncProgress } from '@/components/SyncProgress';
import { LandingPage } from '@/components/LandingPage';
import { useGameLibrary } from '@/hooks/useGameLibrary';
import { RefreshCw, Dices } from 'lucide-react';

function LoadingState() {
  return (
    <div className='min-h-screen bg-zinc-950 flex flex-col'>
      <Header />
      <main className='pt-16 flex-1 flex items-center justify-center'>
        <div className='space-y-6 text-center'>
          <div className='inline-flex items-center gap-3 px-4 py-2 bg-zinc-800 rounded-lg'>
            <div className='w-8 h-8 bg-zinc-700 rounded animate-pulse' />
            <div className='w-24 h-4 bg-zinc-700 rounded animate-pulse' />
            <span className='text-zinc-700'>·</span>
            <div className='w-16 h-4 bg-zinc-700 rounded animate-pulse' />
          </div>
          <div className='h-12 w-40 mx-auto bg-zinc-800 rounded-lg animate-pulse' />
        </div>
      </main>
    </div>
  );
}

function CarouselsLoadingState() {
  return (
    <section className='max-w-6xl mx-auto px-6 pb-24 space-y-24'>
      {[1, 2].map(i => (
        <div key={i} className='space-y-6'>
          <div className='h-8 w-64 bg-zinc-800 rounded animate-pulse' />
          <div className='flex gap-4'>
            {[1, 2, 3, 4].map(j => (
              <div
                key={j}
                className='shrink-0 w-64 bg-zinc-900 rounded-lg overflow-hidden'
              >
                <div className='h-32 bg-zinc-800 animate-pulse' />
                <div className='p-4 space-y-2'>
                  <div className='h-4 bg-zinc-800 rounded w-3/4 animate-pulse' />
                  <div className='h-3 bg-zinc-800 rounded w-1/2 animate-pulse' />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

function StatusLoadingState() {
  return (
    <div className='w-full max-w-md mx-auto'>
      <div className='h-4 w-32 bg-zinc-800 rounded animate-pulse mx-auto mb-3' />
      <div className='bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800'>
        <div className='h-48 bg-zinc-800 animate-pulse' />
        <div className='p-5 space-y-4'>
          <div className='h-6 w-3/4 bg-zinc-800 rounded animate-pulse' />
          <div className='h-4 w-1/3 bg-zinc-800 rounded animate-pulse' />
          <div className='flex gap-3 pt-2'>
            <div className='flex-1 h-10 bg-zinc-800 rounded-lg animate-pulse' />
            <div className='flex-1 h-10 bg-zinc-800 rounded-lg animate-pulse' />
          </div>
        </div>
      </div>
    </div>
  );
}

function CelebrationMessage({ gameName }: { gameName: string }) {
  return (
    <div className='flex flex-col items-center gap-4'>
      <div className='flex items-center gap-2'>
        <div className='h-12 w-36 bg-zinc-800 rounded-lg animate-pulse' />
        <div className='h-12 w-12 bg-zinc-800 rounded-lg animate-pulse' />
      </div>
      <p className='text-lg text-zinc-100 animate-celebration'>
        You finished{' '}
        <span className='font-semibold text-transparent bg-clip-text bg-linear-to-r from-violet-400 to-fuchsia-400'>
          {gameName}
        </span>
        !
      </p>
    </div>
  );
}

function HomeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const {
    user,
    profile,
    isLoading,
    gameCount,
    shortGames,
    weekendGames,
    currentlyPlaying,
    isSyncing,
    syncProgress,
    syncingGames,
    carouselsLoading,
    isRefreshing,
    isStatusLoading,
    celebrationMessage,
    handlePickGame,
    handleFinishGame,
    handleDropGame,
    handleHideGame,
    handleCancelGame,
    handleRefreshLibrary,
    handleRandomPick,
    handleConnectSteam,
  } = useGameLibrary();

  useEffect(() => {
    if (searchParams.has('error')) {
      router.replace('/', { scroll: false });
    }
  }, [searchParams, router]);

  const isSteamConnected = profile?.steam_id != null;
  const showDashboard = user && isSteamConnected;

  if (isLoading) {
    return <LoadingState />;
  }

  if (!showDashboard) {
    return <LandingPage user={user} onConnectSteam={handleConnectSteam} />;
  }

  return (
    <div className='min-h-screen bg-zinc-950 flex flex-col'>
      <Header hideGamesLink={isSyncing || carouselsLoading} />

      <main className='pt-16 flex-1'>
        <section className='max-w-6xl mx-auto px-6 py-12'>
          <div className='flex flex-col items-center text-center'>
            {/* Profile bar */}
            <div className='inline-flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 bg-zinc-800 rounded-lg mb-8'>
              {profile?.steam_avatar && (
                <Image
                  src={profile.steam_avatar}
                  alt=''
                  width={32}
                  height={32}
                  className='rounded'
                />
              )}
              <span className='text-zinc-100 text-sm sm:text-base'>
                {profile?.steam_username}
              </span>
              {!isSyncing && (
                <>
                  <span className='text-zinc-500 hidden sm:inline'>·</span>
                  <span className='text-zinc-400 text-sm sm:text-base'>
                    {gameCount} games
                  </span>
                </>
              )}
              <button
                onClick={handleRefreshLibrary}
                disabled={isRefreshing || isSyncing}
                className='cursor-pointer ml-1 p-1 text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-50'
                title='Check for new games'
              >
                <RefreshCw
                  className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`}
                />
              </button>
            </div>

            {/* Main content area */}
            {isSyncing ? (
              <SyncProgress progress={syncProgress} games={syncingGames} />
            ) : currentlyPlaying ? (
              <CurrentlyPlaying
                game={currentlyPlaying}
                onFinish={handleFinishGame}
                onDrop={handleDropGame}
                onCancel={handleCancelGame}
                isLoading={isStatusLoading}
              />
            ) : isStatusLoading ? (
              <StatusLoadingState />
            ) : celebrationMessage ? (
              <CelebrationMessage gameName={celebrationMessage} />
            ) : (
              <div className='flex items-center gap-2'>
                <Button size='lg' className='cursor-pointer'>
                  Pick My Game
                </Button>
                <button
                  onClick={handleRandomPick}
                  className='cursor-pointer p-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors'
                  title='Pick a random game'
                >
                  <Dices className='w-5 h-5 text-zinc-100' />
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Game carousels */}
        {!isSyncing && carouselsLoading && <CarouselsLoadingState />}

        {!isSyncing &&
          !carouselsLoading &&
          (shortGames.length > 0 || weekendGames.length > 0) && (
            <section className='max-w-6xl mx-auto px-6 pb-24 space-y-24'>
              {shortGames.length > 0 && (
                <GameCarousel
                  title='Games Under 5 Hours'
                  games={shortGames}
                  onPickGame={!currentlyPlaying ? handlePickGame : undefined}
                  onHideGame={handleHideGame}
                />
              )}
              {weekendGames.length > 0 && (
                <GameCarousel
                  title='Games You Can Finish This Weekend'
                  games={weekendGames}
                  onPickGame={!currentlyPlaying ? handlePickGame : undefined}
                  onHideGame={handleHideGame}
                />
              )}
            </section>
          )}
      </main>

      <footer className='py-6 border-t border-zinc-800'>
        <div className='max-w-6xl mx-auto px-6 text-center'>
          <p className='text-sm text-zinc-500'>MyBacklog</p>
        </div>
      </footer>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className='min-h-screen bg-zinc-950' />}>
      <HomeContent />
    </Suspense>
  );
}
