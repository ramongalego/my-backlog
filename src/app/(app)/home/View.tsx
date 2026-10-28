'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { PAGE_CONTAINER } from '@/components/layout/Page';
import { GameCarousel, MIN_CAROUSEL_GAMES } from '@/components/GameCarousel';
import { CurrentlyPlaying } from '@/components/CurrentlyPlaying';
import { GameDetailModal } from '@/components/games/GameStatusModal';
import { GameSummaryModal } from '@/components/games/GameSummaryModal';
import { CoverThumb } from '@/components/games/CoverArt';
import { SuggestionModal } from '@/components/suggest';
import { SyncProgress } from '@/components/SyncProgress';
import { CarouselsLoadingState, StatusLoadingState } from '@/components/home/HomeLoadingStates';
import { useGameLibrary } from '@/hooks/useGameLibrary';
import { useManualGameActions } from '@/hooks/useManualGame';
import { useAddGame } from '@/components/games/AddGameProvider';
import { todayIso } from '@/lib/diary/date-utils';
import { connectSteam } from '@/lib/steam/connect';
import type { SuggestionResult } from '@/lib/suggest/types';
import { PickIcon } from '@/components/suggest/PickIcon';
import { BuildBacklog } from '@/components/home/BuildBacklog';
import { HomeLoading } from '@/components/home/HomeLoading';
import { RandomRoll } from '@/components/home/RandomRoll';
import { PickNext, wallCovers } from '@/components/home/PickNext';
import { MIN_GAMES_TO_PICK } from '@/lib/data/loaders';
import { steamLastPlayed } from '@/lib/games/consoles';

// Below this many backlog games, the picker band says picks get better with more.
const SMALL_BACKLOG = 10;

const INLINE_LINK =
  'cursor-pointer font-medium text-ink-200 underline decoration-ink-600 underline-offset-4 hover:text-ink-50 transition-colors';

export default function HomeView() {
  const [isSuggestionModalOpen, setIsSuggestionModalOpen] = useState(false);
  const router = useRouter();

  const { auth, meta, sync, carousels, currentGame } = useGameLibrary();
  const { user, profile, isLoading } = auth;
  const manualGames = useManualGameActions(user?.id ?? null);
  const { open: openAddGame } = useAddGame();
  const { gameCount, historyCount, backlogCount, queuedGameIds } = meta;
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
    // A plain list of what's new, so it shows from the first game: while the
    // backlog is being built, it's the games added so far.
    { key: 'recent', title: 'Recently Added', games: recentlyAdded, minGames: 1 },
  ].filter((row) => row.games.length >= (row.minGames ?? MIN_CAROUSEL_GAMES));
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
    rollCovers,
    rolledGameId,
    handleConfirmStatusChange,
    handleCloseStatusModal,
    handleCloseSummary,
  } = currentGame;

  const handleSuggestionAction = async (suggested: SuggestionResult['game']) => {
    const game = {
      id: suggested.id,
      app_id: suggested.app_id,
      // Where it's played, so its card shows the console and links the right way.
      source: suggested.source,
      platform: suggested.platform,
      name: suggested.name,
      header_image: suggested.header_image,
      main_story_hours: suggested.main_story_hours ?? 0,
      playtime_forever: suggested.playtime_forever,
    };
    await (currentlyPlaying ? handleQueueGame(game) : handlePickGame(game));
  };

  const isSteamConnected = profile?.steam_id != null;
  // Until there are a few games to choose between, picking one has no point:
  // Home asks for more, with a bar counting toward them. Finished and dropped
  // games can't be picked, so they don't count.
  const isBuildingBacklog = backlogCount < MIN_GAMES_TO_PICK && !isSyncing && !currentlyPlaying;
  // Both picks leave queued games out, so once every backlog game is queued
  // there's nothing left to pick, and a pick would only come back empty.
  const nothingToPick = backlogCount - queuedGameIds.size <= 0;

  // Signed-out visitors never get here (the proxy sends them to the landing page).
  if (isLoading || !user) {
    return <HomeLoading />;
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
                covers={wallCovers([recentlyAdded])}
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
                {nothingToPick ? null : backlogCount < SMALL_BACKLOG ? (
                  // Three games is enough to pick between, not enough to pick
                  // well: say the picks improve with more, and how to get there.
                  <p className="mt-4 text-sm text-ink-400">
                    Picks get better the more games you have.{' '}
                    <button onClick={() => openAddGame()} className={INLINE_LINK}>
                      Add a few more
                    </button>
                    {!isSteamConnected && (
                      <>
                        , or{' '}
                        <button onClick={connectSteam} className={INLINE_LINK}>
                          connect Steam
                        </button>{' '}
                        to bring in your whole library
                      </>
                    )}
                    .
                  </p>
                ) : (
                  !isSteamConnected && (
                    <p className="mt-4 text-sm text-ink-400">
                      Games on Steam too?{' '}
                      <button onClick={connectSteam} className={INLINE_LINK}>
                        Connect Steam
                      </button>{' '}
                      to bring in your library.
                    </p>
                  )
                )}
              </PickNext>
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
                is empty.{' '}
                {nothingToPick
                  ? 'Add a game to have one ready for after this.'
                  : 'The game you pick goes there, to play after this one.'}
              </p>
            )}
            {nothingToPick ? (
              // Every backlog game is playing or queued: nothing left to pick.
              <Button variant="secondary" className="cursor-pointer" onClick={() => openAddGame()}>
                <Plus className="w-4 h-4" aria-hidden="true" />
                <span>Add a game</span>
              </Button>
            ) : (
              <Button
                variant="secondary"
                className="group cursor-pointer"
                onClick={() => setIsSuggestionModalOpen(true)}
              >
                <PickIcon />
                <span>Pick My Next Game</span>
              </Button>
            )}
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
                minGames={row.minGames}
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
          lastPlayedAt={steamLastPlayed(carouselModal.game)}
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
