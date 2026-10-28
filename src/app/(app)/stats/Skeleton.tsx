import {
  PageHeaderSkeleton,
  PageSkeleton,
  PanelSkeleton,
  Skeleton,
} from '@/components/layout/Skeleton';
import { panelPadding } from '@/components/ui/Panel';

// Each block mirrors the real section's padding and content rows rather than
// using fixed heights, so the skeleton and the loaded page line up.

const PANEL = panelPadding();

function SectionTitleSkeleton() {
  return <Skeleton className="h-5 w-36 mb-4" />;
}

function BarListSkeleton({ rows }: { rows: number }) {
  return (
    <PanelSkeleton className={PANEL}>
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
    </PanelSkeleton>
  );
}

export function StatsContentSkeleton() {
  return (
    <div className="space-y-6">
      {/* Hours: the sentence, then the most played art (one large, four small). */}
      <div className="pb-4">
        <Skeleton className="h-8 w-full max-w-2xl" />
        <Skeleton className="h-8 w-56 mt-1" />
        <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-5">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className={i === 0 ? 'col-span-2 lg:row-span-2' : ''}>
              <Skeleton className="aspect-[460/215] w-full rounded-xl" />
              <Skeleton className={`mt-2 w-2/3 ${i === 0 ? 'h-7' : 'h-5'}`} />
              <Skeleton className="h-5 w-1/2" />
            </div>
          ))}
        </div>
      </div>

      {/* Backlog pace: the sentence, the hours line, then the breakdown. */}
      <PanelSkeleton className={PANEL}>
        <SectionTitleSkeleton />
        <Skeleton className="h-8 w-full max-w-xl" />
        <Skeleton className="h-6 w-full max-w-md mt-2" />
        <Skeleton className="h-2.5 w-full rounded-full mt-6 mb-4" />
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-24" />
        </div>
      </PanelSkeleton>

      {/* Favourites: art beside the ratings. */}
      <PanelSkeleton className={PANEL}>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div>
            <SectionTitleSkeleton />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-4">
              {Array.from({ length: 8 }, (_, i) => (
                <div key={i}>
                  <Skeleton className="aspect-[460/215] w-full rounded-lg" />
                  <Skeleton className="h-5 w-3/4 mt-1.5" />
                </div>
              ))}
            </div>
          </div>
          <Skeleton className="h-36 w-full lg:self-center" />
        </div>
      </PanelSkeleton>

      <PanelSkeleton className={PANEL}>
        <SectionTitleSkeleton />
        <Skeleton className="h-6 w-full max-w-xl mb-6 -mt-1" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-8 gap-y-5">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i}>
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-1 w-full mt-2 rounded-full" />
              <Skeleton className="h-4 w-20 mt-1.5" />
            </div>
          ))}
        </div>
      </PanelSkeleton>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BarListSkeleton rows={10} />
        <PanelSkeleton className={`${PANEL} flex flex-col`}>
          <div className="flex items-center justify-between mb-4">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-7 w-36 rounded-lg" />
          </div>
          <div className="flex-1 min-h-[160px] flex items-end gap-1.5">
            {[96, 56, 128, 72, 112].map((h, i) => (
              <Skeleton key={i} className="flex-1 rounded-sm" style={{ height: h }} />
            ))}
          </div>
        </PanelSkeleton>
      </div>
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
