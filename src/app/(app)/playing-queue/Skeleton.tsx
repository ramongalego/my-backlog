import { COVER_ASPECT, THUMB_WIDTH } from '@/components/games/CoverArt';
import { PageHeaderSkeleton, PageSkeleton, Skeleton } from '@/components/layout/Skeleton';

/** Mirrors QueueItemRow: position, thumbnail, title + meta, then the action buttons. */
export function QueueListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="divide-y divide-ink-800/70">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 sm:gap-4 px-2 py-3 sm:px-3">
          <Skeleton className="w-5 h-4 shrink-0" />
          <Skeleton className={`${THUMB_WIDTH} ${COVER_ASPECT} rounded-md shrink-0`} />
          <div className="flex-1 min-w-0">
            <Skeleton className="h-4 w-3/4 sm:w-64 mb-2" />
            <Skeleton className="h-3 w-1/2 sm:w-40" />
          </div>
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <Skeleton className="w-9 sm:w-16 h-8 rounded-lg" />
            <Skeleton className="w-7 h-7" />
            <Skeleton className="w-7 h-7" />
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
