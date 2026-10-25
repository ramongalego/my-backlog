import { PageHeaderSkeleton, PageSkeleton, Skeleton } from '@/components/layout/Skeleton';

const FILTER_PILL_WIDTHS = ['w-16', 'w-24', 'w-24', 'w-24', 'w-28', 'w-20'];

/** Mirrors GameCard: image, then a p-4 body with the title and meta row. */
export function GameGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800">
          <Skeleton className="h-40 sm:h-36 rounded-none" />
          <div className="p-4">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2 mt-2" />
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
          <div className="flex gap-2 overflow-hidden">
            {FILTER_PILL_WIDTHS.map((width, i) => (
              <Skeleton key={i} className={`h-8 shrink-0 rounded-lg ${width}`} />
            ))}
          </div>
        }
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <Skeleton className="h-[38px] w-full sm:w-80 rounded-lg" />
          <Skeleton className="h-6 w-36" />
        </div>
      </PageHeaderSkeleton>
      <GameGridSkeleton />
    </PageSkeleton>
  );
}
