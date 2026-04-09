'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Flame } from 'lucide-react';

import { RoastResult } from '@/components/roast/RoastResult';
import type { RoastResponse } from '@/lib/roast/cache';

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

  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Could not load this roast');
  return data as RoastResponse;
}

export default function SharedRoastPage() {
  const { steamId } = useParams<{ steamId: string }>();

  const {
    data: result,
    error,
    isPending,
  } = useQuery({
    queryKey: ['roast', steamId],
    queryFn: () => fetchRoast(steamId),
    staleTime: 24 * 60 * 60 * 1000,
    retry: false,
  });

  return (
    <div className="min-h-screen bg-zinc-950">
      <main id="main-content" className="pt-24 pb-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          {/* Header */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-violet-500/10 rounded-2xl mb-4">
              <Flame className="w-7 h-7 text-violet-400" />
            </div>
            <h1 className="text-3xl font-bold text-zinc-100 mb-2">Steam Profile Roaster</h1>
          </div>

          {/* Loading */}
          {isPending && (
            <div className="text-center py-16">
              <div className="relative inline-block">
                <div className="w-16 h-16 border-4 border-zinc-700 border-t-violet-400 rounded-full animate-spin" />
                <Flame className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 text-violet-400" />
              </div>
              <p className="mt-6 text-zinc-400">Loading roast...</p>
            </div>
          )}

          {/* Error */}
          {error && !isPending && (
            <div className="text-center py-16">
              <p className="text-zinc-400 mb-4">{error.message}</p>
              <Link
                href="/roast"
                className="text-sm text-violet-400 hover:text-violet-300 transition-colors"
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
              <Link
                href="/roast"
                className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Roast someone else
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
