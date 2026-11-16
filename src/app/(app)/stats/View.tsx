'use client';

import { useRef } from 'react';
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
import { HighestRated } from '@/components/stats/HighestRated';
import { TagCompletion } from '@/components/stats/TagCompletion';
import { PlayedALot } from '@/components/stats/PlayedALot';
import { PlayerProfile } from '@/components/stats/PlayerProfile';

export default function StatsView() {
  const { stats, loading, loadError, retry, profileReady, gameDialog, openGame } = useStatsPage();
  const libraryMeta = useCachedLibraryMeta();
  const { user, profile } = useAuth();
  const isSteamConnected = profile?.steam_id != null;
  const { open: openAddGame } = useAddGame();
  // Which list a game's dialog was opened from. Saving can take the game out
  // of that list (a top-rated game put back in the backlog, a played-a-lot
  // game marked finished): focus then goes to the list's heading, or to the
  // page's title when the whole section went with the game, not to the page.
  const openedFrom = useRef('stats-highest-rated');
  const openRated = (gameId: number) => {
    openedFrom.current = 'stats-highest-rated';
    openGame(gameId);
  };
  const openPlayedALot = (gameId: number) => {
    openedFrom.current = 'stats-played-a-lot';
    openGame(gameId);
  };
  const focusOpenedFrom = () =>
    (
      document.getElementById(openedFrom.current) ?? document.getElementById('stats-title')
    )?.focus();
  const start = {
    isSteamConnected,
    onAddGame: () => openAddGame(),
    onConnectSteam: connectSteam,
  };
  return (
    <Page
      overlay={
        gameDialog && <GameDetailModal isOpen {...gameDialog} onOpenerGone={focusOpenedFrom} />
      }
    >
      <PageHeader
        title="Stats"
        id="stats-title"
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
          Add games to your library, or connect Steam, to see your stats here
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
          <HighestRated stats={stats} onOpen={openRated} />
          <TagCompletion stats={stats} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TopTags stats={stats} syncs={isSteamConnected} />
            <YearChart stats={stats} />
          </div>
          {stats.playedALot.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <PlayedALot stats={stats} onEdit={openPlayedALot} />
            </div>
          )}
          {profileReady && user && <PlayerProfile userId={user.id} />}
        </div>
      )}
    </Page>
  );
}
