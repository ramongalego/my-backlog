import type { Insight, InsightTone } from '@/lib/profile/prompt';

interface InsightResponse extends Insight {
  generatedAt: string;
}

/** The player profile (or its roast) for the signed-in player, written or saved. */
export async function fetchInsight(tone: InsightTone): Promise<InsightResponse> {
  const res = await fetch('/api/insights', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tone }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error ?? 'Couldn’t load this right now.');
  return body as InsightResponse;
}
