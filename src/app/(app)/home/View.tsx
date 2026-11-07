'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { LoadError } from '@/components/ui/LoadError';
import { PAGE_CONTAINER } from '@/components/layout/Page';
import { GameCarousel } from '@/components/home/GameCarousel';
import { CurrentlyPlaying } from '@/components/home/CurrentlyPlaying';
import { GameDetailModal } from '@/components/games/GameDetailModal';
import { GameSummaryModal } from '@/components/games/GameSummaryModal';
import { SuggestionModal } from '@/components/suggest/SuggestionModal';
import { SyncProgress } from '@/components/sync/SyncProgress';
import { CarouselsLoadingState, HomeLoading, StatusLoadingState } from './Skeleton';
import { useHomePage } from '@/hooks/useHomePage';
import { useManualGameActions } from '@/hooks/useManualGameActions';
import { useAddGame } from '@/components/games/AddGameProvider';
import { todayIso } from '@/lib/diary/date-utils';
import { connectSteam } from '@/lib/client/steam-connect';
import type { SuggestionResult } from '@/lib/suggest/types';
import { BuildBacklog } from '@/components/home/BuildBacklog';
import { RandomRoll } from '@/components/home/RandomRoll';
import { PickNext, wallCovers } from '@/components/home/PickNext';
import { PickNextHint } from '@/components/home/PickNextHint';
import { UpNext } from '@/components/home/UpNext';
import { homeCarouselRows } from '@/components/home/carousel-rows';
import { MIN_GAMES_TO_PICK } from '@/lib/data/loaders';
import { steamLastPlayed } from '@/lib/games/consoles';

export default function HomeView() {
  const [isSuggestionModalOpen, setIsSuggestionModalOpen] = useState(false);
  const router = useRouter();

  const { auth, meta, sync, carousels, currentGame, loadError, retry } = useHomePage();
  const { user, profile, isLoading } = auth;
  const manualGames = useManualGameActions(user?.id ?? null);
  const { open: openAddGame } = useAddGame();
  const { gameCount, historyCount, backlogCount, queuedGameIds } = meta;
  const { isSyncing, progress: syncProgress, games: syncingGames } = sync;
  const carouselRows = homeCarouselRows(carousels);
  const carouselsLoading = carousels.loading;
  const {
    currentlyPlaying,
    queue,
    isStatusLoading,
    statusModal,
    gameSummary,
    carouselModal,
    handlePickGame,
    handlePlayNext,
    handleFinishGame,
    handleDropGame,
    handleQueueGame,
    handleOpenCarouselDetail,
    handleConfirmCarouselDetail,
    handlePlayInstead,
    handleSwitchTo,
    handleCloseCarouselModal,
    handleCancelGame,
    handleMoveCurrentToQueue,
    handleRandomPick,
    rollCovers,
    rolledGameId,
    handleConfirmStatusChange,
    handleCloseStatusModal,
    handleCloseSummary,
  } = currentGame;

  const toGame = (suggested: SuggestionResult['game']) => ({
    id: suggested.id,
    app_id: suggested.app_id,
    // Where it's played, so its card shows the console and links the right way.
    source: suggested.source,
    platform: suggested.platform,
    name: suggested.name,
    header_image: suggested.header_image,
    main_story_hours: suggested.main_story_hours ?? 0,
    playtime_forever: suggested.playtime_forever,
  });
  const handleSuggestionAction = async (suggested: SuggestionResult['game']) => {
    const game = toGame(suggested);
    await (currentlyPlaying ? handleQueueGame(game) : handlePickGame(game));
  };

  const isSteamConnected = profile?.steam_id != null;
  // Until there are a few games to choose between, picking one has no point:
  // Home asks for more, with a bar counting toward them. Finished and dropped
  // games can't be picked, so they don't count.
  const isBuildingBacklog = backlogCount < MIN_GAMES_TO_PICK && !isSyncing && !currentlyPlaying;
  // Both picks leave queued games out, so once every backlog game is queued
  // there's nothing left to pick, and a pick would only come back empty.
  const pickable = backlogCount - queuedGameIds.size;
  const nothingToPick = pickable <= 0;
  // Picking for the queue needs a few games to choose between, like the band.
  const tooFewToPick = pickable < MIN_GAMES_TO_PICK;

  // Signed-out visitors never get here (the proxy sends them to the landing page).
  if (isLoading || !user) {
    return <HomeLoading />;
  }

  // Without the counts or the game being played, the band can't tell which
  // state you're in, so say what failed rather than guess.
  if (loadError) {
    return (
      <main id="main-content" className={`${PAGE_CONTAINER} min-h-screen pt-14 sm:pt-16`}>
        <h1 className="sr-only">Home</h1>
        <LoadError what="your library" onRetry={retry} />
      </main>
    );
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
                reveal={currentlyPlaying.id === rolledGameId}
              />
            ) : rollCovers ? (
              <RandomRoll covers={rollCovers} />
            ) : isStatusLoading ? (
              <StatusLoadingState />
            ) : isBuildingBacklog ? (
              <BuildBacklog
                // Recently Added lists them newest first, from the first game.
                covers={wallCovers([carousels.recentlyAdded])}
                count={backlogCount}
                historyCount={historyCount}
                steamEmpty={gameCount === 0 && isSteamConnected}
                isSteamConnected={isSteamConnected}
                onAddGame={() => openAddGame()}
                onConnectSteam={connectSteam}
              />
            ) : (
              <PickNext
                // The carousels leave queued games out, so with everything queued
                // the wall shows the queue instead.
                covers={wallCovers(
                  nothingToPick ? [queue.map((q) => q.game)] : carouselRows.map((row) => row.games),
                )}
                backlogCount={backlogCount}
                onPick={() => setIsSuggestionModalOpen(true)}
                onRandom={handleRandomPick}
                allQueued={
                  nothingToPick
                    ? {
                        onOpenQueue: () => router.push('/playing-queue'),
                        onAddGame: () => openAddGame(),
                      }
                    : undefined
                }
              >
                {!nothingToPick && (
                  <PickNextHint
                    backlogCount={backlogCount}
                    isSteamConnected={isSteamConnected}
                    onAddGame={() => openAddGame()}
                    onConnectSteam={connectSteam}
                  />
                )}
              </PickNext>
            )}
          </div>
        </section>

        {!isSyncing && !rollCovers && (currentlyPlaying || queue.length > 0) && (
          <UpNext
            queue={queue}
            isPlaying={!!currentlyPlaying}
            nothingToPick={nothingToPick}
            tooFewToPick={tooFewToPick}
            onPlayNext={handlePlayNext}
            onAddGame={() => openAddGame()}
            onPickNext={() => setIsSuggestionModalOpen(true)}
          />
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
                minGames={row.minGames}
                preload={i === 0}
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
          onPlayNow={(suggested) => handleSwitchTo(toGame(suggested))}
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
          lastPlayedAt={steamLastPlayed(carouselModal.game)}
          deckCompat={carouselModal.game.deck_compat}
          releaseDate={carouselModal.game.release_date}
          initialStatus="backlog"
          manual={manualGames.dialogProps(carouselModal.game)}
          disablePlaying={!!currentlyPlaying}
          onPlayInstead={handlePlayInstead}
          playingName={currentlyPlaying?.name ?? null}
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
