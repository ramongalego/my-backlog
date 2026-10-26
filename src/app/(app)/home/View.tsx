'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';

import { Button } from '@/components/ui/Button';
import { PAGE_CONTAINER } from '@/components/layout/Page';
import { GameCarousel } from '@/components/GameCarousel';
import { CurrentlyPlaying } from '@/components/CurrentlyPlaying';
import { GameDetailModal } from '@/components/games/GameStatusModal';
import { GameSummaryModal } from '@/components/games/GameSummaryModal';
import { SuggestionModal } from '@/components/suggest';
import { SyncProgress } from '@/components/SyncProgress';
import {
  LoadingState,
  CarouselsLoadingState,
  StatusLoadingState,
} from '@/components/home/HomeLoadingStates';
import { useGameLibrary } from '@/hooks/useGameLibrary';
import { todayIso } from '@/lib/diary/date-utils';
import type { SuggestionResult } from '@/lib/suggest/types';
import { Dices, Sparkles } from 'lucide-react';

// Only shown before Steam is connected, so kept out of the dashboard's bundle.
// The modals are imported directly, like on the other pages: loading them on
// demand made the first open wait for their code.
const LandingPage = dynamic(() => import('@/components/LandingPage').then((m) => m.LandingPage));

export default function HomeView() {
  const [isSuggestionModalOpen, setIsSuggestionModalOpen] = useState(false);

  const { auth, meta, sync, carousels, currentGame, handleConnectSteam } = useGameLibrary();
  const { user, profile, isLoading } = auth;
  const { historyCount, queuedGameIds } = meta;
  const { isSyncing, progress: syncProgress, games: syncingGames } = sync;
  const {
    pickUp,
    moreLike,
    shortGames,
    weekendGames,
    highlyRatedGames,
    hiddenGems,
    recentlyAdded,
  } = carousels;
  // Started games lead; empty carousels are left out. More Like sits lower
  // but still claims its games first (see useCarouselPools).
  const carouselRows = [
    { key: 'pick-up', title: 'Pick Up Where You Left Off', games: pickUp },
    { key: 'short', title: 'Top-Rated Games Under 5 Hours', games: shortGames },
    { key: 'rated', title: 'Highly Rated, Never Played', games: highlyRatedGames },
    { key: 'weekend', title: 'Finish It in a Weekend', games: weekendGames },
    {
      key: 'more-like',
      title: moreLike ? `More Like ${moreLike.basedOn}` : '',
      games: moreLike?.games ?? [],
    },
    { key: 'gems', title: 'Hidden Gems', games: hiddenGems },
    { key: 'recent', title: 'Recently Added', games: recentlyAdded },
  ].filter((row) => row.games.length > 0);
  const carouselsLoading = carousels.loading;
  const {
    currentlyPlaying,
    isStatusLoading,
    statusModal,
    gameSummary,
    carouselModal,
    handlePickGame,
    handleFinishGame,
    handleDropGame,
    handleQueueGame,
    handleOpenCarouselDetail,
    handleConfirmCarouselDetail,
    handleCloseCarouselModal,
    handleCancelGame,
    handleMoveCurrentToQueue,
    handleRandomPick,
    handleConfirmStatusChange,
    handleCloseStatusModal,
    handleCloseSummary,
  } = currentGame;

  const handleSuggestionAction = async (suggested: SuggestionResult['game']) => {
    const game = {
      id: suggested.id,
      app_id: suggested.app_id,
      name: suggested.name,
      header_image: suggested.header_image,
      main_story_hours: suggested.main_story_hours ?? 0,
      playtime_forever: suggested.playtime_forever,
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
    <div className="min-h-screen bg-ink-950 flex flex-col">
      <main id="main-content" className="pt-20 sm:pt-24 pb-16 flex-1">
        <section className={`${PAGE_CONTAINER} pb-14`}>
          {isSyncing ? (
            <>
              <h1 className="sr-only">Home</h1>
              <SyncProgress progress={syncProgress} games={syncingGames} />
            </>
          ) : currentlyPlaying ? (
            <CurrentlyPlaying
              game={currentlyPlaying}
              onFinish={handleFinishGame}
              onDrop={handleDropGame}
              onCancel={handleCancelGame}
              onMoveToQueue={handleMoveCurrentToQueue}
              isLoading={isStatusLoading}
              footer={
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <Button
                    variant="secondary"
                    className="cursor-pointer"
                    onClick={() => setIsSuggestionModalOpen(true)}
                  >
                    <Sparkles className="w-4 h-4" aria-hidden="true" />
                    <span>Pick My Next Game</span>
                  </Button>
                  <p className="text-sm text-ink-400">
                    The picked game will be added to your{' '}
                    <Link
                      href="/playing-queue"
                      className="font-medium text-ink-200 underline decoration-ink-600 underline-offset-4 hover:text-ink-50 transition-colors"
                    >
                      queue
                    </Link>
                  </p>
                </div>
              }
            />
          ) : isStatusLoading ? (
            <StatusLoadingState />
          ) : (
            <div className="max-w-xl">
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-ink-50">
                What are you playing next?
              </h1>
              <p className="mt-2 text-ink-400">
                Answer a few quick questions and we&apos;ll pick something from your backlog, or
                leave it to chance
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-2">
                <Button
                  size="lg"
                  className="cursor-pointer"
                  onClick={() => setIsSuggestionModalOpen(true)}
                >
                  <Sparkles className="w-5 h-5" aria-hidden="true" />
                  <span>Pick My Game</span>
                </Button>
                <Button
                  onClick={handleRandomPick}
                  variant="secondary"
                  size="lg"
                  className="cursor-pointer"
                  title="Pick a random game"
                >
                  <Dices className="w-5 h-5" aria-hidden="true" />
                  <span>Random</span>
                </Button>
              </div>
            </div>
          )}
        </section>

        {/* Game carousels */}
        {!isSyncing && carouselsLoading && <CarouselsLoadingState />}

        {!isSyncing && !carouselsLoading && carouselRows.length > 0 && (
          <section className={`${PAGE_CONTAINER} space-y-12`}>
            {carouselRows.map((row, i) => (
              <GameCarousel
                key={row.key}
                title={row.title}
                games={row.games}
                onOpenDetail={handleOpenCarouselDetail}
                priority={i === 0}
              />
            ))}
          </section>
        )}
      </main>

      {isSuggestionModalOpen && (
        <SuggestionModal
          isOpen={isSuggestionModalOpen}
          onClose={() => setIsSuggestionModalOpen(false)}
          onPick={handleSuggestionAction}
          mode={currentlyPlaying ? 'queue' : 'play'}
          showHistoryWarning={historyCount <= 5}
        />
      )}

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
          lastPlayedAt={carouselModal.game.last_played_at}
          deckCompat={carouselModal.game.deck_compat}
          initialStatus="backlog"
          disablePlaying={!!currentlyPlaying}
          onAddToQueue={
            currentlyPlaying && !queuedGameIds.has(carouselModal.game.id)
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
          initialDate={todayIso()}
        />
      )}
    </div>
  );
}
