import { PageHeaderSkeleton, PageSkeleton, Skeleton } from '@/components/layout/Skeleton';

/** Mirrors DiaryRow: day, cover, title, rating, notes and edit columns. */
function DiaryRowSkeleton() {
  return (
    <div className="flex items-center gap-3 sm:gap-4 py-3 border-b border-zinc-800/60">
      <div className="w-6 shrink-0 flex justify-end">
        <Skeleton className="h-4 w-4" />
      </div>
      <Skeleton className="w-16 h-10 sm:w-28 sm:h-16 shrink-0" />
      <div className="min-w-0 flex-[2]">
        <Skeleton className="h-4 w-3/4 sm:w-72" />
        <Skeleton className="h-3 w-12 mt-2 sm:hidden" />
      </div>
      <div className="hidden sm:flex shrink-0 w-20 justify-end">
        <Skeleton className="h-4 w-12" />
      </div>
      <div className="hidden sm:block shrink-0 w-10" />
      <Skeleton className="w-7 h-7 shrink-0" />
    </div>
  );
}

/** A year heading, a month label and a few rows, laid out like the real list. */
export function DiaryListSkeleton() {
  return (
    <div>
      <div className="mt-2 pb-1 border-b border-zinc-800">
        <Skeleton className="h-6 w-14 mb-0.5" />
      </div>
      {[3, 2].map((rows, m) => (
        <div key={m}>
          <div className="pt-5 pb-2">
            <Skeleton className="h-4 w-10" />
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
