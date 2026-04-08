export default function StatsLoading() {
  return (
    <div className="min-h-screen bg-zinc-950 pt-24">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="h-8 w-40 bg-zinc-800 rounded animate-pulse mb-8" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          {Array.from({ length: 4 }, (_, i) => (
            <div
              key={i}
              className="h-24 bg-zinc-900 rounded-xl border border-zinc-800 animate-pulse"
            />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Array.from({ length: 4 }, (_, i) => (
            <div
              key={i}
              className="h-64 bg-zinc-900 rounded-xl border border-zinc-800 animate-pulse"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
