export default function RoastLoading() {
  return (
    <div className="min-h-screen bg-zinc-950 pt-24">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
        <div className="h-10 w-64 bg-zinc-800 rounded animate-pulse mx-auto mb-4" />
        <div className="h-5 w-96 bg-zinc-800 rounded animate-pulse mx-auto mb-8" />
        <div className="h-12 w-48 bg-zinc-800 rounded-xl animate-pulse mx-auto" />
      </div>
    </div>
  );
}
