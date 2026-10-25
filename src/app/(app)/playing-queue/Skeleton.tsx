import { COVER_ASPECT } from '@/components/games/CoverArt';
import { PageHeaderSkeleton, PageSkeleton, Skeleton } from '@/components/layout/Skeleton';

/** Mirrors QueueItemRow: a card with the cover on top on phones, a row on desktop. */
export function QueueListSkeleton({ rows = 3 }: { rows?: number }) {
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
              <Skeleton className="h-5 w-3/4 sm:w-64 mb-1.5" />
              <Skeleton className="h-4 w-1/2 sm:w-40" />
            </div>
            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
              <Skeleton className="w-9 sm:w-16 h-8 rounded-lg" />
              <Skeleton className="w-7 h-7" />
              <Skeleton className="w-7 h-7" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function QueuePageSkeleton() {
  return (
    <PageSkeleton>
      <PageHeaderSkeleton titleWidth="w-48" descriptionWidth="w-80 max-w-full" />
      <QueueListSkeleton />
    </PageSkeleton>
  );
}
