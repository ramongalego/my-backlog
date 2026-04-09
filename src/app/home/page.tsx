'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

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
import { Dices, Sparkles } from 'lucide-react';

function HomeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isSuggestionModalOpen, setIsSuggestionModalOpen] = useState(false);

  const {
    user,
    profile,
    isLoading,
    historyCount,
    shortGames,
    weekendGames,
    highlyRatedGames,
    hiddenGems,
    recentlyAdded,
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

  const handleSuggestionAction = async (
    appId: number,
    name: string,
    headerImage: string | null,
    mainStoryHours: number | null,
  ) => {
    const game = {
      app_id: appId,
      name,
      header_image: headerImage,
      main_story_hours: mainStoryHours ?? 0,
      playtime_forever: 0,
    };
    await (currentlyPlaying ? handleQueueGame(game) : handlePickGame(game));
  };

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
      <main id="main-content" className="pt-16 flex-1">
        <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-12 pb-20">
          <h1 className="sr-only">Home</h1>
          <div className="flex flex-col items-center text-center">
            {/* Main content area */}
            {isSyncing ? (
              <SyncProgress progress={syncProgress} games={syncingGames} />
            ) : currentlyPlaying ? (
              <>
                <CurrentlyPlaying
                  game={currentlyPlaying}
                  onFinish={handleFinishGame}
                  onDrop={handleDropGame}
                  onCancel={handleCancelGame}
                  isLoading={isStatusLoading}
                />
                <div className="flex flex-col items-center gap-1.5 mt-10">
                  <Button
                    size="lg"
                    className="cursor-pointer"
                    onClick={() => setIsSuggestionModalOpen(true)}
                  >
                    <Sparkles className="w-5 h-5" />
                    Pick My Next Game
                  </Button>
                  <p className="mt-1 text-xs text-zinc-500">
                    The picked game will be added to your{' '}
                    <Link
                      href="/playing-queue"
                      className="font-medium text-zinc-400 hover:text-zinc-300 transition-colors"
                    >
                      queue
                    </Link>
                  </p>
                </div>
              </>
            ) : isStatusLoading ? (
              <StatusLoadingState />
            ) : (
              <div className="flex flex-col items-center gap-4">
                <p className="text-zinc-400">What are you playing next?</p>
                <div className="flex items-center gap-2">
                  <Button
                    size="lg"
                    className="cursor-pointer"
                    onClick={() => setIsSuggestionModalOpen(true)}
                  >
                    <Sparkles className="w-5 h-5" />
                    Pick My Game
                  </Button>
                  <Button
                    onClick={handleRandomPick}
                    variant="secondary"
                    size="lg"
                    className="cursor-pointer"
                    title="Pick a random game"
                  >
                    <Dices className="w-5 h-5" />
                    Random
                  </Button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Game carousels */}
        {!isSyncing && carouselsLoading && <CarouselsLoadingState />}

        {!isSyncing &&
          !carouselsLoading &&
          (shortGames.length > 0 ||
            weekendGames.length > 0 ||
            highlyRatedGames.length > 0 ||
            hiddenGems.length > 0 ||
            recentlyAdded.length > 0) && (
            <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-24 space-y-16">
              {shortGames.length > 0 && (
                <GameCarousel
                  title="Top-Rated Games Under 5 Hours"
                  games={shortGames}
                  onOpenDetail={handleOpenCarouselDetail}
                  priority
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
                  title="Finish It in a Weekend"
                  games={weekendGames}
                  onOpenDetail={handleOpenCarouselDetail}
                />
              )}
              {hiddenGems.length > 0 && (
                <GameCarousel
                  title="Hidden Gems"
                  games={hiddenGems}
                  onOpenDetail={handleOpenCarouselDetail}
                />
              )}
              {recentlyAdded.length > 0 && (
                <GameCarousel
                  title="Recently Added"
                  games={recentlyAdded}
                  onOpenDetail={handleOpenCarouselDetail}
                />
              )}
            </section>
          )}
      </main>

      <SuggestionModal
        isOpen={isSuggestionModalOpen}
        onClose={() => setIsSuggestionModalOpen(false)}
        onPick={handleSuggestionAction}
        mode={currentlyPlaying ? 'queue' : 'play'}
        showHistoryWarning={historyCount <= 5}
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
          mainStoryHours={carouselModal.game.main_story_hours}
          steamReviewScore={carouselModal.game.steam_review_score}
          steamReviewCount={carouselModal.game.steam_review_count}
          playtimeMinutes={carouselModal.game.playtime_forever}
          deckCompat={carouselModal.game.deck_compat}
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
