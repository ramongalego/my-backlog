import { Skeleton } from '@/components/layout/Skeleton';

/** Mirrors the roast form: 48px input + Roast button, then the hint line. */
export function RoastFormSkeleton() {
  return (
    <div className="mb-10">
      <div className="flex gap-3">
        <Skeleton className="h-12 flex-1 rounded-xl" />
        <Skeleton className="h-12 w-28 rounded-xl" />
      </div>
      <Skeleton className="h-4 w-80 max-w-full mt-2" />
    </div>
  );
}

/** Mirrors RoastResult: the profile strip and the roast card. */
export function RoastResultSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Skeleton className="w-9 h-9 rounded-md" />
        <Skeleton className="h-4 w-64 max-w-[70%]" />
      </div>
      <div className="p-5 sm:p-6 bg-ink-900 rounded-xl space-y-3">
        {['w-full', 'w-11/12', 'w-full', 'w-4/5', 'w-full', 'w-2/3'].map((w, i) => (
          <Skeleton key={i} className={`h-4 ${w}`} />
        ))}
      </div>
    </div>
  );
}
