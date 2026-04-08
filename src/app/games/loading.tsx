export default function GamesLoading() {
  return (
    <div className="min-h-screen bg-zinc-950 pt-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between mb-6">
          <div className="h-8 w-32 bg-zinc-800 rounded animate-pulse" />
          <div className="flex gap-2">
            <div className="h-10 w-24 bg-zinc-800 rounded-lg animate-pulse" />
            <div className="h-10 w-24 bg-zinc-800 rounded-lg animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({ length: 15 }, (_, i) => (
            <div key={i} className="bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800">
              <div className="h-36 bg-zinc-800 animate-pulse" />
              <div className="p-4 space-y-2">
                <div className="h-4 w-3/4 bg-zinc-800 rounded animate-pulse" />
                <div className="h-3 w-1/2 bg-zinc-800 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
