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
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px overflow-hidden rounded-xl bg-ink-800">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="bg-ink-900 px-5 py-4">
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-5 w-24 mt-0.5" />
            <Skeleton className="h-4 w-20 mt-0.5" />
          </div>
        ))}
      </div>

      <PanelSkeleton className={PANEL}>
        <SectionTitleSkeleton />
        <Skeleton className="h-2.5 w-full rounded-full mb-5" />
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-24" />
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

      <PanelSkeleton className={PANEL}>
        <SectionTitleSkeleton />
        <Skeleton className="h-4 w-52 mb-5 -mt-2" />
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
