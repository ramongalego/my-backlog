import { COVER_ASPECT } from '@/components/games/CoverArt';
import { PageHeaderSkeleton, PageSkeleton, Skeleton } from '@/components/layout/Skeleton';
import { Panel } from '@/components/ui/Panel';

/**
 * Mirrors QueueItemRow: a card with the cover on top on phones, a row on
 * desktop. `canPlay`: nothing is playing, so each row has a Play button.
 */
export function QueueListSkeleton({
  rows = 3,
  canPlay = false,
}: {
  rows?: number;
  canPlay?: boolean;
}) {
  return (
    <div className="divide-y divide-ink-800/70">
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 py-4 sm:px-3 sm:py-3"
        >
          <Skeleton className="hidden sm:block w-5 h-4 shrink-0" />
          <Skeleton className={`w-full sm:w-48 lg:w-56 ${COVER_ASPECT} rounded-lg shrink-0`} />
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="flex-1 min-w-0">
              {/* A font-medium title line (24px) and a text-xs meta line. */}
              <Skeleton className="h-5 w-3/4 sm:w-64 mt-0.5 mb-2" />
              <Skeleton className="h-4 w-1/2 sm:w-40" />
            </div>
            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
              {canPlay && <Skeleton className="w-9 sm:w-16 h-8 rounded-lg" />}
              <Skeleton className="w-7 h-7" />
              <Skeleton className="w-7 h-7" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Mirrors NowPlayingRow: the game being played, above the queue. */
function NowPlayingSkeleton() {
  return (
    <Panel
      padding="sm"
      className="grid gap-4 sm:grid-cols-[16rem_1fr] lg:grid-cols-[18rem_1fr] sm:gap-5 sm:items-center"
    >
      <Skeleton className={`w-full ${COVER_ASPECT} rounded-lg`} />
      <div className="min-w-0">
        <Skeleton className="h-6 w-2/3 mt-0.5" />
        <Skeleton className="h-3 w-20 mt-2" />
        <Skeleton className="h-3 w-56 max-w-full mt-3" />
        <Skeleton className="h-1 w-56 max-w-full mt-2 rounded-full" />
        <div className="mt-4 flex gap-2">
          <Skeleton className="h-8 w-24 rounded-lg" />
          <Skeleton className="h-8 w-20 rounded-lg" />
        </div>
      </div>
    </Panel>
  );
}

/**
 * The queue's content while it loads. `playing`: a game is being played (the
 * usual case, and the guess when it isn't known), so its panel comes first,
 * then "Up Next" and rows without Play buttons.
 */
export function QueueContentSkeleton({ playing = true }: { playing?: boolean }) {
  return playing ? (
    <div>
      <NowPlayingSkeleton />
      <Skeleton className="h-4 w-20 mt-10 mb-2" />
      <QueueListSkeleton />
    </div>
  ) : (
    <QueueListSkeleton canPlay />
  );
}

export function QueuePageSkeleton({ playing = true }: { playing?: boolean }) {
  return (
    <PageSkeleton>
      <PageHeaderSkeleton titleWidth="w-48" descriptionWidth="w-80 max-w-full" />
      <QueueContentSkeleton playing={playing} />
    </PageSkeleton>
  );
}
