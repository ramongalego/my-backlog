import { COVER_ASPECT } from '@/components/games/CoverArt';
import { PageHeaderSkeleton, PageSkeleton, Skeleton } from '@/components/layout/Skeleton';

/** Mirrors DiaryRow: a full-width cover on phones; day, cover, title and actions on desktop. */
function DiaryRowSkeleton() {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 py-4 sm:py-3 border-b border-ink-800/70">
      <div className="hidden sm:flex w-6 shrink-0 justify-end">
        <Skeleton className="h-4 w-4" />
      </div>
      <Skeleton className={`w-full sm:w-48 lg:w-56 ${COVER_ASPECT} rounded-lg shrink-0`} />
      <div className="min-w-0 flex-1 flex items-start gap-2">
        <Skeleton className="h-5 w-3/4 sm:w-72" />
        <Skeleton className="sm:hidden ml-auto h-5 w-20" />
      </div>
      <div className="hidden sm:flex shrink-0 w-20 justify-end">
        <Skeleton className="h-4 w-12" />
      </div>
      <div className="hidden sm:block shrink-0 w-8" />
      <Skeleton className="hidden sm:block w-7 h-7 shrink-0" />
    </div>
  );
}

/** A year heading, a month label and a few rows, laid out like the real list. */
export function DiaryListSkeleton() {
  return (
    <div>
      <div className="mt-2 pb-2 border-b border-ink-800">
        <Skeleton className="h-7 w-14" />
      </div>
      {[3, 2].map((rows, m) => (
        <div key={m}>
          <div className="pt-6 pb-1">
            <Skeleton className="h-5 w-16" />
          </div>
          {Array.from({ length: rows }, (_, i) => (
            <DiaryRowSkeleton key={i} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function DiaryPageSkeleton() {
  return (
    <PageSkeleton>
      <PageHeaderSkeleton titleWidth="w-24" descriptionWidth="w-48" />
      <DiaryListSkeleton />
    </PageSkeleton>
  );
}
