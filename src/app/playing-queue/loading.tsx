export default function PlayingQueueLoading() {
  return (
    <div className="min-h-screen bg-zinc-950 pt-24">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <div className="h-8 w-40 bg-zinc-800 rounded animate-pulse mb-8" />
        <div className="h-32 bg-zinc-900 rounded-2xl border border-zinc-800 animate-pulse mb-8" />
        <div className="space-y-3">
          {Array.from({ length: 5 }, (_, i) => (
            <div
              key={i}
              className="flex gap-4 items-center p-4 bg-zinc-900 rounded-xl border border-zinc-800 animate-pulse"
            >
              <div className="w-24 h-14 bg-zinc-800 rounded shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-1/2 bg-zinc-800 rounded" />
                <div className="h-3 w-1/3 bg-zinc-800 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
