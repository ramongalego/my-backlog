import { Skeleton } from '@/components/layout/Skeleton';

// Skeletons for the home dashboard. They use the same sections, padding and
// card sizes as HomeView and GameCarousel so the page doesn't shift on load.

/** Full home skeleton: the "What are you playing next?" area plus carousels. */
export function LoadingState() {
  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col" role="status" aria-busy="true">
      <span className="sr-only">Loading…</span>
      <div className="pt-16 flex-1">
        <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-12 pb-20">
          <div className="flex flex-col items-center gap-4">
            <Skeleton className="h-6 w-48" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-12 w-44 rounded-lg" />
              <Skeleton className="h-12 w-32 rounded-lg" />
            </div>
          </div>
        </section>
        <CarouselsLoadingState />
      </div>
    </div>
  );
}

/** Mirrors GameCarousel: heading + arrow buttons, then a row of w-64 cards. */
export function CarouselsLoadingState() {
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-24 space-y-16">
      {[1, 2].map((i) => (
        <div key={i}>
          <div className="flex items-center justify-between mb-6">
            <Skeleton className="h-7 sm:h-8 w-56 sm:w-72" />
            <div className="flex gap-2">
              <Skeleton className="w-9 h-9 rounded-full" />
              <Skeleton className="w-9 h-9 rounded-full" />
            </div>
          </div>
          <div className="flex gap-4 overflow-hidden pb-4">
            {[1, 2, 3, 4, 5].map((j) => (
              <div
                key={j}
                className="shrink-0 w-64 bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800"
              >
                <Skeleton className="h-32 rounded-none" />
                <div className="p-4">
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2 mt-2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

/** Mirrors CurrentlyPlaying while the now-playing game is being resolved. */
export function StatusLoadingState() {
  return (
    <div className="w-full max-w-md mx-auto">
      <Skeleton className="h-5 w-28 mx-auto mb-3" />
      <div className="bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800">
        <Skeleton className="h-48 rounded-none" />
        <div className="p-5 space-y-4">
          <Skeleton className="h-7 w-3/4" />
          <Skeleton className="h-4 w-1/3" />
          <div className="flex gap-3 pt-2">
            <Skeleton className="flex-1 h-10 rounded-lg" />
            <Skeleton className="flex-1 h-10 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}
