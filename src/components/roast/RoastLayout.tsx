import type { ReactNode } from 'react';
import { Flame } from 'lucide-react';

/** Centred column shared by the roast pages and their skeletons. */
export function RoastShell({ children, busy }: { children: ReactNode; busy?: boolean }) {
  return (
    <div
      className="min-h-screen bg-ink-950"
      role={busy ? 'status' : undefined}
      aria-busy={busy || undefined}
    >
      {busy && <span className="sr-only">Loading…</span>}
      <main id="main-content" className="pt-20 sm:pt-24 pb-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">{children}</div>
      </main>
    </div>
  );
}

/** Flame mark, "Steam Roast" title and optional tagline. */
export function RoastHeader({ tagline }: { tagline?: string }) {
  return (
    <div className="mb-10">
      <h1 className="flex items-center gap-3 text-3xl sm:text-4xl font-semibold tracking-tight text-ink-50">
        <Flame className="w-8 h-8 text-accent-500 shrink-0" aria-hidden="true" />
        Steam Roast
      </h1>
      {tagline && <p className="text-ink-400 mt-3 max-w-xl">{tagline}</p>}
    </div>
  );
}
