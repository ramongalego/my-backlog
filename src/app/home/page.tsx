'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/Button';
import { GameCarousel } from '@/components/GameCarousel';
import { CurrentlyPlaying } from '@/components/CurrentlyPlaying';
import { SyncProgress } from '@/components/SyncProgress';
import { LandingPage } from '@/components/LandingPage';
import { SuggestionModal } from '@/components/suggest';
import { GameDetailModal } from '@/components/games/GameStatusModal';
import { GameSummaryModal } from '@/components/games/GameSummaryModal';
import {
  LoadingState,
  CarouselsLoadingState,
  StatusLoadingState,
} from '@/components/home/HomeLoadingStates';
import { useGameLibrary } from '@/hooks/useGameLibrary';
import { Dices } from 'lucide-react';

function HomeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isSuggestionModalOpen, setIsSuggestionModalOpen] = useState(false);

  const {
    user,
    profile,
    isLoading,
    shortGames,
    weekendGames,
    highlyRatedGames,
    currentlyPlaying,
    isSyncing,
    syncProgress,
    syncingGames,
    carouselsLoading,
    isStatusLoading,
    handlePickGame,
    handleFinishGame,
    handleDropGame,
    handleQueueGame,
    handleCancelGame,
    handleRandomPick,
    handleConnectSteam,
    statusModal,
    gameSummary,
    queuedAppIds,
    carouselModal,
    handleOpenCarouselDetail,
    handleConfirmCarouselDetail,
    handleCloseCarouselModal,
    handleConfirmStatusChange,
    handleCloseStatusModal,
    handleCloseSummary,
  } = useGameLibrary();

  useEffect(() => {
    if (searchParams.has('error')) {
      router.replace('/home', { scroll: false });
    }
  }, [searchParams, router]);

  const handleSuggestionPick = useCallback(
    async (
      appId: number,
      name: string,
      headerImage: string | null,
      mainStoryHours: number | null,
    ) => {
      await handlePickGame({
        app_id: appId,
        name,
        header_image: headerImage,
        main_story_hours: mainStoryHours ?? 0,
        playtime_forever: 0,
      });
    },
    [handlePickGame],
  );

  const isSteamConnected = profile?.steam_id != null;
  const showDashboard = user && isSteamConnected;

  if (isLoading) {
    return <LoadingState />;
  }

  if (!showDashboard) {
    return <LandingPage user={user} onConnectSteam={handleConnectSteam} />;
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      <Header hideNavLinks={isSyncing} />

      <main className="pt-16 flex-1">
        <section className="max-w-7xl mx-auto px-6 py-12">
          <div className="flex flex-col items-center text-center">
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
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  size="lg"
                  className="cursor-pointer"
                  onClick={() => setIsSuggestionModalOpen(true)}
                >
                  Pick My Game
                </Button>
                <button
                  onClick={handleRandomPick}
                  className="cursor-pointer p-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
                  title="Pick a random game"
                >
                  <Dices className="w-5 h-5 text-zinc-100" />
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Game carousels */}
        {!isSyncing && carouselsLoading && <CarouselsLoadingState />}

        {!isSyncing &&
          !carouselsLoading &&
          (shortGames.length > 0 || weekendGames.length > 0 || highlyRatedGames.length > 0) && (
            <section className="max-w-7xl mx-auto px-6 pb-24 space-y-16">
              {shortGames.length > 0 && (
                <GameCarousel
                  title="Top-Rated Games Under 5 Hours"
                  games={shortGames}
                  onOpenDetail={handleOpenCarouselDetail}
                />
              )}
              {highlyRatedGames.length > 0 && (
                <GameCarousel
                  title="Highly Rated, Never Played"
                  games={highlyRatedGames}
                  onOpenDetail={handleOpenCarouselDetail}
                />
              )}
              {weekendGames.length > 0 && (
                <GameCarousel
                  title="Beat It in a Weekend"
                  games={weekendGames}
                  onOpenDetail={handleOpenCarouselDetail}
                />
              )}
            </section>
          )}
      </main>

      <footer className="py-6 border-t border-zinc-800">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="text-sm text-zinc-500">MyBacklog</p>
        </div>
      </footer>

      <SuggestionModal
        isOpen={isSuggestionModalOpen}
        onClose={() => setIsSuggestionModalOpen(false)}
        onPick={handleSuggestionPick}
      />

      {gameSummary && (
        <GameSummaryModal isOpen={true} onClose={handleCloseSummary} {...gameSummary} />
      )}

      {carouselModal && (
        <GameDetailModal
          isOpen={true}
          onClose={handleCloseCarouselModal}
          onConfirm={handleConfirmCarouselDetail}
          gameName={carouselModal.game.name}
          headerImage={carouselModal.game.header_image}
          initialStatus="backlog"
          disablePlaying={!!currentlyPlaying}
          onAddToQueue={
            currentlyPlaying && !queuedAppIds.has(carouselModal.game.app_id)
              ? () => handleQueueGame(carouselModal.game)
              : undefined
          }
        />
      )}

      {statusModal && currentlyPlaying && (
        <GameDetailModal
          isOpen={true}
          onClose={handleCloseStatusModal}
          onConfirm={handleConfirmStatusChange}
          gameName={currentlyPlaying.name}
          headerImage={currentlyPlaying.header_image}
          initialStatus={statusModal.action}
          initialDate={new Date().toISOString().slice(0, 10)}
        />
      )}
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-950" />}>
      <HomeContent />
    </Suspense>
  );
}
