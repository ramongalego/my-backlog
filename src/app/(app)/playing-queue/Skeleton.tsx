import { PageHeaderSkeleton, PageSkeleton, Skeleton } from '@/components/layout/Skeleton';

/** Mirrors QueueItemRow: badge, thumbnail, title + meta, then the action buttons. */
export function QueueListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 sm:gap-4 bg-zinc-900 rounded-xl border border-zinc-800 p-3 sm:p-4"
        >
          <Skeleton className="hidden sm:block w-8 h-8 rounded-lg shrink-0" />
          <Skeleton className="w-16 h-10 sm:w-24 sm:h-[60px] shrink-0" />
          <div className="flex-1 min-w-0">
            <Skeleton className="h-4 w-3/4 sm:w-64 mb-2" />
            <Skeleton className="h-3 w-1/2 sm:w-40" />
          </div>
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <Skeleton className="w-8 sm:w-16 h-8 rounded-lg" />
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
      <PageHeaderSkeleton titleWidth="w-44" descriptionWidth="w-36" />
      <QueueListSkeleton />
    </PageSkeleton>
  );
}
