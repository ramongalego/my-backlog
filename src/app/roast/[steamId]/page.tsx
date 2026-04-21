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
    <div className="relative min-h-screen bg-zinc-950 overflow-hidden">
      {/* Ambient violet orb — sits behind the header */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 -translate-y-32"
      >
        <div className="w-[700px] h-[500px] bg-violet-600/10 rounded-full blur-3xl animate-[orbBreathe_10s_ease-in-out_infinite]" />
      </div>
      <main id="main-content" className="relative pt-24 pb-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          {/* Header */}
          <div className="text-center mb-10">
            <div className="relative inline-flex items-center justify-center mb-4">
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-violet-500/25 rounded-2xl blur-xl"
              />
              <div className="relative inline-flex items-center justify-center w-14 h-14 bg-violet-500/10 border border-violet-500/20 rounded-2xl">
                <Flame className="w-7 h-7 text-violet-400" />
              </div>
            </div>
            <h1 className="text-3xl font-bold mb-2 leading-tight">
              <span className="text-transparent bg-clip-text bg-linear-to-r from-violet-400 via-fuchsia-400 to-violet-400 bg-[length:200%_auto] animate-[gradientShimmer_8s_ease-in-out_infinite]">
                Steam Roast
              </span>
            </h1>
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
