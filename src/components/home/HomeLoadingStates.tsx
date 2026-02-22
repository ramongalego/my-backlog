import { Header } from '@/components/Header';

export function LoadingState() {
  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      <Header />
      <main className="pt-16 flex-1 flex items-center justify-center">
        <div className="space-y-6 text-center">
          <div className="inline-flex items-center gap-3 px-4 py-2 bg-zinc-800 rounded-lg">
            <div className="w-8 h-8 bg-zinc-700 rounded animate-pulse" />
            <div className="w-24 h-4 bg-zinc-700 rounded animate-pulse" />
            <span className="text-zinc-700">·</span>
            <div className="w-16 h-4 bg-zinc-700 rounded animate-pulse" />
          </div>
          <div className="h-12 w-40 mx-auto bg-zinc-800 rounded-lg animate-pulse" />
        </div>
      </main>
    </div>
  );
}

export function CarouselsLoadingState() {
  return (
    <section className="max-w-7xl mx-auto px-6 pb-24 space-y-24">
      {[1, 2].map((i) => (
        <div key={i} className="space-y-6">
          <div className="h-8 w-64 bg-zinc-800 rounded animate-pulse" />
          <div className="flex gap-4">
            {[1, 2, 3, 4].map((j) => (
              <div key={j} className="shrink-0 w-64 bg-zinc-900 rounded-lg overflow-hidden">
                <div className="h-32 bg-zinc-800 animate-pulse" />
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-zinc-800 rounded w-3/4 animate-pulse" />
                  <div className="h-3 bg-zinc-800 rounded w-1/2 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

export function StatusLoadingState() {
  return (
    <div className="w-full max-w-md mx-auto">
      <div className="h-4 w-32 bg-zinc-800 rounded animate-pulse mx-auto mb-3" />
      <div className="bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800">
        <div className="h-48 bg-zinc-800 animate-pulse" />
        <div className="p-5 space-y-4">
          <div className="h-6 w-3/4 bg-zinc-800 rounded animate-pulse" />
          <div className="h-4 w-1/3 bg-zinc-800 rounded animate-pulse" />
          <div className="flex gap-3 pt-2">
            <div className="flex-1 h-10 bg-zinc-800 rounded-lg animate-pulse" />
            <div className="flex-1 h-10 bg-zinc-800 rounded-lg animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}
