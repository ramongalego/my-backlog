'use client';

import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Flame } from 'lucide-react';
import { RoastHeader, RoastShell } from '@/components/roast/RoastLayout';
import { RoastResultSkeleton } from '@/components/roast/RoastSkeletons';
import { RoastResult } from '@/components/roast/RoastResult';
import { Button } from '@/components/ui/Button';
import type { RoastResponse } from '@/types/roast';
import { queryKeys } from '@/lib/query-keys';

/** The cached roast for a profile, or null when it hasn't been roasted yet. */
async function fetchCachedRoast(steamId: string): Promise<RoastResponse | null> {
  const res = await fetch(`/api/roast/${steamId}`);
  if (res.status === 404) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Could not load this roast');
  return data as RoastResponse;
}

async function generateRoast(steamId: string): Promise<RoastResponse> {
  const res = await fetch('/api/roast', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ steamInput: steamId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Could not roast this profile');
  // Profiles we don't roast answer with a message instead.
  if (data.blacklisted) throw new Error(data.message);
  return data as RoastResponse;
}

// Cached roasts arrive pre-loaded from the server page. A profile that hasn't
// been roasted is only roasted when someone asks: opening a link never writes
// one, so links to random profiles can't spend the daily roast budget.
export default function SharedRoastView({ steamId }: { steamId: string }) {
  const queryClient = useQueryClient();
  const {
    data: cached,
    error,
    isPending,
  } = useQuery({
    queryKey: queryKeys.roast.byId(steamId),
    queryFn: () => fetchCachedRoast(steamId),
    staleTime: 24 * 60 * 60 * 1000,
    retry: false,
  });
  const roast = useMutation({
    mutationFn: () => generateRoast(steamId),
    onSuccess: (result) => queryClient.setQueryData(queryKeys.roast.byId(steamId), result),
  });

  const result = cached ?? null;
  const failure = error ?? roast.error;
  const loading = isPending || roast.isPending;

  return (
    <RoastShell>
      <RoastHeader />

      {/* Loading (or writing a new roast): the same skeleton as the page's
          loading state, so it goes straight from there to the roast. */}
      {loading && (
        <div role="status" aria-busy="true">
          <span className="sr-only">Loading roast…</span>
          <RoastResultSkeleton />
        </div>
      )}

      {/* Error */}
      {failure && !loading && (
        <div className="text-center py-16">
          <p className="text-ink-400 mb-4">{failure.message}</p>
          <Link
            href="/roast"
            className="text-sm text-accent-400 hover:text-accent-300 transition-colors"
          >
            Roast a profile
          </Link>
        </div>
      )}

      {/* Not roasted yet */}
      {!loading && !failure && !result && (
        <div className="text-center py-16">
          <p className="text-ink-300 mb-6">This profile hasn&apos;t been roasted yet.</p>
          <Button onClick={() => roast.mutate()} className="cursor-pointer">
            <Flame className="w-4 h-4" aria-hidden="true" />
            <span>Roast this profile</span>
          </Button>
        </div>
      )}

      {/* Result */}
      {result && !loading && <RoastResult result={result} />}

      {/* CTA to roast another */}
      {result && !loading && (
        <div className="text-center mt-6">
          <Link href="/roast" className="text-sm text-ink-500 hover:text-ink-300 transition-colors">
            Roast someone else
          </Link>
        </div>
      )}
    </RoastShell>
  );
}
