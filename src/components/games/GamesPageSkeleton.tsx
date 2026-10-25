import { PageHeaderSkeleton, PageSkeleton, Skeleton } from '@/components/layout/Skeleton';

const FILTER_PILL_WIDTHS = ['w-14', 'w-24', 'w-24', 'w-24', 'w-28', 'w-20'];

/** Mirrors GameCard: cover art, then the title and meta row. */
export function GameGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-3 sm:gap-x-4 gap-y-5 sm:gap-y-6">
      {Array.from({ length: count }, (_, i) => (
        <div key={i}>
          <Skeleton className="aspect-[460/215] rounded-lg" />
          <div className="pt-3">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2 mt-1.5" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function GamesPageSkeleton() {
  return (
    <PageSkeleton>
      <PageHeaderSkeleton
        titleWidth="w-36"
        descriptionWidth="w-40"
        actions={
          <div className="flex gap-1.5 overflow-hidden">
            {FILTER_PILL_WIDTHS.map((width, i) => (
              <Skeleton key={i} className={`h-8 shrink-0 rounded-lg ${width}`} />
            ))}
          </div>
        }
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <Skeleton className="h-10 w-full sm:w-80 rounded-lg" />
          <Skeleton className="h-5 w-32" />
        </div>
      </PageHeaderSkeleton>
      <GameGridSkeleton />
    </PageSkeleton>
  );
}
