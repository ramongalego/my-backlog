'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Flame } from 'lucide-react';
import { RoastHeader, RoastShell } from '@/components/roast/RoastLayout';

import { RoastResult } from '@/components/roast/RoastResult';
import type { RoastResponse } from '@/lib/roast/cache';
import { queryKeys } from '@/lib/query-keys';

async function fetchRoast(steamId: string): Promise<RoastResponse> {
  // Try cache first
  let res = await fetch(`/api/roast/${steamId}`);

  // If not cached, generate a fresh one
  if (res.status === 404) {
    res = await fetch('/api/roast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ steamInput: steamId }),
    });
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Could not load this roast');
  return data as RoastResponse;
}

// Cached roasts arrive pre-loaded from the server page; otherwise one is
// generated client-side.
export default function SharedRoastView({ steamId }: { steamId: string }) {
  const {
    data: result,
    error,
    isPending,
  } = useQuery({
    queryKey: queryKeys.roast.byId(steamId),
    queryFn: () => fetchRoast(steamId),
    staleTime: 24 * 60 * 60 * 1000,
    retry: false,
  });

  return (
    <RoastShell>
      <RoastHeader />

      {/* Loading */}
      {isPending && (
        <div className="text-center py-16">
          <div className="relative inline-block">
            <div className="w-16 h-16 border-4 border-ink-700 border-t-accent-400 rounded-full animate-spin" />
            <Flame className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 text-accent-400" />
          </div>
          <p className="mt-6 text-ink-400">Loading roast...</p>
        </div>
      )}

      {/* Error */}
      {error && !isPending && (
        <div className="text-center py-16">
          <p className="text-ink-400 mb-4">{error.message}</p>
          <Link
            href="/roast"
            className="text-sm text-accent-400 hover:text-accent-300 transition-colors"
          >
            Roast a profile
          </Link>
        </div>
      )}

      {/* Result */}
      {result && !isPending && <RoastResult result={result} />}

      {/* CTA to roast another */}
      {result && !isPending && (
        <div className="text-center mt-6">
          <Link href="/roast" className="text-sm text-ink-500 hover:text-ink-300 transition-colors">
            Roast someone else
          </Link>
        </div>
      )}
    </RoastShell>
  );
}
