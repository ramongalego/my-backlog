import type { ReactNode } from 'react';
import { Flame } from 'lucide-react';

/** Background orb and centred column shared by the roast pages and their skeletons. */
export function RoastShell({ children, busy }: { children: ReactNode; busy?: boolean }) {
  return (
    <div
      className="relative min-h-screen bg-zinc-950 overflow-hidden"
      role={busy ? 'status' : undefined}
      aria-busy={busy || undefined}
    >
      {busy && <span className="sr-only">Loading…</span>}
      {/* Ambient violet orb — sits behind the header */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 -translate-y-32"
      >
        <div className="w-[700px] h-[500px] bg-violet-600/10 rounded-full blur-3xl animate-[orbBreathe_10s_ease-in-out_infinite]" />
      </div>
      <main id="main-content" className="relative pt-20 sm:pt-24 pb-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">{children}</div>
      </main>
    </div>
  );
}

/** Flame badge, gradient "Steam Roast" title and optional tagline. */
export function RoastHeader({ tagline }: { tagline?: string }) {
  return (
    <div className="text-center mb-10">
      <div className="relative inline-flex items-center justify-center mb-4">
        <div aria-hidden="true" className="absolute inset-0 bg-violet-500/25 rounded-2xl blur-xl" />
        <div className="relative inline-flex items-center justify-center w-14 h-14 bg-violet-500/10 border border-violet-500/20 rounded-2xl">
          <Flame className="w-7 h-7 text-violet-400" />
        </div>
      </div>
      <h1 className="text-3xl font-bold leading-tight">
        <span className="text-transparent bg-clip-text bg-linear-to-r from-violet-400 via-fuchsia-400 to-violet-400 bg-[length:200%_auto] animate-[gradientShimmer_8s_ease-in-out_infinite]">
          Steam Roast
        </span>
      </h1>
      {tagline && <p className="text-zinc-400 mt-2">{tagline}</p>}
    </div>
  );
}
