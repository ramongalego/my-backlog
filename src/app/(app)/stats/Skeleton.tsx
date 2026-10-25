import {
  CardSkeleton,
  PageHeaderSkeleton,
  PageSkeleton,
  Skeleton,
} from '@/components/layout/Skeleton';

// Each block mirrors the real section's padding and content rows rather than
// using fixed heights, so the skeleton and the loaded page line up.

function SectionTitleSkeleton() {
  return <Skeleton className="h-4 w-36 mb-4" />;
}

function StatCardSkeleton() {
  return (
    <CardSkeleton className="p-5 flex flex-col gap-3">
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-[30px] w-16" />
      <Skeleton className="h-4 w-24" />
    </CardSkeleton>
  );
}

function BarListSkeleton({ rows }: { rows: number }) {
  return (
    <CardSkeleton className="p-6">
      <SectionTitleSkeleton />
      <div className="space-y-3">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-5 w-20 sm:w-32 shrink-0" />
            <Skeleton className="h-1.5 flex-1 rounded-full" />
            <Skeleton className="h-4 w-6 shrink-0" />
          </div>
        ))}
      </div>
    </CardSkeleton>
  );
}

export function StatsContentSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {Array.from({ length: 6 }, (_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>

      <CardSkeleton className="p-6">
        <SectionTitleSkeleton />
        <Skeleton className="h-2.5 w-full rounded-full mb-5" />
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-24" />
        </div>
      </CardSkeleton>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BarListSkeleton rows={10} />
        <CardSkeleton className="p-6 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-6 w-32 rounded-lg" />
          </div>
          <div className="flex-1 min-h-[160px] flex items-end gap-1.5">
            {[96, 56, 128, 72, 112].map((h, i) => (
              <Skeleton key={i} className="flex-1 rounded-sm" style={{ height: h }} />
            ))}
          </div>
        </CardSkeleton>
      </div>

      <CardSkeleton className="p-6">
        <SectionTitleSkeleton />
        <Skeleton className="h-3 w-52 mb-5 -mt-2" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-[84px] rounded-lg" />
          ))}
        </div>
      </CardSkeleton>
    </div>
  );
}

export function StatsPageSkeleton() {
  return (
    <PageSkeleton>
      <PageHeaderSkeleton titleWidth="w-24" descriptionWidth="w-80 max-w-full" />
      <StatsContentSkeleton />
    </PageSkeleton>
  );
}
