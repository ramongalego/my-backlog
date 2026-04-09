export default function HomeLoading() {
  return (
    <div className="min-h-screen bg-zinc-950">
      <main id="main-content" className="pt-16">
        <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-12 pb-20">
          <div className="flex flex-col items-center text-center gap-4">
            <div className="h-6 w-48 bg-zinc-800 rounded animate-pulse" />
            <div className="h-40 w-full max-w-md bg-zinc-900 rounded-2xl animate-pulse" />
          </div>
        </section>
      </main>
    </div>
  );
}
