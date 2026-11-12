'use client';

import { Gamepad2 } from 'lucide-react';
import { GameDetailModal } from '@/components/games/GameDetailModal';
import { useStatsPage } from '@/hooks/useStatsPage';
import { isStarting } from '@/lib/stats/compute';
import { useAddGame } from '@/components/games/AddGameProvider';
import { StatsStart, StatsStartButtons } from '@/components/stats/StatsStart';
import { connectSteam } from '@/lib/client/steam-connect';
import { useAuth } from '@/hooks/useAuth';
import { Page, PageHeader } from '@/components/layout/Page';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadError } from '@/components/ui/LoadError';
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
import { PlayerProfile } from '@/components/stats/PlayerProfile';

export default function StatsView() {
  const { stats, loading, loadError, retry, profileReady, gameDialog, openGame } = useStatsPage();
  const libraryMeta = useCachedLibraryMeta();
  const { user, profile } = useAuth();
  const isSteamConnected = profile?.steam_id != null;
  const { open: openAddGame } = useAddGame();
  const start = {
    isSteamConnected,
    onAddGame: () => openAddGame(),
    onConnectSteam: connectSteam,
  };
  return (
    <Page
      overlay={gameDialog && <GameDetailModal isOpen initialStatus="backlog" {...gameDialog} />}
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
              what you loved, then the patterns, and last what they say
              about you. */}
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
              <PlayedALot stats={stats} onEdit={openGame} />
            </div>
          )}
          {profileReady && user && <PlayerProfile userId={user.id} />}
        </div>
      )}
    </Page>
  );
}
