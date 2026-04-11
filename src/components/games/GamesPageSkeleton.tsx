const FILTER_PILL_WIDTHS = ['w-14', 'w-20', 'w-24', 'w-20', 'w-20'];

export function GamesPageSkeleton() {
  return (
    <div className="min-h-screen bg-zinc-950">
      <div className="pt-24 pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col gap-4 mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="shrink-0 space-y-2">
                <div className="h-8 w-32 bg-zinc-800 rounded animate-pulse" />
                <div className="h-4 w-36 bg-zinc-800 rounded animate-pulse" />
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2 -mb-2">
                {FILTER_PILL_WIDTHS.map((width, i) => (
                  <div
                    key={i}
                    className={`h-8 shrink-0 bg-zinc-800 rounded-lg animate-pulse ${width}`}
                  />
                ))}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="h-10 w-full sm:w-80 bg-zinc-800 rounded-lg animate-pulse" />
              <div className="h-10 w-40 bg-zinc-800 rounded-lg animate-pulse" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 12 }, (_, i) => (
              <div
                key={i}
                className="bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800 animate-pulse"
              >
                <div className="h-40 sm:h-36 bg-zinc-800" />
                <div className="p-3 space-y-2">
                  <div className="h-4 w-3/4 bg-zinc-800 rounded" />
                  <div className="h-3 w-1/2 bg-zinc-800 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
