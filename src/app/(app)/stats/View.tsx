'use client';

import { useState } from 'react';
import { Gamepad2 } from 'lucide-react';
import { GameDetailModal } from '@/components/games/GameDetailModal';
import { isStarting, useStatsPage } from '@/hooks/useStatsPage';
import { useAddGame } from '@/components/games/AddGameProvider';
import { StatsStart, StatsStartButtons } from '@/components/stats/StatsStart';
import { connectSteam } from '@/lib/client/steam-connect';
import { useAuth } from '@/hooks/useAuth';
import { useAddToQueue } from '@/hooks/useQueue';
import { useSwitchGame } from '@/hooks/useSwitchGame';
import { useSetGameStatus } from '@/hooks/useGameMutations';
import { useManualGameActions } from '@/hooks/useManualGameActions';
import type { PlayedALotGame } from '@/hooks/useStatsPage';
import { Page, PageHeader } from '@/components/layout/Page';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadError } from '@/components/ui/LoadError';
import { steamLastPlayed } from '@/lib/games/consoles';
import { StatsContentSkeleton } from './Skeleton';
import { EmptyStateSkeleton } from '@/components/layout/Skeleton';
import { useCachedLibraryMeta } from '@/hooks/useLibraryMeta';
import { Hours } from '@/components/stats/Hours';
import { BacklogPace } from '@/components/stats/BacklogPace';
import { TopTags } from '@/components/stats/TopTags';
import { YearChart } from '@/components/stats/YearChart';
import { Favourites } from '@/components/stats/Favourites';
import { TagCompletion } from '@/components/stats/TagCompletion';
import { PlayedALot } from '@/components/stats/PlayedALot';

type EditModalState = PlayedALotGame;

export default function StatsView() {
  const { stats, loading, loadError, retry, hasPlayingGame } = useStatsPage();
  const libraryMeta = useCachedLibraryMeta();
  const { user, profile } = useAuth();
  const isSteamConnected = profile?.steam_id != null;
  const { open: openAddGame } = useAddGame();
  const start = {
    isSteamConnected,
    onAddGame: () => openAddGame(),
    onConnectSteam: connectSteam,
  };
  const manualGames = useManualGameActions(user?.id ?? null);
  const addGameToQueue = useAddToQueue(user?.id ?? null);
  const switchGame = useSwitchGame(user?.id ?? null);
  const [editModal, setEditModal] = useState<EditModalState | null>(null);

  // Stats reads the shared games list, so the change shows straight away.
  const statusMutation = useSetGameStatus(user?.id ?? null);

  const handleEdit = (game: PlayedALotGame) => setEditModal(game);

  const handleAddToQueue = () => {
    if (!editModal) return;
    setEditModal(null);
    addGameToQueue(editModal);
  };

  const handleConfirm = async (
    status: string,
    date: string,
    notes: string,
    rating: number | null,
  ) => {
    if (!editModal) return;
    statusMutation.mutate({ gameId: editModal.id, status, date, notes, rating });
    setEditModal(null);
  };

  return (
    <Page
      overlay={
        editModal && (
          <GameDetailModal
            isOpen={true}
            onClose={() => setEditModal(null)}
            onConfirm={handleConfirm}
            gameName={editModal.name}
            headerImage={editModal.header_image}
            mainStoryHours={editModal.main_story_hours}
            playtimeMinutes={editModal.playtime_forever}
            lastPlayedAt={steamLastPlayed(editModal)}
            deckCompat={editModal.deck_compat}
            manual={manualGames.dialogProps(editModal)}
            initialStatus="backlog"
            disablePlaying={hasPlayingGame}
            onAddToQueue={hasPlayingGame ? handleAddToQueue : undefined}
            onPlayInstead={() => switchGame.switchTo(editModal)}
            playingName={switchGame.playing?.name ?? null}
          />
        )
      }
    >
      <PageHeader
        title="Stats"
        description={<>Your whole library, except games you&apos;ve hidden or won&apos;t play</>}
      />

      {loading ? (
        libraryMeta?.gameCount === 0 ? (
          <EmptyStateSkeleton />
        ) : (
          <StatsContentSkeleton />
        )
      ) : loadError ? (
        <LoadError what="your stats" onRetry={retry} />
      ) : !stats ? (
        <EmptyState icon={Gamepad2} title="No stats yet" action={<StatsStartButtons {...start} />}>
          Add games to your library, or connect Steam, to see your stats here.
        </EmptyState>
      ) : isStarting(stats) ? (
        <StatsStart backlog={stats.backlog} storyHours={stats.estimatedBacklogHours} {...start} />
      ) : (
        <div className="space-y-6">
          {/* Your games first: where the hours went, then what's left and
              what you loved, then the patterns. */}
          <div className="pb-4">
            <Hours stats={stats} />
          </div>
          <BacklogPace stats={stats} />
          <Favourites stats={stats} />
          <TagCompletion stats={stats} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TopTags stats={stats} syncs={isSteamConnected} />
            <YearChart stats={stats} />
          </div>
          {stats.playedALot.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <PlayedALot stats={stats} onEdit={handleEdit} />
            </div>
          )}
        </div>
      )}
    </Page>
  );
}
