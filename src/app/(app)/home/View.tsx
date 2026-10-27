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
import { CoverThumb } from '@/components/games/CoverArt';
import { SuggestionModal } from '@/components/suggest';
import { SyncProgress } from '@/components/SyncProgress';
import {
  LoadingState,
  CarouselsLoadingState,
  StatusLoadingState,
} from '@/components/home/HomeLoadingStates';
import { useGameLibrary } from '@/hooks/useGameLibrary';
import { useManualGameActions } from '@/hooks/useManualGame';
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
  const manualGames = useManualGameActions(user?.id ?? null);
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
  // Related rows sit together: games you've started, short games, highly
  // rated ones, then what's new. Empty carousels are left out. More Like sits
  // lower but still claims its games first (see useCarouselPools).
  const carouselRows = [
    { key: 'pick-up', title: 'Pick Up Where You Left Off', games: pickUp },
    { key: 'short', title: 'Top-Rated Games Under 5 Hours', games: shortGames },
    { key: 'weekend', title: 'Finish It in a Weekend', games: weekendGames },
    { key: 'rated', title: 'Highly Rated, Never Played', games: highlyRatedGames },
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
    queue,
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
      {/* Under the fixed header (h-14 / sm:h-16): the top section sits right below it. */}
      <main id="main-content" className="pt-14 sm:pt-16 pb-16 flex-1">
        {/* The lit band: what you're playing (or picking) now, a tone above the
            shelf of games below, so it reads as the page's subject rather than
            the first row of the feed. */}
        <section className="bg-ink-900">
          <div className={`${PAGE_CONTAINER} py-8 sm:py-12`}>
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
                onSaveHours={manualGames.dialogProps(currentlyPlaying)?.onSaveHours}
                isLoading={isStatusLoading}
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
          </div>
        </section>

        {/* Up next: the game that takes over when you finish this one, and
            picking another for the queue. The hinge between the band (now)
            and the shelf (later). */}
        {!isSyncing && currentlyPlaying && (
          <div
            className={`${PAGE_CONTAINER} mt-6 sm:mt-8 flex flex-wrap items-center justify-between gap-x-6 gap-y-4`}
          >
            {queue.length > 0 ? (
              <Link
                href="/playing-queue"
                className="group flex min-w-0 items-center gap-3 sm:gap-4 rounded-lg"
              >
                <CoverThumb
                  src={queue[0].game.header_image}
                  alt=""
                  className="w-20 sm:w-28 group-hover:brightness-110 transition-[filter]"
                />
                <span className="min-w-0">
                  <span className="block font-medium text-ink-100 group-hover:text-ink-50 transition-colors truncate">
                    {queue[0].game.name}
                  </span>
                  <span className="block text-sm text-ink-400">Next in your queue</span>
                </span>
              </Link>
            ) : (
              <p className="text-sm text-ink-400">
                Your{' '}
                <Link
                  href="/playing-queue"
                  className="font-medium text-ink-200 underline decoration-ink-600 underline-offset-4 hover:text-ink-50 transition-colors"
                >
                  queue
                </Link>{' '}
                is empty. The game you pick goes there, to play after this one.
              </p>
            )}
            <Button
              variant="secondary"
              className="cursor-pointer"
              onClick={() => setIsSuggestionModalOpen(true)}
            >
              <Sparkles className="w-4 h-4" aria-hidden="true" />
              <span>Pick My Next Game</span>
            </Button>
          </div>
        )}

        {/* Game carousels */}
        {!isSyncing && carouselsLoading && <CarouselsLoadingState />}

        {!isSyncing && !carouselsLoading && carouselRows.length > 0 && (
          <section className={`${PAGE_CONTAINER} mt-12 sm:mt-14 space-y-16`}>
            {carouselRows.map((row, i) => (
              <GameCarousel
                key={row.key}
                title={row.title}
                games={row.games}
                onOpenDetail={handleOpenCarouselDetail}
                // Hidden Gems are picked by what Steam's players think.
                preferSteamRating={row.key === 'gems'}
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
          criticScore={carouselModal.game.critic_score}
          criticCount={carouselModal.game.critic_count}
          playtimeMinutes={carouselModal.game.playtime_forever}
          lastPlayedAt={carouselModal.game.last_played_at}
          deckCompat={carouselModal.game.deck_compat}
          releaseDate={carouselModal.game.release_date}
          initialStatus="backlog"
          manual={manualGames.dialogProps(carouselModal.game)}
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
          // Finishing a console game is a good moment to update its hours.
          playtimeMinutes={currentlyPlaying.playtime_forever}
          manual={manualGames.dialogProps(currentlyPlaying)}
        />
      )}
    </div>
  );
}
